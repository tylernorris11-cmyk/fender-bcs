import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';

type View = 'day' | 'week' | 'month';

type Entry = {
  id: string; time: string; title: string; detail: string;
  group: 'Deliveries' | 'Vehicles & machinery' | 'Other';
  href?: string; town?: string; date: Date;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const GROUP_TONE = {
  Deliveries: 'border-brand bg-brand-50',
  'Vehicles & machinery': 'border-violet-400 bg-violet-50',
  Other: 'border-sky-400 bg-sky-50',
} as const;

export default async function PlanningPage({
  searchParams,
}: { searchParams: { view?: View; date?: string; depot?: string } }) {
  const user = await requirePermission('planning.view');
  const alerts = await getAlerts(user);
  const depot = searchParams.depot;

  const view: View = searchParams.view ?? 'week';
  const anchor = searchParams.date ? new Date(searchParams.date) : new Date();

  const from = view === 'month'
    ? mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    : view === 'day' ? startOfDay(anchor) : mondayOf(anchor);
  const days = view === 'month' ? 42 : view === 'day' ? 1 : 7;
  const to = addDays(from, days);

  const [orders, events, assets, locations] = await Promise.all([
    db.order.findMany({
      where: {
        archived: false, deliveryDate: { gte: from, lt: to }, stage: { notIn: ['CANCELLED', 'DRAFT'] },
        ...(depot ? { depot } : {}),
      },
      include: { customer: true },
    }),
    db.planningEvent.findMany({ where: { startsAt: { gte: from, lt: to } }, include: { asset: true, order: true } }),
    db.asset.findMany({ where: { retired: false, OR: [{ company: null }, { company: { in: user.companies } }], ...(depot ? { depot } : {}) } }),
    db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  const entries: Entry[] = [];

  for (const o of orders) {
    // Both companies share this board because they share lorries — but a
    // viewer without access to the OTHER company, or without orders.view at
    // all, only gets the logistics (day, town), never the customer or order detail.
    const visible = user.companies.includes(o.company) && can(user, 'orders.view');
    entries.push({
      id: `order-${o.id}`,
      date: o.deliveryDate!,
      time: clock(o.deliveryDate) === '00:00' ? '' : clock(o.deliveryDate),
      title: visible ? `Deliver ${o.number} — ${o.customer.name}` : `${COMPANY_LABEL[o.company]} delivery`,
      detail: visible ? `${o.customer.contactName} · ${o.town}` : (o.town || ''),
      group: 'Deliveries',
      href: visible ? `/orders/${o.id}` : undefined,
      town: o.town,
    });
  }

  for (const e of events) {
    // Unlike an order (masked to logistics-only, since the lorry is shared),
    // an event tied to a company-restricted asset isn't shareable at all —
    // there's no shared-fleet reason for the other side to see it, so it's
    // left off the board entirely rather than shown masked.
    if (e.asset?.company && !user.companies.includes(e.asset.company)) continue;

    // Same reasoning as a company mismatch — an asset-linked event isn't
    // shareable with someone who can't see assets at all.
    if (e.assetId && !can(user, 'assets.view')) continue;

    // An event tied to an order or a depot-based asset belongs to that
    // depot; anything else (a toolbox talk, a general reminder) isn't
    // depot-specific and stays visible whichever depot is selected.
    const eventDepot = e.order?.depot ?? e.asset?.depot;
    if (depot && eventDepot && eventDepot !== depot) continue;

    const orderCompany = e.order?.company;
    const visible = !orderCompany || (user.companies.includes(orderCompany) && can(user, 'orders.view'));
    entries.push({
      id: `event-${e.id}`,
      date: e.startsAt,
      time: e.allDay ? '' : clock(e.startsAt),
      title: visible ? e.title : `${COMPANY_LABEL[orderCompany!]} delivery`,
      detail: visible ? (e.detail || e.assignedTo) : (e.town || ''),
      group: e.type === 'INSPECTION' || e.type === 'SERVICE' ? 'Vehicles & machinery' : e.type === 'DELIVERY' ? 'Deliveries' : 'Other',
      href: visible ? (e.orderId ? `/orders/${e.orderId}` : e.assetId ? `/assets/${e.assetId}` : undefined) : undefined,
      town: e.town,
    });
  }

  // Statutory dates from the asset register drop straight onto the calendar,
  // so nothing sits in a spreadsheet that nobody opens — but only for
  // someone who can actually see the asset register in the first place.
  for (const a of can(user, 'assets.view') ? assets : []) {
    const due: [string, Date | null][] = [
      ['MOT', a.motDue], ['Road tax', a.taxDue], ['Safety inspection', a.weeklyCheckDue],
      ['PUWER inspection', a.puwerDue], ['LOLER exam', a.lolerDue], ['Service', a.serviceDue],
      ['Measurement calibration', a.calibrationDue],
    ];
    for (const [label, d] of due) {
      if (!d || d < from || d >= to) continue;
      entries.push({
        id: `asset-${a.id}-${label}`, date: d, time: '',
        title: `${label} — ${a.name}`, detail: `${a.ref} · ${a.depot}`,
        group: 'Vehicles & machinery', href: `/assets/${a.id}`,
      });
    }
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));

  const heading = view === 'month'
    ? anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : view === 'day' ? shortDate(anchor) : `Week of ${shortDate(from)}`;

  const withDepot = (params: URLSearchParams) => {
    if (depot) params.set('depot', depot);
    return params;
  };
  const shift = (n: number) => {
    const d = view === 'month'
      ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
      : addDays(anchor, n * (view === 'day' ? 1 : 7));
    return `/planning?${withDepot(new URLSearchParams({ view, date: d.toISOString().slice(0, 10) }))}`;
  };

  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));

  return (
    <Shell user={user} module="planning" nav={NAV.planning} current={`/planning${view === 'week' ? '' : `?view=${view}`}`} alerts={alerts.length}>
      <PageHeader title="Deliveries" blurb="Deliveries, inspections and everything else with a date on it." />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <Link key={v} href={`/planning?${withDepot(new URLSearchParams({ view: v }))}`}
              className={`rounded-pill px-5 py-2 text-sm font-medium border capitalize transition-colors ${
                view === v ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'
              }`}>
              {v}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href={shift(-1)} className="btn-secondary p-2.5" aria-label="Previous"><ChevronLeft size={18} /></Link>
          <h2 className="text-lg font-bold min-w-[180px] text-center">{heading}</h2>
          <Link href={shift(1)} className="btn-secondary p-2.5" aria-label="Next"><ChevronRight size={18} /></Link>
          <Link href={`/planning?${withDepot(new URLSearchParams({ view }))}`} className="text-brand-700 font-semibold text-sm hover:underline">Today</Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filter by depot">
        <Link href={`/planning?${new URLSearchParams({ view })}`}
          className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${!depot ? 'bg-forest text-white border-forest' : 'bg-white border-hairline hover:bg-canvas'}`}>
          Both depots
        </Link>
        {locations.map((l) => (
          <Link key={l.id} href={`/planning?${new URLSearchParams({ view, depot: l.name })}`}
            className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${depot === l.name ? 'bg-forest text-white border-forest' : 'bg-white border-hairline hover:bg-canvas'}`}>
            {l.name}
          </Link>
        ))}
      </nav>

      <div className={`grid gap-3 ${view === 'day' ? '' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7'}`}>
        {dayList.map((day) => {
          const dayEntries = entries.filter((e) => sameDay(e.date, day));
          const isToday = sameDay(day, new Date());
          const outOfMonth = view === 'month' && day.getMonth() !== anchor.getMonth();
          const towns = [...new Set(dayEntries.filter((e) => e.town).map((e) => e.town))];

          if (outOfMonth && dayEntries.length === 0) return <div key={day.toISOString()} />;

          return (
            <div key={day.toISOString()}
                 className={`card p-3 min-h-[150px] ${isToday ? 'ring-2 ring-brand' : ''} ${outOfMonth ? 'opacity-50' : ''}`}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                {isToday && <span className="text-[10px] font-bold text-brand uppercase">Today</span>}
              </div>
              <p className="font-bold mb-2">{day.getDate()} {day.toLocaleDateString('en-GB', { month: 'short' })}</p>

              {towns.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-brand-700 font-medium bg-brand-50 rounded-md px-2 py-1 mb-2">
                  <MapPin size={11} aria-hidden /> {towns.join(', ')}
                </p>
              )}

              {dayEntries.length === 0 ? (
                <p className="text-ink-faint text-sm">—</p>
              ) : (
                <ul className="space-y-2">
                  {dayEntries.map((e) => {
                    const body = (
                      <div className={`border-l-[3px] rounded-r-md px-2 py-1.5 ${GROUP_TONE[e.group]}`}>
                        {e.time && <span className="text-xs font-semibold text-forest">{e.time} </span>}
                        <span className="text-xs font-medium">{e.title}</span>
                        {e.detail && <span className="block text-[11px] text-ink-muted mt-0.5">{e.detail}</span>}
                      </div>
                    );
                    return <li key={e.id}>{e.href ? <Link href={e.href} className="block hover:opacity-80">{body}</Link> : body}</li>;
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

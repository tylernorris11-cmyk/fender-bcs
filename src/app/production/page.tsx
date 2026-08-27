import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, SortSelect, StagePill, Stat, StatRow } from '@/components/ui';
import { logProduction } from './actions';

export default async function ProductionPage({ searchParams }: { searchParams: { sort?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';

  const orders = await db.order.findMany({
    where: { company, archived: false, stage: { in: ['APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'] } },
    include: {
      customer: true,
      barMarks: isFender ? { include: { qcChecks: true } } : false,
      lines: true,
      production: { include: { user: true }, orderBy: { at: 'desc' }, take: 1 },
    },
    orderBy:
      searchParams.sort === 'number' ? [{ number: 'asc' }]
      : searchParams.sort === 'customer' ? [{ customer: { name: 'asc' } }]
      : [{ deliveryDate: 'asc' }],
  });

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production" alerts={alerts.length}>
      {isFender ? (
        <FenderView orders={orders} sort={searchParams.sort} />
      ) : (
        <BcsView orders={orders} sort={searchParams.sort} user={user} company={company} />
      )}
    </Shell>
  );
}

// ------------------------------------------------------------ Fender Steel

function FenderView({ orders, sort }: { orders: any[]; sort?: string }) {
  const cutBent = orders.filter((o) => o.barMarks.length > 0);
  const barsOutstanding = cutBent.reduce(
    (s, o) => s + o.barMarks.filter((b: any) => b.status === 'Scheduled').reduce((n: number, b: any) => n + b.bars, 0), 0);
  const failed = cutBent.reduce((s, o) => s + o.barMarks.filter((b: any) => b.qcChecks.some((c: any) => !c.pass)).length, 0);
  const tonnesOut = cutBent.reduce((s, o) => s + o.barMarks.reduce((n: number, b: any) => n + Number(b.weightKg), 0), 0);

  return (
    <>
      <PageHeader title="Production" blurb="What is on the shear line and the benders, and what still needs checking." />

      <StatRow>
        <Stat value={cutBent.length} label="Cut & bent orders in the yard" />
        <Stat value={barsOutstanding.toLocaleString('en-GB')} label="Bars still to cut" />
        <Stat value={tonnes(tonnesOut)} label="Tonnage in progress" />
        <Stat value={failed} label="Marks out of tolerance" tone={failed ? 'bad' : 'default'} href="/production/checks" />
      </StatRow>

      <SortForm sort={sort} />

      {orders.length === 0 ? <Empty title="Nothing in production. Approve an order to start it." /> : (
        <div className="space-y-3">
          {orders.map((o) => {
            const scheduled = o.barMarks.filter((b: any) => b.status === 'Scheduled').length;
            const checked = o.barMarks.filter((b: any) => b.qcChecks.length > 0).length;
            return (
              <article key={o.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-5">
                <div className="min-w-[200px]">
                  <Link href={`/orders/${o.id}`} className="font-bold text-brand-700 hover:underline">{o.number}</Link>
                  <p className="text-sm text-ink-muted">{o.customer.name} · {o.town}</p>
                </div>
                <StagePill stage={o.stage} />
                <div className="text-sm">
                  {o.barMarks.length > 0
                    ? <>{o.barMarks.length} bar marks · {scheduled} still to run · {checked} checked</>
                    : <span className="text-ink-muted">Standard products only — no bending</span>}
                </div>
                <div className="text-sm text-ink-muted">Delivery {shortDate(o.deliveryDate)}</div>
                {o.production[0] && (
                  <Pill tone="info">{o.production[0].action} · {o.production[0].station} · {o.production[0].user?.name}</Pill>
                )}
                <div className="ml-auto flex gap-2">
                  {o.barMarks.length > 0 && (
                    <>
                      <a href={`/orders/${o.id}/bending-ticket`} className="btn-secondary btn-sm">Bending ticket</a>
                      <Link href={`/production/checks?order=${o.id}`} className="btn-primary btn-sm">Record checks</Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// -------------------------------------------------------------- BCS Products
// Fence post is cut to length from coil through a straightening machine —
// no bending, no BS 8666 tolerances. Progress is just "which machine, when."

async function BcsView({ orders, sort, user, company }: { orders: any[]; sort?: string; user: any; company: 'BS_SUPPLIES' }) {
  const machines = await db.asset.findMany({
    where: { type: 'MACHINE', retired: false, OR: [{ company: null }, { company }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, category: true },
  });

  const notStarted = orders.filter((o) => o.production.length === 0).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutToday = orders.filter((o) => o.production[0] && new Date(o.production[0].at) >= today).length;
  const tonnesInProgress = orders.reduce((s, o) => s + o.lines.reduce((n: number, l: any) => n + Number(l.weightKg), 0), 0);

  return (
    <>
      <PageHeader title="Production" blurb="What still needs cutting to length, and what's already off the straightening line." />

      <StatRow>
        <Stat value={orders.length} label="Orders in production" />
        <Stat value={tonnes(tonnesInProgress)} label="Tonnage in progress" />
        <Stat value={notStarted} label="Not started yet" tone={notStarted ? 'warn' : 'default'} />
        <Stat value={cutToday} label="Cut today" tone="good" />
      </StatRow>

      <SortForm sort={sort} />

      {orders.length === 0 ? <Empty title="Nothing in production. Approve an order to start it." /> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <article key={o.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-5">
              <div className="min-w-[200px]">
                <Link href={`/orders/${o.id}`} className="font-bold text-brand-700 hover:underline">{o.number}</Link>
                <p className="text-sm text-ink-muted">{o.customer.name} · {o.town}</p>
              </div>
              <StagePill stage={o.stage} />
              <div className="text-sm text-ink-muted">
                {o.lines.length} {o.lines.length === 1 ? 'line' : 'lines'} · {tonnes(o.lines.reduce((n: number, l: any) => n + Number(l.weightKg), 0))}
              </div>
              <div className="text-sm text-ink-muted">Delivery {shortDate(o.deliveryDate)}</div>
              {o.production[0] ? (
                <Pill tone="info">{o.production[0].action} · {o.production[0].station} · {o.production[0].user?.name}</Pill>
              ) : (
                <Pill tone="warn">Not started</Pill>
              )}

              {can(user, 'production.progress') && (
                <form action={logProduction} className="ml-auto flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="station" value="Straightening line" />
                  <div>
                    <label className="label text-xs" htmlFor={`asset-${o.id}`}>Machine</label>
                    <select id={`asset-${o.id}`} name="assetId" className="input w-36 py-2">
                      {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`action-${o.id}`}>Progress</label>
                    <select id={`action-${o.id}`} name="action" className="input w-32 py-2">
                      <option value="Started">Started</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <button className="btn-secondary btn-sm">Log</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SortForm({ sort }: { sort?: string }) {
  return (
    <form className="flex justify-end gap-2 mb-4">
      <SortSelect
        value={sort}
        options={[
          { value: 'delivery', label: 'Delivery soonest' },
          { value: 'number', label: 'Order A-Z' },
          { value: 'customer', label: 'Customer A-Z' },
        ]}
      />
      <button className="btn-secondary btn-sm">Apply</button>
    </form>
  );
}

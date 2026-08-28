import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader } from '@/components/ui';
import { addDays, bankHolidayName, isoDay, isWeekend, utcDay } from '@/lib/holidays';

const mondayOfUtc = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => isoDay(a) === isoDay(b);

export default async function HolidayCalendarPage({ searchParams }: { searchParams: { date?: string } }) {
  const user = await requirePermission('holidays.view');
  const alerts = await getAlerts(user);

  const anchor = searchParams.date ? new Date(`${searchParams.date}T00:00:00Z`) : utcDay(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const monthStart = utcDay(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1);
  const from = mondayOfUtc(monthStart);
  const days = 42;
  const to = addDays(from, days);

  const requests = await db.holidayRequest.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] }, startDate: { lt: to }, endDate: { gte: from } },
    include: { user: { select: { name: true, colour: true } } },
    orderBy: { startDate: 'asc' },
  });

  const heading = anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = (n: number) => {
    const d = utcDay(anchor.getUTCFullYear(), anchor.getUTCMonth() + n, 1);
    return `/holidays/calendar?date=${isoDay(d)}`;
  };

  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const people = [...new Map(requests.map((r) => [r.userId, r.user])).values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Shell user={user} module="holidays" nav={NAV.holidays} current="/holidays/calendar" alerts={alerts.length}>
      <PageHeader title="Holiday calendar" blurb="Everyone's approved and pending time off — shared across both companies." />

      <div className="flex items-center gap-3 mb-6">
        <Link href={shift(-1)} className="btn-secondary p-2.5" aria-label="Previous month"><ChevronLeft size={18} /></Link>
        <h2 className="text-lg font-bold min-w-[200px] text-center">{heading}</h2>
        <Link href={shift(1)} className="btn-secondary p-2.5" aria-label="Next month"><ChevronRight size={18} /></Link>
        <Link href="/holidays/calendar" className="text-brand-700 font-semibold text-sm hover:underline">Today</Link>
        <Link href="/holidays" className="ml-auto btn-secondary">Requests</Link>
      </div>

      {people.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          {people.map((p) => (
            <span key={p.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.colour || '#16A085' }} aria-hidden />
              {p.name}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint px-1">{d}</div>
        ))}
        {dayList.map((day) => {
          const holiday = bankHolidayName(day);
          const isToday = sameDay(day, new Date());
          const outOfMonth = day.getUTCMonth() !== anchor.getUTCMonth();
          const dayEntries = requests.filter((r) => r.startDate <= day && r.endDate >= day);

          return (
            <div key={isoDay(day)}
                 className={`card p-2 min-h-[100px] ${isToday ? 'ring-2 ring-brand' : ''} ${outOfMonth ? 'opacity-40' : ''} ${isWeekend(day) ? 'bg-canvas' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{day.getUTCDate()}</p>
                {isToday && <span className="text-[10px] font-bold text-brand uppercase">Today</span>}
              </div>
              {holiday && <p className="text-[10px] text-signal font-medium leading-tight mt-0.5">{holiday}</p>}

              {dayEntries.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {dayEntries.map((r) => (
                    <li key={r.id}
                        className={`flex items-center gap-1 text-[11px] rounded px-1 py-0.5 ${r.status === 'PENDING' ? 'border border-dashed border-hairline' : ''}`}
                        style={{ background: r.status === 'APPROVED' ? `${r.user.colour || '#16A085'}22` : undefined }}
                        title={`${r.user.name}${r.status === 'PENDING' ? ' (pending)' : ''}`}>
                      <Avatar name={r.user.name} colour={r.user.colour} size={14} />
                      <span className="truncate">{r.user.name.split(' ')[0]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

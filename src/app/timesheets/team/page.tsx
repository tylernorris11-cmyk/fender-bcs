import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { addDays, isoDay, parseDayInput } from '@/lib/holidays';
import { dayLabel, dueWeekMonday, formatHours, mondayOf, todayInLondon, weekDays, weekRangeLabel } from '@/lib/timesheets';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader, Pill, Stat, StatRow, Table } from '@/components/ui';

export default async function TimesheetTeamPage({ searchParams }: { searchParams: { week?: string } }) {
  const user = await requirePermission('timesheets.viewAll');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const today = todayInLondon();

  const thisMonday = mondayOf(today);
  const dueMonday = dueWeekMonday(today);
  // Opens on the week that's due now — the one people are being chased for.
  const monday = mondayOf(parseDayInput(searchParams.week ?? '') ?? dueMonday);
  const days = weekDays(monday);
  const weekOver = addDays(monday, 6) < today;

  const people = await db.user.findMany({
    where: { active: true, onTimesheets: true, companies: { has: company } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, colour: true, jobTitle: true },
  });
  const ids = people.map((p) => p.id);
  const [entries, submitted] = await Promise.all([
    db.timesheetEntry.findMany({ where: { userId: { in: ids }, date: { gte: monday, lte: addDays(monday, 6) } } }),
    db.timesheetWeek.findMany({ where: { userId: { in: ids }, weekStart: monday } }),
  ]);
  const entryFor = new Map(entries.map((e) => [`${e.userId}|${isoDay(e.date)}`, e]));
  const submittedAt = new Map(submitted.map((s) => [s.userId, s.submittedAt]));
  const totalFor = (userId: string) => entries.filter((e) => e.userId === userId).reduce((s, e) => s + e.workedMinutes, 0);

  const outstanding = weekOver ? people.filter((p) => !submittedAt.has(p.id)) : [];

  return (
    <Shell user={user} module="timesheets" nav={NAV.timesheets} current="/timesheets/team" alerts={alerts.length}>
      <PageHeader
        title="Team timesheets"
        blurb={`Hours for everyone on timesheets at ${COMPANY_LABEL[company]}. Anyone who clocks in isn't listed.`}
        actions={can(user, 'setup.users') ? <Link href="/timesheets/people" className="btn-secondary">Who fills one in</Link> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link href={`/timesheets/team?week=${isoDay(addDays(monday, -7))}`} className="btn-secondary btn-sm" aria-label="Previous week"><ChevronLeft size={16} /></Link>
        <h2 className="text-lg font-bold">{weekRangeLabel(monday)}</h2>
        <Link href={`/timesheets/team?week=${isoDay(addDays(monday, 7))}`} className="btn-secondary btn-sm" aria-label="Next week"><ChevronRight size={16} /></Link>
        {isoDay(monday) !== isoDay(dueMonday) && <Link href="/timesheets/team" className="text-sm text-brand-700 underline">Week that&apos;s due</Link>}
        {isoDay(monday) === isoDay(thisMonday) && <Pill tone="neutral">This week — still in progress</Pill>}
      </div>

      {people.length === 0 ? (
        <section className="card card-pad">
          <Empty
            title="Nobody is on timesheets for this company yet."
            action={can(user, 'setup.users') ? <Link href="/timesheets/people" className="btn-primary">Choose who fills one in</Link> : undefined}
          />
        </section>
      ) : (
        <>
          <StatRow>
            <Stat value={people.length} label="On timesheets" />
            <Stat
              value={weekOver ? `${people.length - outstanding.length} of ${people.length}` : '—'}
              label="Handed in"
              tone={weekOver && outstanding.length > 0 ? 'warn' : 'good'}
            />
            <Stat value={formatHours(people.reduce((s, p) => s + totalFor(p.id), 0))} label="Total hours" />
          </StatRow>

          {outstanding.length > 0 && (
            <p className="banner-warn mb-4">
              Yet to hand in: {outstanding.map((p) => p.name).join(', ')}.
            </p>
          )}

          <section className="card card-pad">
            <Table head={<>
              <th className="th">Person</th>
              {days.map((d) => <th key={isoDay(d)} className="th text-center whitespace-nowrap">{dayLabel(d)}</th>)}
              <th className="th text-right">Total</th>
              <th className="th">Status</th>
            </>}>
              {people.map((p) => {
                const at = submittedAt.get(p.id);
                return (
                  <tr key={p.id} className="row">
                    <td className="td">
                      <span className="flex items-center gap-3">
                        <Avatar name={p.name} colour={p.colour} size={30} />
                        <span>
                          <span className="block font-semibold whitespace-nowrap">{p.name}</span>
                          {p.jobTitle && <span className="block text-xs text-ink-faint">{p.jobTitle}</span>}
                        </span>
                      </span>
                    </td>
                    {days.map((d) => {
                      const e = entryFor.get(`${p.id}|${isoDay(d)}`);
                      return (
                        <td key={isoDay(d)} className="td text-center align-top" title={e?.note || undefined}>
                          {e ? (
                            <>
                              <span className="block font-semibold tabular-nums">{formatHours(e.workedMinutes)}</span>
                              <span className="block text-[11px] text-ink-faint whitespace-nowrap">
                                {e.startTime}–{e.endTime}{e.breakMinutes > 0 && ` · ${e.breakMinutes}m brk`}
                              </span>
                            </>
                          ) : <span className="text-ink-faint">—</span>}
                        </td>
                      );
                    })}
                    <td className="td text-right font-bold tabular-nums">{formatHours(totalFor(p.id))}</td>
                    <td className="td whitespace-nowrap">
                      {at ? <Pill tone="good">Handed in {shortDate(at)}</Pill>
                        : weekOver ? <Pill tone="warn">Not handed in</Pill>
                        : <Pill tone="neutral">In progress</Pill>}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </section>
        </>
      )}
    </Shell>
  );
}

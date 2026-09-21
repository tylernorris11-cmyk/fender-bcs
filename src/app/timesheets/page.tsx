import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate } from '@/lib/format';
import { addDays, isoDay, isWeekend, parseDayInput } from '@/lib/holidays';
import { dayLabel, dueWeekMonday, mondayOf, reminderStage, todayInLondon, weekDays, weekRangeLabel } from '@/lib/timesheets';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { TimesheetWeekForm, type TimesheetDay } from './TimesheetWeekForm';

export default async function TimesheetPage({ searchParams }: { searchParams: { week?: string } }) {
  const user = await requirePermission('timesheets.view');
  const alerts = await getAlerts(user);
  const today = todayInLondon();

  const thisMonday = mondayOf(today);
  const monday = mondayOf(parseDayInput(searchParams.week ?? '') ?? thisMonday);
  const prev = isoDay(addDays(monday, -7));
  const next = isoDay(addDays(monday, 7));
  const dueMonday = dueWeekMonday(today);

  const [entries, submitted] = await Promise.all([
    db.timesheetEntry.findMany({ where: { userId: user.id, date: { gte: monday, lte: addDays(monday, 6) } } }),
    db.timesheetWeek.findUnique({ where: { userId_weekStart: { userId: user.id, weekStart: monday } } }),
  ]);
  const byDate = new Map(entries.map((e) => [isoDay(e.date), e]));

  const days: TimesheetDay[] = weekDays(monday).map((date) => {
    const e = byDate.get(isoDay(date));
    return {
      iso: isoDay(date),
      label: dayLabel(date),
      future: date > today,
      weekend: isWeekend(date),
      startTime: e?.startTime ?? '',
      endTime: e?.endTime ?? '',
      breakMinutes: e ? String(e.breakMinutes) : '',
      note: e?.note ?? '',
    };
  });

  const weekOver = addDays(monday, 6) < today;
  const isDueWeek = isoDay(monday) === isoDay(dueMonday);

  return (
    <Shell user={user} module="timesheets" nav={NAV.timesheets} current="/timesheets" alerts={alerts.length}>
      <PageHeader
        title="My timesheet"
        blurb="Your start, finish and breaks for each day you were in. Fill in last week's every Wednesday and hand it in."
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link href={`/timesheets?week=${prev}`} className="btn-secondary btn-sm" aria-label="Previous week"><ChevronLeft size={16} /></Link>
        <h2 className="text-lg font-bold">{weekRangeLabel(monday)}</h2>
        <Link href={`/timesheets?week=${next}`} className="btn-secondary btn-sm" aria-label="Next week"><ChevronRight size={16} /></Link>
        {isoDay(monday) !== isoDay(thisMonday) && <Link href="/timesheets" className="text-sm text-brand-700 underline">This week</Link>}
        {submitted
          ? <Pill tone="good">Handed in {shortDate(submitted.submittedAt)}</Pill>
          : weekOver
            ? <Pill tone={isDueWeek ? 'warn' : 'neutral'}>{isDueWeek ? (reminderStage(today) === 'overdue' ? 'Overdue — not handed in' : 'Due Wednesday — not handed in') : 'Not handed in'}</Pill>
            : <Pill tone="neutral">Week in progress</Pill>}
      </div>

      <section className="card card-pad">
        <TimesheetWeekForm
          key={isoDay(monday)}
          week={isoDay(monday)}
          days={days}
          canSubmit={weekOver}
          submittedLabel={submitted ? `Handed in ${shortDate(submitted.submittedAt)}` : null}
        />
      </section>
      <p className="text-xs text-ink-faint mt-3">
        Leave a day blank if you weren&apos;t in. Breaks are unpaid time taken out of the day, in minutes.
      </p>
    </Shell>
  );
}

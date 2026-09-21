import { db } from '@/lib/db';
import { can, type SessionUser } from '@/lib/rbac';
import { isoDay } from '@/lib/holidays';
import { dueWeekMonday, todayInLondon, weekRangeLabel } from '@/lib/timesheets';
import { TimesheetReminderModal } from './TimesheetReminderModal';

/**
 * Timesheets are due every Wednesday for the week before. From Tuesday
 * (a day's warning) until they've handed that week in, anyone on timesheets
 * gets a pop-up on whatever page they open. It only appears for people ticked on timesheets —
 * anyone who isn't never sees it.
 */
export async function TimesheetReminder({ user }: { user: SessionUser }) {
  if (!can(user, 'timesheets.view')) return null;

  const today = todayInLondon();
  const week = dueWeekMonday(today);
  const handedIn = await db.timesheetWeek.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: week } },
    select: { id: true },
  });
  if (handedIn) return null;

  return (
    <TimesheetReminderModal
      weekLabel={weekRangeLabel(week)}
      href={`/timesheets?week=${isoDay(week)}`}
      when={today.getUTCDay() === 2 ? 'tomorrow' : today.getUTCDay() === 3 ? 'today' : 'overdue'}
      dismissKey={`timesheet-reminder:${user.id}:${isoDay(week)}:${isoDay(today)}`}
    />
  );
}

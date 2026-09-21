'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { addDays, isoDay, parseDayInput } from '@/lib/holidays';
import { dayLabel, formatHours, isZeroDay, mondayOf, todayInLondon, weekDays, workedMinutes } from '@/lib/timesheets';

export type SaveWeekResult = { ok: true; message: string } | { ok: false; error: string };

/** Saves a whole week in one go — every day's start, finish and break — and,
 * for the "Submit week" button, also marks the week as handed in (which is
 * what stops the Wednesday pop-up). Returns errors rather than throwing so
 * the form can show them next to the day they're about. */
export async function saveTimesheetWeek(formData: FormData): Promise<SaveWeekResult> {
  const user = await assertPermission('timesheets.view');

  const requested = parseDayInput(String(formData.get('week') ?? ''));
  if (!requested) return { ok: false, error: 'That week could not be read — reload the page and try again.' };
  const monday = mondayOf(requested);
  const submitting = formData.get('intent') === 'submit';
  const today = todayInLondon();

  const toSave: { date: Date; startTime: string; endTime: string; breakMinutes: number; workedMinutes: number; note: string }[] = [];
  const toClear: Date[] = [];
  let total = 0;

  for (const date of weekDays(monday)) {
    const key = isoDay(date);
    const startTime = String(formData.get(`start_${key}`) ?? '').trim();
    const endTime = String(formData.get(`end_${key}`) ?? '').trim();
    const breakRaw = String(formData.get(`break_${key}`) ?? '').trim();
    const note = String(formData.get(`note_${key}`) ?? '').trim().slice(0, 300);

    if (!startTime && !endTime && !breakRaw) {
      toClear.push(date);
      continue;
    }
    // A day off (00:00 to 00:00). Nothing to record unless they've said why —
    // "Holiday" or "Sick" on a zero day is kept as a zero-hour entry.
    if (isZeroDay(startTime, endTime, breakRaw)) {
      if (note) toSave.push({ date, startTime: '00:00', endTime: '00:00', breakMinutes: 0, workedMinutes: 0, note });
      else toClear.push(date);
      continue;
    }
    if (date > today) return { ok: false, error: `${dayLabel(date)} hasn't happened yet — leave it blank until you've worked it.` };
    if (!startTime || !endTime) return { ok: false, error: `${dayLabel(date)}: fill in both a start and a finish time, or clear the day.` };

    const breakMinutes = breakRaw === '' ? 0 : Number(breakRaw);
    const result = workedMinutes(startTime, endTime, breakMinutes);
    if ('error' in result) return { ok: false, error: `${dayLabel(date)}: ${result.error}` };

    total += result.minutes;
    toSave.push({ date, startTime, endTime, breakMinutes, workedMinutes: result.minutes, note });
  }

  if (submitting && addDays(monday, 6) >= today) {
    return { ok: false, error: 'You can hand a week in once it has finished — save it for now and submit it from Monday.' };
  }

  await db.$transaction([
    ...toSave.map((e) =>
      db.timesheetEntry.upsert({
        where: { userId_date: { userId: user.id, date: e.date } },
        create: { userId: user.id, ...e },
        update: e,
      }),
    ),
    db.timesheetEntry.deleteMany({ where: { userId: user.id, date: { in: toClear } } }),
    ...(submitting
      ? [db.timesheetWeek.upsert({
          where: { userId_weekStart: { userId: user.id, weekStart: monday } },
          create: { userId: user.id, weekStart: monday },
          update: {},
        })]
      : []),
  ]);

  await logActivity(
    'Timesheet', user.id, submitting ? 'Submitted week' : 'Saved week',
    `w/c ${isoDay(monday)} — ${formatHours(total)} over ${toSave.length} day${toSave.length === 1 ? '' : 's'}`,
    user.id,
  );
  revalidatePath('/timesheets');
  revalidatePath('/timesheets/team');

  return { ok: true, message: submitting ? `Week handed in — ${formatHours(total)} in total.` : `Saved — ${formatHours(total)} this week so far.` };
}

/** Sets exactly who fills in a timesheet, for the people the caller can manage. Everyone not ticked is taken off (they clock in instead). */
export async function updateTimesheetPeople(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userIds = formData.getAll('userIds').map(String);
  const targets = await db.user.findMany({ where: { id: { in: userIds } } });
  const ticked = new Set(formData.getAll('onTimesheets').map(String));

  for (const target of targets) {
    if (admin.role !== 'MASTER_ADMIN') {
      if (target.role === 'MASTER_ADMIN') throw new Error('Only a Master Administrator can manage that account.');
      if (!target.companies.some((c) => admin.companies.includes(c))) throw new Error('You can only manage people within your own company.');
    }
  }

  const changed = targets.filter((t) => t.onTimesheets !== ticked.has(t.id));
  await db.$transaction(changed.map((t) => db.user.update({ where: { id: t.id }, data: { onTimesheets: ticked.has(t.id) } })));
  for (const t of changed) {
    await logActivity('User', t.id, ticked.has(t.id) ? 'Put on timesheets' : 'Taken off timesheets', '', admin.id);
  }
  revalidatePath('/timesheets/people');
  revalidatePath('/timesheets');
  revalidatePath('/timesheets/team');
}

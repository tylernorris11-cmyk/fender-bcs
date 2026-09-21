import { addDays, isoDay, parseDayInput, toUtcDay } from './holidays';

/** Today's calendar date in the UK as UTC midnight — the server runs in UTC, so a plain `new Date()` reads as yesterday for the hour after midnight in summer. */
export function todayInLondon(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parseDayInput(parts) ?? toUtcDay(now);
}

/** Monday (UTC midnight) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const day = toUtcDay(d);
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}

/** Seven days, Monday first. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Timesheets are due the Wednesday after the week they cover, and people
 * are prompted from the Tuesday before. This is the week the reminder is
 * about right now: the previous week as of the most recent Tuesday. It
 * rolls over each Tuesday, so a week nobody filled in is nagged about from
 * that Tuesday until the next one.
 */
export function dueWeekMonday(today: Date): Date {
  const daysSinceTuesday = (today.getUTCDay() + 5) % 7; // Tue = 0 ... Mon = 6
  const mostRecentTuesday = addDays(today, -daysSinceTuesday);
  return addDays(mostRecentTuesday, -8);
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseMinutes(hhmm: string): number | null {
  const m = TIME.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Worked minutes for a day, or an error message a person can act on. */
export function workedMinutes(start: string, end: string, breakMinutes: number): { minutes: number } | { error: string } {
  const s = parseMinutes(start);
  const e = parseMinutes(end);
  if (s === null || e === null) return { error: 'Enter start and finish as times, like 07:30.' };
  if (e <= s) return { error: 'Finish has to be after start.' };
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return { error: 'Breaks are a whole number of minutes.' };
  if (breakMinutes >= e - s) return { error: 'Breaks are longer than the time you were in.' };
  return { minutes: e - s - breakMinutes };
}

/** 510 -> "8h 30m", 480 -> "8h", 0 -> "0h". */
export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0 && m === 0) return '0h';
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}

export const weekParam = (monday: Date) => isoDay(monday);

/** "Mon 14 Sep" */
export function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "14 Sep – 20 Sep 2026" for a Monday. */
export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const short = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${short(monday)} – ${short(sunday)} ${sunday.getUTCFullYear()}`;
}

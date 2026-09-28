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
 * Timesheets are due the Wednesday after the week they cover, and people can
 * fill them in — and are prompted to — from the Monday. This is the week the
 * reminder is about right now: the previous week as of the most recent
 * Monday. It rolls over each Monday, so a week nobody handed in is nagged
 * about from that Monday until the next one.
 */
export function dueWeekMonday(today: Date): Date {
  const daysSinceMonday = (today.getUTCDay() + 6) % 7; // Mon = 0 ... Sun = 6
  const mostRecentMonday = addDays(today, -daysSinceMonday);
  return addDays(mostRecentMonday, -7);
}

export type ReminderStage = 'ready' | 'tomorrow' | 'today' | 'overdue';

/** Monday: ready to fill in (due Wednesday). Tuesday: due tomorrow. Wednesday: due today. Thursday on: overdue. */
export function reminderStage(today: Date): ReminderStage {
  const day = today.getUTCDay();
  return day === 1 ? 'ready' : day === 2 ? 'tomorrow' : day === 3 ? 'today' : 'overdue';
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseMinutes(hhmm: string): number | null {
  const m = TIME.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 00:00 to 00:00 with no break — how a day off is shown on the form. It's a day with nothing worked, not a shift, so it's never saved. */
export function isZeroDay(start: string, end: string, breakValue: string | number): boolean {
  return start === '00:00' && end === '00:00' && Number(breakValue || 0) === 0;
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

export type ShiftTimes = { startTime: string; endTime: string; breakMinutes: number };
export type TimeOff = { note: string; half: boolean };
export type PrefilledDay = ShiftTimes & { note: string };

const LOOK_BACK_WEEKS = 4;

/**
 * What a week nobody's touched yet starts as. Each day copies the same
 * weekday the week before; if that day was time off (a booked holiday or a
 * bank holiday), or that week was never filled in at all, it looks another
 * week back, so neither carries forward. Time off this week starts as a day off with the reason
 * noted, and a half day copies the usual hours with a note to trim them.
 * Days that haven't happened yet are left alone, and notes aren't copied —
 * they're about that particular day.
 */
export function prefillWeek(
  monday: Date,
  today: Date,
  history: Map<string, ShiftTimes>,
  timeOff: (d: Date) => TimeOff | null,
): Map<string, PrefilledDay> {
  const out = new Map<string, PrefilledDay>();
  const filledWeeks = new Set([...history.keys()].map((iso) => isoDay(mondayOf(parseDayInput(iso)!))));
  for (const date of weekDays(monday)) {
    if (date > today) continue;
    const off = timeOff(date);
    if (off && !off.half) {
      out.set(isoDay(date), { startTime: '00:00', endTime: '00:00', breakMinutes: 0, note: off.note });
      continue;
    }

    let usual: ShiftTimes | undefined;
    for (let back = 1; back <= LOOK_BACK_WEEKS; back++) {
      const earlier = addDays(date, -7 * back);
      if (timeOff(earlier) || !filledWeeks.has(isoDay(mondayOf(earlier)))) continue;
      usual = history.get(isoDay(earlier));
      break;
    }
    const worked = usual && !isZeroDay(usual.startTime, usual.endTime, usual.breakMinutes);

    if (worked) out.set(isoDay(date), { ...usual!, note: off?.note ?? '' });
    else if (off) out.set(isoDay(date), { startTime: '00:00', endTime: '00:00', breakMinutes: 0, note: off.note });
  }
  return out;
}

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

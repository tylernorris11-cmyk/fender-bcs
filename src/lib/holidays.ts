/**
 * England & Wales bank holidays, worked out from the calendar rather than
 * typed into a list, so nobody has to remember to top it up every December.
 * Both depots — Scunthorpe and Houghton le Spring — are in England, so the
 * England & Wales set is the right one.
 *
 * Holiday dates are handled as UTC midnight throughout. They are dates, not
 * moments, and doing it this way stops a request booked in British Summer
 * Time landing on the day before once it is read back.
 */

export const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Midnight UTC on the same calendar day, whatever came in. */
export const toUtcDay = (d: Date) => utcDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Parse a yyyy-mm-dd form value without the browser's timezone shifting it. */
export function parseDayInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = utcDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Anonymous Gregorian computus — Easter Sunday for any year. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDay(year, month - 1, day);
}

const firstMondayOf = (year: number, month: number) => {
  const first = utcDay(year, month, 1);
  return addDays(first, (8 - first.getUTCDay()) % 7);
};

const lastMondayOf = (year: number, month: number) => {
  const last = utcDay(year, month + 1, 0);
  return addDays(last, -((last.getUTCDay() + 6) % 7));
};

const cache = new Map<number, Map<string, string>>();

/** Every England & Wales bank holiday in a year, keyed by yyyy-mm-dd. */
export function bankHolidaysFor(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const out = new Map<string, string>();
  const taken = new Set<string>();

  // These always land on a weekday already.
  const moveable: [Date, string][] = [
    [addDays(easter, -2), 'Good Friday'],
    [addDays(easter, 1), 'Easter Monday'],
    [firstMondayOf(year, 4), 'Early May bank holiday'],
    [lastMondayOf(year, 4), 'Spring bank holiday'],
    [lastMondayOf(year, 7), 'Summer bank holiday'],
  ];
  for (const [d, name] of moveable) {
    out.set(isoDay(d), name);
    taken.add(isoDay(d));
  }

  // A fixed-date holiday landing on a weekend moves to the next free weekday.
  // Ones already on a weekday are claimed first — that is what keeps Boxing Day
  // on the Monday and pushes Christmas to the Tuesday when Christmas is a Sunday.
  const fixed: [Date, string][] = [
    [utcDay(year, 0, 1), "New Year's Day"],
    [utcDay(year, 11, 25), 'Christmas Day'],
    [utcDay(year, 11, 26), 'Boxing Day'],
  ];
  fixed.sort((a, b) => Number(isWeekend(a[0])) - Number(isWeekend(b[0])));

  for (const [date, name] of fixed) {
    let day = date;
    while (isWeekend(day) || taken.has(isoDay(day))) day = addDays(day, 1);
    const moved = isoDay(day) !== isoDay(date);
    out.set(isoDay(day), moved ? `${name} (substitute day)` : name);
    taken.add(isoDay(day));
  }

  cache.set(year, out);
  return out;
}

/** The bank holiday falling on this day, or null. */
export const bankHolidayName = (d: Date): string | null =>
  bankHolidaysFor(d.getUTCFullYear()).get(isoDay(d)) ?? null;

/** A day someone would otherwise have been at work. */
export const isWorkingDay = (d: Date) => !isWeekend(d) && !bankHolidayName(d);

export function eachDayInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = toUtcDay(start); d <= toUtcDay(end); d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * How much holiday a request actually costs someone: weekends and bank
 * holidays are not deducted, because they were never working days.
 */
export const workingDaysBetween = (start: Date, end: Date) =>
  eachDayInclusive(start, end).filter(isWorkingDay).length;

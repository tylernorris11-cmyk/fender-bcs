/**
 * Turning the rows read off a customer's bar schedule (BS 8666) into bending
 * schedule lines, with duplicates added together. Kept free of the AI call
 * and the database so it can be checked on its own.
 *
 * A duplicate is the same bar mark with exactly the same bar: grade, size,
 * shape, cutting length and every dimension. Schedules repeat a mark when
 * it's used in several members, or when a page is printed twice; those are
 * added together into one line. The same mark with a different bar is not a
 * duplicate — both are kept and flagged for someone to check.
 */

/** One row as read off the schedule page, before anything's added up. */
export type ScheduleReading = {
  page: number;
  mark: string;
  grade: string;
  dia: number;
  members: number; // number of members (1 when the column is blank)
  each: number; // number of bars in each member
  total: number; // total number of bars as printed (0 when not printed)
  length: number; // cutting length of each bar, mm
  shape: string;
  a: number | null;
  b: number | null;
  c: number | null;
  d: number | null;
  e: number | null;
  r: number | null; // bend radius, when the E/R column holds one
};

/** A bending schedule line, ready for the order form. */
export type ScheduleBar = {
  mark: string;
  grade: string;
  diaMm: number;
  bars: number;
  lengthMm: number;
  shapeCode: string;
  a: number | null;
  b: number | null;
  c: number | null;
  d: number | null;
  e: number | null;
  r: number | null;
  pages: number[];
  timesFound: number;
};

export type ScheduleMerge = {
  bars: ScheduleBar[];
  /** Marks that appeared more than once with the same bar, now one line. */
  duplicates: { mark: string; times: number; bars: number }[];
  /** Marks that appear with different bars: kept apart, needs checking against the drawing. */
  conflicts: string[];
  /** Marks whose printed total doesn't equal members × bars in each. The printed total is used. */
  totalMismatches: string[];
};

const markKey = (mark: string) => mark.trim().toUpperCase().replace(/\s+/g, '');

/** "1" → "01": BS 8666 shape codes are two digits. */
export const normaliseShape = (shape: string) => {
  const s = shape.trim().toUpperCase();
  return /^\d$/.test(s) ? `0${s}` : s;
};

/** How many bars a row is for: the printed total, or members × each when there isn't one. */
export function barsFor(r: Pick<ScheduleReading, 'members' | 'each' | 'total'>) {
  if (r.total > 0) return r.total;
  const members = r.members > 0 ? r.members : 1;
  return members * Math.max(0, r.each);
}

export function mergeSchedule(readings: ScheduleReading[]): ScheduleMerge {
  const byBar = new Map<string, ScheduleBar>();
  const barsByMark = new Map<string, Set<string>>();
  const totalMismatches = new Set<string>();

  for (const r of readings) {
    const mark = r.mark.trim();
    if (!mark) continue;
    const bars = barsFor(r);
    if (bars <= 0) continue;
    const members = r.members > 0 ? r.members : 1;
    if (r.total > 0 && r.each > 0 && members * r.each !== r.total) totalMismatches.add(mark);

    const bar = {
      grade: (r.grade.trim() || 'H').toUpperCase(),
      diaMm: r.dia,
      lengthMm: r.length,
      shapeCode: normaliseShape(r.shape) || '99',
      a: r.a, b: r.b, c: r.c, d: r.d, e: r.e, r: r.r,
    };
    const spec = JSON.stringify(bar);
    const key = `${markKey(mark)}|${spec}`;
    (barsByMark.get(markKey(mark)) ?? barsByMark.set(markKey(mark), new Set()).get(markKey(mark))!).add(spec);

    const existing = byBar.get(key);
    if (existing) {
      existing.bars += bars;
      existing.timesFound += 1;
      if (!existing.pages.includes(r.page)) existing.pages.push(r.page);
    } else {
      byBar.set(key, { mark, ...bar, bars, pages: [r.page], timesFound: 1 });
    }
  }

  // In the order marks first appear, with every line for the same mark kept
  // together, so a mark that came back with two different bars sits side by
  // side for checking.
  const markOrder = [...barsByMark.keys()];
  const merged = [...byBar.values()].sort((x, y) => markOrder.indexOf(markKey(x.mark)) - markOrder.indexOf(markKey(y.mark)));
  return {
    bars: merged,
    duplicates: merged.filter((b) => b.timesFound > 1).map((b) => ({ mark: b.mark, times: b.timesFound, bars: b.bars })),
    conflicts: [...barsByMark.entries()].filter(([, specs]) => specs.size > 1).map(([k]) => merged.find((b) => markKey(b.mark) === k)!.mark),
    totalMismatches: [...totalMismatches],
  };
}

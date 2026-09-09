import 'server-only';
import { db } from './db';
import { holidayYearEnd, holidayYearLabel, holidayYearStart } from './holidays';

export type HolidayBalance = {
  allowance: number;
  usedPaid: number;
  adjustmentTotal: number;
  remaining: number;
};

/**
 * How many PAID days someone has left in the holiday year containing
 * `atDate` — allowance minus the paid portion of everything already
 * approved this year (the unpaid portion of a request doesn't count
 * against the allowance it already exceeded), plus any manual
 * adjustments. Shared by the Holidays page (a person's own balance) and
 * requestHoliday (deciding how much of a new request is unpaid), so the
 * two never drift apart.
 */
export async function holidayBalance(userId: string, atDate: Date): Promise<HolidayBalance> {
  const yearStart = holidayYearStart(atDate);
  const yearEnd = holidayYearEnd(atDate);
  const yearLabel = holidayYearLabel(atDate);

  const [approved, adjustments, userRecord] = await Promise.all([
    db.holidayRequest.findMany({
      where: { userId, status: 'APPROVED', startDate: { gte: yearStart, lte: yearEnd } },
      select: { workingDays: true, unpaidDays: true },
    }),
    db.holidayAdjustment.findMany({ where: { userId, year: yearLabel }, select: { days: true } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { holidayAllowanceDays: true } }),
  ]);

  const usedPaid = approved.reduce((s, r) => s + (r.workingDays - r.unpaidDays), 0);
  const adjustmentTotal = adjustments.reduce((s, a) => s + a.days, 0);
  const remaining = userRecord.holidayAllowanceDays - usedPaid + adjustmentTotal;

  return { allowance: userRecord.holidayAllowanceDays, usedPaid, adjustmentTotal, remaining };
}

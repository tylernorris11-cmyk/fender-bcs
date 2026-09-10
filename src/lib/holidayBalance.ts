import 'server-only';
import { db } from './db';
import { bankHolidayCountBetween, holidayYearEnd, holidayYearLabel, holidayYearStart } from './holidays';

export type HolidayBalance = {
  allowance: number;
  usedPaid: number;
  adjustmentTotal: number;
  remaining: number;
  accrued: number;
  accrualBalance: number;
};

/**
 * How many PAID days someone has left in the holiday year containing
 * `atDate` — allowance minus the paid portion of everything already
 * approved this year (the unpaid portion of a request doesn't count
 * against the allowance it already exceeded), plus any manual
 * adjustments. Shared by the Holidays page (a person's own balance) and
 * requestHoliday (deciding how much of a new request is unpaid), so the
 * two never drift apart.
 *
 * Also works out accrual — the yearly allowance is all there from day
 * one, but booking is only meant to happen against what's actually been
 * accrued so far: the allowance minus bank holidays (never booked, never
 * accrued towards), split evenly across 12 months, credited at the start
 * of each month rather than only once it's finished. accrualBalance is
 * allowed to go negative — approving a request ahead of accrual is a
 * deliberate call someone can make, this just tracks the debt it leaves,
 * same as an overdrawn account rather than a blocked one.
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

  const bankHolidays = bankHolidayCountBetween(yearStart, yearEnd);
  const bookableAllowance = Math.max(0, userRecord.holidayAllowanceDays - bankHolidays);
  const accrualPerMonth = bookableAllowance / 12;
  const monthsElapsed = Math.min(
    12,
    (atDate.getUTCFullYear() - yearStart.getUTCFullYear()) * 12 + (atDate.getUTCMonth() - yearStart.getUTCMonth()) + 1,
  );
  const accrued = Math.round(accrualPerMonth * monthsElapsed * 100) / 100;
  const accrualBalance = Math.round((accrued - usedPaid + adjustmentTotal) * 100) / 100;

  return { allowance: userRecord.holidayAllowanceDays, usedPaid, adjustmentTotal, remaining, accrued, accrualBalance };
}

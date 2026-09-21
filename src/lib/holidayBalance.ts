import 'server-only';
import { db } from './db';
import { bankHolidayCountBetween, holidayYearEnd, holidayYearLabel, holidayYearStart, parseDayInput, workingDaysBetween } from './holidays';
import { todayInLondon } from './timesheets';

/** Setting holding the date (yyyy-mm-dd) from which bank holidays come off people's remaining days. Balances were set by hand before this existed, so they already account for every bank holiday up to then — counting from 1 April would take each one off twice. Unset means bank holidays aren't taken off at all. */
export const BANK_HOLIDAYS_FROM_KEY = 'holidayBankHolidaysFrom';

export type HolidayBalance = {
  allowance: number;
  /** Paid days on every approved request in the year — taken and booked ahead together. */
  usedPaid: number;
  adjustmentTotal: number;
  /** Bank holidays that have gone by since they started coming off (see BANK_HOLIDAYS_FROM_KEY). */
  bankHolidaysPassed: number;
  /** Paid holiday days that have already gone by. */
  takenPaid: number;
  /** Paid days approved for later — not yet taken. */
  bookedAhead: number;
  /** What's left today: allowance, less bank holidays and holiday days as they pass. */
  remaining: number;
  /** What can still be booked without going unpaid: remaining, less what's already booked ahead. */
  leftToBook: number;
  accrued: number;
  accrualBalance: number;
};

/**
 * How many PAID days someone has left in the holiday year containing
 * `atDate`. The yearly allowance includes bank holidays, and days come off
 * it as they PASS, not when they're booked: each day of approved holiday
 * comes off when it arrives, and so does each bank holiday from the date in
 * BANK_HOLIDAYS_FROM_KEY onwards. `remaining` is
 * therefore what's left today; days booked for later sit in `bookedAhead`
 * until they arrive, and `leftToBook` is what a new request is checked
 * against, so someone can't book past what they have. Manual adjustments
 * are folded in. Shared by the Holidays page and requestHoliday (deciding
 * how much of a new request is unpaid), so the two never drift apart.
 *
 * Also works out accrual — the yearly allowance is all there from day
 * one, but booking is only meant to happen against what's actually been
 * accrued so far: the allowance minus bank holidays (never booked, never
 * accrued towards), split evenly across 12 months, credited at the start
 * of each month rather than only once it's finished. accrualBalance is
 * allowed to go negative — approving a request ahead of accrual is a
 * deliberate call someone can make, this just tracks the debt it leaves,
 * same as an overdrawn account rather than a blocked one. It counts
 * everything booked, taken or not, since that's the debt.
 */
export async function holidayBalance(userId: string, atDate: Date): Promise<HolidayBalance> {
  const yearStart = holidayYearStart(atDate);
  const yearEnd = holidayYearEnd(atDate);
  const yearLabel = holidayYearLabel(atDate);
  const today = todayInLondon();
  const started = today >= yearStart;
  const passedTo = today > yearEnd ? yearEnd : today;

  const [approved, adjustments, userRecord, bankFromSetting] = await Promise.all([
    db.holidayRequest.findMany({
      where: { userId, status: 'APPROVED', startDate: { gte: yearStart, lte: yearEnd } },
      select: { startDate: true, endDate: true, half: true, workingDays: true, unpaidDays: true },
    }),
    db.holidayAdjustment.findMany({ where: { userId, year: yearLabel }, select: { days: true } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { holidayAllowanceDays: true, bankHolidaysComeOff: true } }),
    db.setting.findUnique({ where: { key: BANK_HOLIDAYS_FROM_KEY } }),
  ]);

  const usedPaid = approved.reduce((s, r) => s + (r.workingDays - r.unpaidDays), 0);
  // Any unpaid days on a request are taken to be its last ones — it only
  // went unpaid by running past the allowance, at the end.
  const takenPaid = approved.reduce((sum, r) => {
    if (!started || r.startDate > passedTo) return sum;
    const elapsed = r.half ? r.workingDays : workingDaysBetween(r.startDate, r.endDate < passedTo ? r.endDate : passedTo);
    return sum + Math.min(elapsed, r.workingDays - r.unpaidDays);
  }, 0);
  const adjustmentTotal = adjustments.reduce((s, a) => s + a.days, 0);
  const bankFrom = bankFromSetting ? parseDayInput(bankFromSetting.value) : null;
  const bankStart = bankFrom && bankFrom > yearStart ? bankFrom : yearStart;
  const bankHolidaysPassed = userRecord.bankHolidaysComeOff && started && bankFrom && bankStart <= passedTo ? bankHolidayCountBetween(bankStart, passedTo) : 0;
  const bookedAhead = usedPaid - takenPaid;
  const remaining = userRecord.holidayAllowanceDays - bankHolidaysPassed - takenPaid + adjustmentTotal;
  const leftToBook = remaining - bookedAhead;

  const bankHolidays = bankHolidayCountBetween(yearStart, yearEnd);
  const bookableAllowance = Math.max(0, userRecord.holidayAllowanceDays - bankHolidays);
  const accrualPerMonth = bookableAllowance / 12;
  const monthsElapsed = Math.min(
    12,
    (atDate.getUTCFullYear() - yearStart.getUTCFullYear()) * 12 + (atDate.getUTCMonth() - yearStart.getUTCMonth()) + 1,
  );
  const accrued = Math.round(accrualPerMonth * monthsElapsed * 100) / 100;
  const accrualBalance = Math.round((accrued - usedPaid + adjustmentTotal) * 100) / 100;

  return {
    allowance: userRecord.holidayAllowanceDays, usedPaid, adjustmentTotal,
    bankHolidaysPassed, takenPaid, bookedAhead, remaining, leftToBook, accrued, accrualBalance,
  };
}

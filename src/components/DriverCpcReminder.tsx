import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/rbac';
import { isoDay } from '@/lib/holidays';
import { todayInLondon } from '@/lib/timesheets';
import { DriverCpcReminderModal } from './DriverCpcReminderModal';

/**
 * For anyone on the Drivers register (see setup/drivers) with no CPC expiry
 * date on file — a pop-up on whatever page they open, asking for it
 * directly, until they give it or dismiss it for the day. Nobody not on the
 * register sees this; ensureDriverRecords is what puts someone with the
 * Driver role on it in the first place.
 */
export async function DriverCpcReminder({ user }: { user: SessionUser }) {
  const driver = await db.driver.findUnique({ where: { userId: user.id }, select: { cpcExpiry: true } });
  if (!driver || driver.cpcExpiry) return null;

  const today = isoDay(todayInLondon());
  return <DriverCpcReminderModal dismissKey={`driver-cpc-reminder:${user.id}:${today}`} />;
}

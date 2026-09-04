import 'server-only';
import { db } from './db';

/** Anyone given the Driver role should show up on the Drivers register
 * automatically, without an admin having to remember to add them by hand —
 * their entry just starts with none of the licence/CPC detail on file. */
export async function ensureDriverRecords() {
  const users = await db.user.findMany({
    where: { role: 'DRIVER', active: true, driver: null },
    select: { id: true, name: true },
  });
  if (users.length === 0) return;
  await db.driver.createMany({
    data: users.map((u) => ({ name: u.name, userId: u.id, depot: '' })),
  });
}

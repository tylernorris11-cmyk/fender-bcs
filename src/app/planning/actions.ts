'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';

/** Marks a stand-alone delivery entry (one not tied to a real Order) as
 * delivered, so it greys out on the planning board. */
export async function markEventDelivered(formData: FormData) {
  const user = await assertPermission('orders.progress');
  const eventId = String(formData.get('eventId'));
  const event = await db.planningEvent.update({ where: { id: eventId }, data: { done: true } });
  await logActivity('PlanningEvent', eventId, 'Marked delivered', event.title, user.id);
  revalidatePath('/planning');
}

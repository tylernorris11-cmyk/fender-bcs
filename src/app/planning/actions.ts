'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { DeliveryColour } from '@prisma/client';
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

const DELIVERY_COLOURS: DeliveryColour[] = ['BLUE', 'RED', 'BLACK', 'GREEN'];

/** Adds a stand-alone delivery to the board — one that isn't a real Sales
 * Order, for the odd job that needs planning in without going through the
 * whole order flow. Deliberately light: a customer name, where it's going,
 * roughly what it weighs, who's running it and a colour to spot it by. */
export async function createDelivery(formData: FormData) {
  const user = await assertPermission('planning.edit');

  const customerName = String(formData.get('customerName') ?? '').trim();
  if (!customerName) throw new Error('Give it a customer name.');
  const town = String(formData.get('town') ?? '').trim();
  if (!town) throw new Error('Give it a delivery location.');

  const dateRaw = String(formData.get('date') ?? '');
  if (!dateRaw) throw new Error('Pick a date.');
  const timeRaw = String(formData.get('time') ?? '').trim();
  const startsAt = new Date(timeRaw ? `${dateRaw}T${timeRaw}:00` : `${dateRaw}T00:00:00`);
  if (Number.isNaN(startsAt.getTime())) throw new Error('That date could not be read.');

  const weightRaw = String(formData.get('weightTonnes') ?? '').trim();
  const weightKg = weightRaw ? Number(weightRaw) * 1000 : null;
  if (weightRaw && (!Number.isFinite(weightKg) || weightKg! < 0)) throw new Error('Enter the weight in tonnes, e.g. 2.4.');

  const colourRaw = String(formData.get('colour') ?? 'BLUE') as DeliveryColour;
  const colour = DELIVERY_COLOURS.includes(colourRaw) ? colourRaw : 'BLUE';

  const driverId = String(formData.get('driverId') ?? '') || null;
  if (driverId) {
    const driver = await db.driver.findUniqueOrThrow({ where: { id: driverId } });
    if (!driver.active) throw new Error('That driver is no longer active.');
  }

  const event = await db.planningEvent.create({
    data: {
      title: `Deliver to ${customerName}`,
      type: 'DELIVERY',
      startsAt,
      allDay: !timeRaw,
      town,
      weightKg,
      colour,
      driverId,
    },
  });
  await logActivity('PlanningEvent', event.id, 'Delivery added', `${customerName} — ${town}`, user.id);
  revalidatePath('/planning');
  redirect(`/planning?view=day&date=${dateRaw}`);
}

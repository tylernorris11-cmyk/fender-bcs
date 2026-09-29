'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { DeliveryColour } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { clock, isoDateUk, shortDate, ukTimeToUtc } from '@/lib/format';

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
  // A bare "yyyy-mm-dd" is safely UTC-midnight on its own (see ukTimeToUtc's
  // own comment for why a specific time needs converting explicitly instead).
  const startsAt = timeRaw ? ukTimeToUtc(dateRaw, timeRaw) : new Date(dateRaw);
  if (Number.isNaN(startsAt.getTime())) throw new Error('That date could not be read.');

  const weightRaw = String(formData.get('weightTonnes') ?? '').trim();
  const weightKg = Number(weightRaw) * 1000;
  if (!weightRaw || !Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Enter the weight in tonnes, e.g. 2.4. Every delivery needs one.');

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
      hiab: formData.get('hiab') === 'on',
    },
  });
  await logActivity('PlanningEvent', event.id, 'Delivery added', `${customerName} — ${town}`, user.id);
  revalidatePath('/planning');
  redirect(`/planning?view=day&date=${dateRaw}`);
}

/** Changes the date, driver or hiab on a stand-alone delivery already on
 * the board. Only applies to a stand-alone delivery (see createDelivery);
 * a real Order has none of these fields to change here. */
export async function updateDelivery(formData: FormData) {
  const user = await assertPermission('planning.edit');
  const eventId = String(formData.get('eventId'));

  const event = await db.planningEvent.findUniqueOrThrow({ where: { id: eventId } });
  if (event.type !== 'DELIVERY' || event.orderId) throw new Error('Only a stand-alone delivery can be changed here.');

  const driverId = String(formData.get('driverId') ?? '') || null;
  let driverName = 'Not assigned';
  if (driverId) {
    const driver = await db.driver.findUniqueOrThrow({ where: { id: driverId } });
    if (!driver.active) throw new Error('That driver is no longer active.');
    driverName = driver.name;
  }

  // Moving the date keeps a timed delivery at the same UK time on the new day.
  const dateRaw = String(formData.get('date') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) throw new Error('Pick a date.');
  const startsAt = event.allDay ? new Date(dateRaw) : ukTimeToUtc(dateRaw, clock(event.startsAt));
  if (Number.isNaN(startsAt.getTime())) throw new Error('That date could not be read.');
  const moved = dateRaw !== isoDateUk(event.startsAt);
  const hiab = formData.get('hiab') === 'on';

  await db.planningEvent.update({ where: { id: eventId }, data: { driverId, startsAt, hiab } });
  const changes = [
    ...(moved ? [`moved from ${shortDate(event.startsAt)} to ${shortDate(startsAt)}`] : []),
    ...(driverId !== event.driverId ? [`driver ${driverName}`] : []),
    ...(hiab !== event.hiab ? [hiab ? 'needs a hiab' : 'no hiab needed'] : []),
  ];
  if (changes.length) await logActivity('PlanningEvent', eventId, 'Delivery updated', `${event.title} — ${changes.join(', ')}`, user.id);
  revalidatePath('/planning');
  revalidatePath(`/planning/deliveries/${eventId}`);
}

/** Takes a stand-alone delivery off the board for good — put on by mistake,
 * or cancelled. What it was is kept in the activity log, since the delivery
 * itself is gone. A real Order's delivery isn't removed here; that follows
 * the order. */
export async function deleteDelivery(formData: FormData) {
  const user = await assertPermission('planning.edit');
  const eventId = String(formData.get('eventId'));

  const event = await db.planningEvent.findUniqueOrThrow({ where: { id: eventId }, include: { driver: { select: { name: true } } } });
  if (event.type !== 'DELIVERY' || event.orderId) throw new Error('Only a stand-alone delivery can be deleted here.');

  await db.planningEvent.delete({ where: { id: eventId } });
  const details = [
    shortDate(event.startsAt),
    event.town,
    event.weightKg != null ? `${Number(event.weightKg) / 1000} t` : '',
    event.driver ? `driver ${event.driver.name}` : '',
    event.hiab ? 'hiab' : '',
  ].filter(Boolean).join(', ');
  await logActivity('PlanningEvent', eventId, 'Delivery deleted', `${event.title} — ${details}`, user.id);
  revalidatePath('/planning');
  redirect(`/planning?view=day&date=${isoDateUk(event.startsAt)}`);
}

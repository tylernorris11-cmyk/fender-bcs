'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';

export async function logFuelEntry(formData: FormData) {
  const user = await assertPermission('fuel.create');

  const notOnSystem = formData.get('notOnSystem') === '1';
  const assetId = String(formData.get('assetId') ?? '');
  const otherVehicle = String(formData.get('otherVehicle') ?? '').trim();

  let vehicleLabel: string;
  if (notOnSystem) {
    if (!otherVehicle) throw new Error('Enter the vehicle’s reg or name.');
    vehicleLabel = otherVehicle;
  } else {
    if (!assetId) throw new Error('Choose a vehicle.');
    const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
    vehicleLabel = asset.name;
  }

  const mileage = Number(formData.get('mileage'));
  if (!Number.isInteger(mileage) || mileage < 0) throw new Error('Enter the mileage as a whole number.');

  const driverName = String(formData.get('driverName') ?? '').trim();
  if (!driverName) throw new Error('Enter who was driving.');

  const litresBefore = Number(formData.get('litresBefore'));
  const litresAfter = Number(formData.get('litresAfter'));
  if (!Number.isFinite(litresBefore) || !Number.isFinite(litresAfter)) throw new Error('Enter both meter readings.');
  if (litresAfter < litresBefore) {
    throw new Error('The new reading should be higher than the current reading — check you haven’t swapped them round.');
  }

  const entry = await db.fuelEntry.create({
    data: {
      assetId: notOnSystem ? null : assetId,
      otherVehicle: notOnSystem ? otherVehicle : '',
      mileage, driverName, litresBefore, litresAfter, loggedById: user.id,
    },
  });

  await logActivity('FuelEntry', entry.id, 'Fuel logged', `${(litresAfter - litresBefore).toFixed(2)} L for ${vehicleLabel}`, user.id);
  revalidatePath('/fuel');
  redirect('/fuel');
}

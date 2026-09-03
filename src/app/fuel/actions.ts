'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';

export async function logFuelEntry(formData: FormData) {
  const user = await assertPermission('fuel.create');

  const assetId = String(formData.get('assetId') ?? '');
  if (!assetId) throw new Error('Choose a vehicle.');

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

  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });

  const entry = await db.fuelEntry.create({
    data: { assetId, mileage, driverName, litresBefore, litresAfter, loggedById: user.id },
  });

  await logActivity('Asset', assetId, 'Fuel logged', `${(litresAfter - litresBefore).toFixed(2)} L for ${asset.name}`, user.id);
  revalidatePath('/fuel');
  redirect('/fuel');
}

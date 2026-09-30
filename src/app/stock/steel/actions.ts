'use server';

import { revalidatePath } from 'next/cache';
import type { SteelGauge } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';
import { GAUGE_PATH, HEAVY_GAUGE_DIAMETERS, HEAVY_GAUGE_LENGTHS, LIGHT_GAUGE_DIAMETERS, steelSizeLabel } from '@/lib/steelStock';

/** Books a coil or bundle into stock under the cast number on its tag. */
export async function addSteelStock(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  if (getActiveCompany(user) !== 'FENDER') throw new Error('Light and heavy gauge stock is a Fender Steel thing.');

  const gauge = String(formData.get('gauge')) as SteelGauge;
  if (gauge !== 'LIGHT' && gauge !== 'HEAVY') throw new Error('Choose light or heavy gauge.');

  const castNumber = String(formData.get('castNumber') ?? '').trim().toUpperCase();
  if (!castNumber) throw new Error('Enter the cast number from the tag.');

  const diameterMm = Number(formData.get('diameterMm'));
  const allowed = gauge === 'LIGHT' ? LIGHT_GAUGE_DIAMETERS : HEAVY_GAUGE_DIAMETERS;
  if (!allowed.includes(diameterMm)) throw new Error(`Choose a size: ${allowed.map((d) => `${d}mm`).join(', ')}.`);

  let lengthM: number | null = null;
  if (gauge === 'HEAVY') {
    lengthM = Number(formData.get('lengthM'));
    if (!HEAVY_GAUGE_LENGTHS.includes(lengthM)) throw new Error(`Choose a length: ${HEAVY_GAUGE_LENGTHS.map((l) => `${l}m`).join(' or ')}.`);
  }

  const weightKg = Number(formData.get('weightKg'));
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Enter the weight in kg.');

  const item = await db.steelStockItem.create({
    data: {
      gauge, castNumber, diameterMm, lengthM, weightKg,
      note: String(formData.get('note') ?? '').trim(),
      addedById: user.id,
    },
  });
  await logActivity('SteelStockItem', item.id, 'Added to stock', `${steelSizeLabel(item)}, cast ${castNumber}, ${weightKg} kg`, user.id);
  revalidatePath(GAUGE_PATH[gauge]);
  revalidatePath('/stock');
}

/** Takes a coil or bundle out of stock — used, scrapped or booked in wrong. What it was stays in the activity log. */
export async function removeSteelStock(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('itemId'));
  const item = await db.steelStockItem.findUniqueOrThrow({ where: { id } });
  if (item.company !== 'FENDER') throw new Error('Not found.');

  await db.steelStockItem.delete({ where: { id } });
  await logActivity('SteelStockItem', id, 'Removed from stock', `${steelSizeLabel(item)}, cast ${item.castNumber}, ${Number(item.weightKg)} kg`, user.id);
  revalidatePath(GAUGE_PATH[item.gauge]);
  revalidatePath('/stock');
}

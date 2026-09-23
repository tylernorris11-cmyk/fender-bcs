'use server';

import { revalidatePath } from 'next/cache';
import type { Company, StockLengthMovementType } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';
import { feetInches, tonnes } from '@/lib/format';

/**
 * Every change to a stock length's weight goes through here — a produced
 * bundle, a manual correction, always logged as its own movement, same
 * principle as StockMovement for Batch. Runs in a transaction so the
 * weight update and its movement record can never separate, and so the
 * below-zero check reads the true current figure, not a stale one.
 */
async function applyStockLengthMovement({
  company, lengthFt, lengthIn, thicknessMm, weightKgDelta, type, note, userId,
}: {
  company: Company; lengthFt: number; lengthIn: number; thicknessMm: number;
  weightKgDelta: number; type: StockLengthMovementType; note: string; userId: string;
}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.stockLength.findUnique({
      where: { company_lengthFt_lengthIn_thicknessMm: { company, lengthFt, lengthIn, thicknessMm } },
    });
    const currentKg = Number(existing?.weightKg ?? 0);
    const newWeightKg = currentKg + weightKgDelta;
    if (newWeightKg < 0) {
      throw new Error(`Only ${tonnes(currentKg)} of ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm in stock — can't take off ${tonnes(-weightKgDelta)}.`);
    }

    const stockLength = existing
      ? await tx.stockLength.update({ where: { id: existing.id }, data: { weightKg: newWeightKg } })
      : await tx.stockLength.create({ data: { company, lengthFt, lengthIn, thicknessMm, weightKg: newWeightKg } });

    await tx.stockLengthMovement.create({ data: { stockLengthId: stockLength.id, type, weightKg: weightKgDelta, note, userId } });
    return stockLength;
  });
}

function readSpec(formData: FormData) {
  const lengthFt = Number(formData.get('lengthFt') ?? 0);
  const lengthIn = Number(formData.get('lengthIn') ?? 0);
  const thicknessMm = Number(formData.get('thicknessMm') ?? 0);
  if (!Number.isFinite(lengthFt) || lengthFt <= 0) throw new Error('Enter a length in feet.');
  if (!Number.isFinite(lengthIn) || lengthIn < 0 || lengthIn >= 12) throw new Error('Inches should be 0–11.');
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) throw new Error('Enter a thickness in mm.');
  return { lengthFt, lengthIn, thicknessMm };
}

/** Logged from Production when a run cuts steel rod ahead of any specific order — see production/page.tsx's "Produce stock lengths" card, which posts here directly. */
export async function produceStockLength(formData: FormData) {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Stock lengths are a BCS Products thing.');

  const { lengthFt, lengthIn, thicknessMm } = readSpec(formData);
  const weightKg = Number(formData.get('weightKg') ?? 0);
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Enter the bundle weight produced, in kg.');
  const note = String(formData.get('note') ?? '').trim();

  const stockLength = await applyStockLengthMovement({
    company, lengthFt, lengthIn, thicknessMm, weightKgDelta: weightKg, type: 'PRODUCED', note, userId: user.id,
  });
  await logActivity('StockLength', stockLength.id, 'Produced', `${weightKg}kg of ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm`, user.id);
  revalidatePath('/stock/lengths');
  revalidatePath('/production');
}

/** A manual correction from the Stock Lengths page itself — a stock check, a damaged bundle written off, etc. Can go either direction. */
export async function adjustStockLength(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Stock lengths are a BCS Products thing.');

  const { lengthFt, lengthIn, thicknessMm } = readSpec(formData);
  const weightKgDelta = Number(formData.get('weightKgDelta') ?? 0);
  if (!Number.isFinite(weightKgDelta) || weightKgDelta === 0) throw new Error('Enter a weight to add or take off, in kg — a positive or a negative number.');
  const note = String(formData.get('note') ?? '').trim();
  if (!note) throw new Error('Say why — a stock check, damage, whatever it was.');

  const stockLength = await applyStockLengthMovement({
    company, lengthFt, lengthIn, thicknessMm, weightKgDelta, type: 'ADJUSTMENT', note, userId: user.id,
  });
  await logActivity('StockLength', stockLength.id, 'Adjusted', `${weightKgDelta > 0 ? '+' : ''}${weightKgDelta}kg of ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm — ${note}`, user.id);
  revalidatePath('/stock/lengths');
}

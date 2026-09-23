'use server';

import { revalidatePath } from 'next/cache';
import type { Company, StockLengthMovementType } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';
import { feetInches } from '@/lib/format';

/**
 * Every change to a stock length's count goes through here — a produced
 * batch, a manual correction, always logged as its own movement, same
 * principle as StockMovement for Batch. Runs in a transaction so the qty
 * update and its movement record can never separate, and so the
 * below-zero check reads the true current figure, not a stale one.
 */
async function applyStockLengthMovement({
  company, lengthFt, lengthIn, thicknessMm, qtyDelta, type, note, userId,
}: {
  company: Company; lengthFt: number; lengthIn: number; thicknessMm: number;
  qtyDelta: number; type: StockLengthMovementType; note: string; userId: string;
}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.stockLength.findUnique({
      where: { company_lengthFt_lengthIn_thicknessMm: { company, lengthFt, lengthIn, thicknessMm } },
    });
    const newQty = (existing?.qty ?? 0) + qtyDelta;
    if (newQty < 0) {
      throw new Error(`Only ${existing?.qty ?? 0} of ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm in stock — can't take off ${-qtyDelta}.`);
    }

    const stockLength = existing
      ? await tx.stockLength.update({ where: { id: existing.id }, data: { qty: newQty } })
      : await tx.stockLength.create({ data: { company, lengthFt, lengthIn, thicknessMm, qty: newQty } });

    await tx.stockLengthMovement.create({ data: { stockLengthId: stockLength.id, type, qty: qtyDelta, note, userId } });
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

/** Logged from Production when a run cuts extra posts ahead of any specific order — see production/actions.ts's produceStockLength, which calls through to this. */
export async function produceStockLength(formData: FormData) {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Stock lengths are a BCS Products thing.');

  const { lengthFt, lengthIn, thicknessMm } = readSpec(formData);
  const qty = Number(formData.get('qty') ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter how many were produced.');
  const note = String(formData.get('note') ?? '').trim();

  const stockLength = await applyStockLengthMovement({
    company, lengthFt, lengthIn, thicknessMm, qtyDelta: qty, type: 'PRODUCED', note, userId: user.id,
  });
  await logActivity('StockLength', stockLength.id, 'Produced', `${qty} × ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm`, user.id);
  revalidatePath('/stock/lengths');
  revalidatePath('/production');
}

/** A manual correction from the Stock Lengths page itself — a stock check, a damaged post written off, etc. Can go either direction. */
export async function adjustStockLength(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Stock lengths are a BCS Products thing.');

  const { lengthFt, lengthIn, thicknessMm } = readSpec(formData);
  const qtyDelta = Number(formData.get('qtyDelta') ?? 0);
  if (!Number.isFinite(qtyDelta) || qtyDelta === 0) throw new Error('Enter how many to add or take off — a positive or a negative number.');
  const note = String(formData.get('note') ?? '').trim();
  if (!note) throw new Error('Say why — a stock check, damage, whatever it was.');

  const stockLength = await applyStockLengthMovement({
    company, lengthFt, lengthIn, thicknessMm, qtyDelta, type: 'ADJUSTMENT', note, userId: user.id,
  });
  await logActivity('StockLength', stockLength.id, 'Adjusted', `${qtyDelta > 0 ? '+' : ''}${qtyDelta} × ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm — ${note}`, user.id);
  revalidatePath('/stock/lengths');
}

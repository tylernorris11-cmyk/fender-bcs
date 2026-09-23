'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';
import { feetInches } from '@/lib/format';

const NEXT_STOCK_LENGTH_TAG_KEY = 'nextStockLengthTag';

function readSpec(formData: FormData) {
  const lengthFt = Number(formData.get('lengthFt') ?? 0);
  const lengthIn = Number(formData.get('lengthIn') ?? 0);
  const thicknessMm = Number(formData.get('thicknessMm') ?? 0);
  if (!Number.isFinite(lengthFt) || lengthFt <= 0) throw new Error('Enter a length in feet.');
  if (!Number.isFinite(lengthIn) || lengthIn < 0 || lengthIn >= 12) throw new Error('Inches should be 0–11.');
  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) throw new Error('Enter a thickness in mm.');
  return { lengthFt, lengthIn, thicknessMm };
}

/**
 * Logged from Production when a run cuts steel rod ahead of any specific
 * order — see production/page.tsx's "Produce stock lengths" card, which
 * posts here directly. Each bundle is its own row with its own tag, same
 * principle as a coil's 4-digit ref, so it can be pulled and traced
 * individually rather than just adding to a running total.
 */
export async function produceStockLength(formData: FormData) {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Stock lengths are a BCS Products thing.');

  const { lengthFt, lengthIn, thicknessMm } = readSpec(formData);
  const weightKg = Number(formData.get('weightKg') ?? 0);
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Enter the bundle weight produced, in kg.');
  const note = String(formData.get('note') ?? '').trim();

  const stockLength = await db.$transaction(async (tx) => {
    const setting = await tx.setting.findUnique({ where: { key: NEXT_STOCK_LENGTH_TAG_KEY } });
    const next = setting ? Number(setting.value) : 1;
    await tx.setting.upsert({
      where: { key: NEXT_STOCK_LENGTH_TAG_KEY },
      create: { key: NEXT_STOCK_LENGTH_TAG_KEY, value: String(next + 1) },
      update: { value: String(next + 1) },
    });
    const tag = `L${String(next).padStart(4, '0')}`;
    return tx.stockLength.create({
      data: { company, tag, lengthFt, lengthIn, thicknessMm, weightKg, note, producedById: user.id },
    });
  });

  await logActivity('StockLength', stockLength.id, 'Produced', `${stockLength.tag} — ${weightKg}kg of ${feetInches(lengthFt, lengthIn)} × ${thicknessMm}mm`, user.id);
  revalidatePath('/stock/lengths');
  revalidatePath('/production');
}

/**
 * Removes a bundle that's already real stock — used up, scrapped, entered
 * wrong and easier to redo than fix. A stock.adjust action, mirroring
 * removeCoilFromStock: there's no partial-weight correction on a bundle,
 * just remove it and produce a fresh one if the figure was wrong.
 */
export async function removeStockLengthFromStock(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('stockLengthId'));
  const stockLength = await db.stockLength.findUniqueOrThrow({ where: { id } });
  if (stockLength.company !== 'BS_SUPPLIES') throw new Error('Not found.');

  await db.stockLength.delete({ where: { id } });
  await logActivity(
    'StockLength',
    id,
    'Removed from stock',
    `${stockLength.tag} — ${Number(stockLength.weightKg)}kg of ${feetInches(stockLength.lengthFt, stockLength.lengthIn)} × ${Number(stockLength.thicknessMm)}mm`,
    user.id,
  );
  revalidatePath('/stock/lengths');
}

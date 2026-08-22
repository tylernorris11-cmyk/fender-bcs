'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { withinTolerance } from '@/lib/bs8666';

export async function logProduction(formData: FormData) {
  const user = await assertPermission('production.progress');
  const orderId = String(formData.get('orderId'));
  const barMarkId = String(formData.get('barMarkId') ?? '');

  await db.productionEvent.create({
    data: {
      orderId,
      station: String(formData.get('station')),
      assetId: String(formData.get('assetId') ?? '') || null,
      action: String(formData.get('action')),
      note: String(formData.get('note') ?? ''),
      userId: user.id,
    },
  });

  if (barMarkId) {
    await db.barMark.update({ where: { id: barMarkId }, data: { status: String(formData.get('status') ?? 'Cut') } });
  }

  revalidatePath('/production');
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Record a measured dimension against what was scheduled. Anything outside the
 * BS 8666 tolerance band is flagged and should be followed by an NCR — the
 * check itself is kept either way, because the evidence of checking matters as
 * much as the result.
 */
export async function recordCheck(formData: FormData) {
  const user = await assertPermission('production.qc');
  const barMarkId = String(formData.get('barMarkId'));
  const dimension = String(formData.get('dimension'));
  const measuredMm = Number(formData.get('measuredMm'));

  const bar = await db.barMark.findUniqueOrThrow({ where: { id: barMarkId } });
  const nominalMm = dimension === 'Total length'
    ? bar.lengthMm
    : Number(({ A: bar.a, B: bar.b, C: bar.c, D: bar.d, 'E/F': bar.ef } as Record<string, number | null>)[dimension] ?? bar.lengthMm);

  const result = withinTolerance(nominalMm, measuredMm);

  await db.qcCheck.create({
    data: {
      barMarkId, dimension, nominalMm, measuredMm,
      toleranceMm: result.tolerance, pass: result.pass, checkedById: user.id,
      note: String(formData.get('note') ?? ''),
    },
  });

  await db.barMark.update({ where: { id: barMarkId }, data: { status: result.pass ? 'Checked' : 'Scheduled' } });
  await logActivity('Order', bar.orderId, result.pass ? 'Dimensional check passed' : 'Dimensional check FAILED',
    `${bar.mark} ${dimension}: scheduled ${nominalMm} mm, measured ${measuredMm} mm (${result.tolerance})`, user.id);

  revalidatePath('/production/checks');
  revalidatePath(`/orders/${bar.orderId}`);
}

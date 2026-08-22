'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';

/**
 * Logging an inspection rolls the next due date forward. Calibration matters
 * most: CARES requires control of measuring devices, so a bender whose length
 * stop has not been verified should not be running a schedule.
 */
export async function logInspection(formData: FormData) {
  const user = await assertPermission('assets.edit');
  const assetId = String(formData.get('assetId'));
  const kind = String(formData.get('kind'));
  const performedOn = new Date(String(formData.get('performedOn')));
  const nextDueOn = formData.get('nextDueOn') ? new Date(String(formData.get('nextDueOn'))) : null;
  const result = String(formData.get('result') ?? 'Pass');

  await db.inspection.create({
    data: {
      assetId, kind, result, performedOn, nextDueOn,
      provider: String(formData.get('provider') ?? ''),
      certificate: String(formData.get('certificate') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      loggedById: user.id,
    },
  });

  if (nextDueOn) {
    const field = {
      MOT: 'motDue', PUWER: 'puwerDue', LOLER: 'lolerDue',
      Service: 'serviceDue', Calibration: 'calibrationDue', 'Safety check': 'weeklyCheckDue',
    }[kind];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (field) await db.asset.update({ where: { id: assetId }, data: { [field]: nextDueOn } as any });
  }

  await logActivity('Asset', assetId, `${kind} logged`, `${result}${nextDueOn ? `, next due ${nextDueOn.toDateString()}` : ''}`, user.id);
  revalidatePath(`/assets/${assetId}`);
  revalidatePath('/assets');
}

export async function addAssetNote(formData: FormData) {
  const user = await assertPermission('assets.view');
  const assetId = String(formData.get('assetId'));
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await db.assetNote.create({ data: { assetId, body, userId: user.id } });
  revalidatePath(`/assets/${assetId}`);
}

export async function retireAsset(formData: FormData) {
  const user = await assertPermission('assets.edit');
  const assetId = String(formData.get('assetId'));
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  await db.asset.update({ where: { id: assetId }, data: { retired: !asset.retired } });
  await logActivity('Asset', assetId, asset.retired ? 'Brought back into service' : 'Retired', '', user.id);
  revalidatePath('/assets');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AssetType, Company } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { canAccessCompany } from '@/lib/company';
import { defaultCheckItems } from '@/lib/checks';

async function nextAssetRef(type: AssetType) {
  const prefix = type === 'VEHICLE' ? 'VH' : 'MC';
  const last = await db.asset.findFirst({ where: { type }, orderBy: { ref: 'desc' }, select: { ref: true } });
  const seq = last ? Number(last.ref.split('-')[1]) + 1 : 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export async function createAsset(formData: FormData) {
  const user = await assertPermission('assets.edit');
  const type = String(formData.get('type')) as AssetType;
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  if (!name) throw new Error('Give it a name or registration.');
  if (!category) throw new Error('Give it a category.');

  const companyRaw = String(formData.get('company') ?? '');
  const company = (companyRaw === 'FENDER' || companyRaw === 'BS_SUPPLIES' ? companyRaw : null) as Company | null;
  if (company && !canAccessCompany(user, company)) {
    throw new Error('You can only scope an asset to a company you have access to yourself.');
  }

  const dateField = (key: string) => {
    const raw = formData.get(key);
    return raw ? new Date(String(raw)) : null;
  };

  const asset = await db.asset.create({
    data: {
      type, name, category, company,
      ref: await nextAssetRef(type),
      makeModel: String(formData.get('makeModel') ?? ''),
      year: formData.get('year') ? Number(formData.get('year')) : null,
      serialNumber: String(formData.get('serialNumber') ?? ''),
      depot: String(formData.get('depot') ?? 'Scunthorpe'),
      hours: formData.get('hours') ? Number(formData.get('hours')) : null,
      liftingEquipment: formData.get('liftingEquipment') === '1',
      motDue: dateField('motDue'),
      taxDue: dateField('taxDue'),
      weeklyCheckDue: dateField('weeklyCheckDue'),
      puwerDue: dateField('puwerDue'),
      lolerDue: dateField('lolerDue'),
      serviceDue: dateField('serviceDue'),
      calibrationDue: dateField('calibrationDue'),
    },
  });

  // A sensible starting checklist for its type — editable from here on,
  // since a real lorry or machine often needs its own tweaks.
  await db.assetChecklistItem.createMany({
    data: defaultCheckItems(type).map((label, i) => ({ assetId: asset.id, label, sortOrder: i })),
  });

  await logActivity('Asset', asset.id, 'Added', `${asset.ref} — ${name}`, user.id);
  revalidatePath('/assets');
  redirect(`/assets/${asset.id}`);
}

export async function addAssetChecklistItem(formData: FormData) {
  await assertPermission('assets.edit');
  const assetId = String(formData.get('assetId'));
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;
  const count = await db.assetChecklistItem.count({ where: { assetId } });
  await db.assetChecklistItem.create({ data: { assetId, label, sortOrder: count } });
  revalidatePath(`/assets/${assetId}`);
}

export async function removeAssetChecklistItem(formData: FormData) {
  await assertPermission('assets.edit');
  const id = String(formData.get('itemId'));
  const item = await db.assetChecklistItem.findUniqueOrThrow({ where: { id }, select: { assetId: true } });
  await db.assetChecklistItem.delete({ where: { id } });
  revalidatePath(`/assets/${item.assetId}`);
}

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

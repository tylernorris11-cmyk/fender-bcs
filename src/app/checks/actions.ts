'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';

/** Read the repeating checklist-item rows out of the check form. */
function rows(formData: FormData, prefix: string): Record<string, string>[] {
  const out: Record<string, Record<string, string>> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(new RegExp(`^${prefix}\\[(\\d+)]\\[(\\w+)]$`));
    if (!match) continue;
    (out[match[1]] ??= {})[match[2]] = String(value);
  }
  return Object.keys(out).sort((a, b) => Number(a) - Number(b)).map((k) => out[k]);
}

export async function logAssetCheck(formData: FormData) {
  const user = await assertPermission('checks.create');

  const assetId = String(formData.get('assetId') ?? '');
  if (!assetId) throw new Error('Choose an asset before saving.');

  const itemRows = rows(formData, 'item').filter((r) => r.label);
  const allOk = itemRows.every((r) => r.ok === '1');

  const check = await db.assetCheck.create({
    data: {
      assetId,
      userId: user.id,
      result: allOk ? 'PASS' : 'FAIL',
      notes: String(formData.get('notes') ?? ''),
      items: {
        create: itemRows.map((r) => ({ label: r.label, ok: r.ok === '1', note: r.note ?? '', photo: r.photo || null })),
      },
    },
  });

  await logActivity('AssetCheck', check.id, allOk ? 'Check passed' : 'Check flagged an issue', '', user.id);

  revalidatePath('/checks');
  revalidatePath(`/assets/${assetId}`);
  revalidatePath('/');
  redirect('/checks');
}

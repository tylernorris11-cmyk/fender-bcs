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
      photo: String(formData.get('photo') ?? '') || null,
      items: {
        create: itemRows.map((r) => ({ label: r.label, ok: r.ok === '1', note: r.note ?? '' })),
      },
    },
  });

  await logActivity('AssetCheck', check.id, allOk ? 'Check passed' : 'Check flagged an issue', '', user.id);

  revalidatePath('/checks');
  revalidatePath(`/assets/${assetId}`);
  revalidatePath('/');
  redirect('/checks');
}

// ------------------------------------------------------------------ issues
// Separate from the pass/fail checklist above — something spotted that
// isn't necessarily one of the fixed checklist items, and stays visible
// until someone actually fixes it, not just until the next check is logged.

export async function reportAssetIssue(formData: FormData) {
  const user = await assertPermission('checks.create');
  const assetId = String(formData.get('assetId') ?? '');
  if (!assetId) throw new Error('Choose an asset before reporting an issue.');
  const description = String(formData.get('description') ?? '').trim();
  if (!description) throw new Error('Say what the issue is.');

  const issue = await db.assetIssue.create({ data: { assetId, description, reportedById: user.id } });

  await logActivity('Asset', assetId, 'Issue reported', description, user.id);
  revalidatePath('/checks');
  revalidatePath('/checks/new');
  revalidatePath(`/assets/${assetId}`);
}

export async function resolveAssetIssue(formData: FormData) {
  const user = await assertPermission('checks.create');
  const id = String(formData.get('issueId'));
  const resolutionNote = String(formData.get('resolutionNote') ?? '').trim();

  const issue = await db.assetIssue.findUniqueOrThrow({ where: { id } });
  if (issue.resolved) return;

  await db.assetIssue.update({
    where: { id },
    data: { resolved: true, resolvedById: user.id, resolvedAt: new Date(), resolutionNote },
  });

  await logActivity('Asset', issue.assetId, 'Issue resolved', resolutionNote, user.id);
  revalidatePath('/checks');
  revalidatePath(`/assets/${issue.assetId}`);
}

// ------------------------------------------------------------------ resolving a flagged check
// A FAIL result on the pass/fail checklist itself (not an AssetIssue). Resolution
// is tracked per item — a check can flag several things at once, and someone
// might fix two today and genuinely leave a third one still broken, so each
// ticked item is marked fixed individually rather than the check as a whole.

export async function resolveAssetCheckItems(formData: FormData) {
  const user = await assertPermission('checks.create');
  const checkId = String(formData.get('checkId') ?? '');
  const check = await db.assetCheck.findUniqueOrThrow({ where: { id: checkId }, include: { asset: true, items: true } });
  if (check.asset.company && !user.companies.includes(check.asset.company)) throw new Error('Not found.');

  const openItemIds = new Set(check.items.filter((i) => !i.ok && !i.resolved).map((i) => i.id));
  const toResolve = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith('fixed_') && value === '1' && openItemIds.has(key.slice('fixed_'.length)))
    .map(([key]) => {
      const itemId = key.slice('fixed_'.length);
      return { itemId, note: String(formData.get(`note_${itemId}`) ?? '').trim() };
    });
  if (toResolve.length === 0) throw new Error('Tick at least one item to mark as fixed.');

  await db.$transaction(
    toResolve.map(({ itemId, note }) =>
      db.assetCheckItem.update({
        where: { id: itemId },
        data: { resolved: true, resolvedById: user.id, resolvedAt: new Date(), resolutionNote: note },
      }),
    ),
  );

  const summary = toResolve.map((r) => r.note).filter(Boolean).join('; ') || `${toResolve.length} item(s) fixed`;
  await logActivity('AssetCheck', check.id, 'Issue(s) resolved', summary, user.id);

  revalidatePath('/checks');
  revalidatePath(`/checks/${check.id}`);
  revalidatePath(`/checks/${check.id}/print`);
  revalidatePath(`/assets/${check.assetId}`);

  const resolvedNow = new Set(toResolve.map((r) => r.itemId));
  const stillOpen = check.items.some((i) => !i.ok && !i.resolved && !resolvedNow.has(i.id));
  redirect(stillOpen ? `/checks/${check.id}/resolve` : `/checks/${check.id}`);
}

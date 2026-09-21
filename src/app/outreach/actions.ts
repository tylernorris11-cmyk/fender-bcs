'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess } from '@/lib/company';

/** Only a draft awaiting review can be approved or rejected — approving one that's already sent (say, from a stale tab or a double click) would send it a second time. */
async function decideDraft(id: string, decision: 'APPROVED' | 'REJECTED', userId: string) {
  if (!id) throw new Error('Missing email id.');
  const now = new Date();
  const changed = await db.outreachEmail.updateMany({
    where: { id, status: 'DRAFT' },
    data: decision === 'APPROVED'
      ? { status: 'APPROVED', approvedById: userId, approvedAt: now }
      : { status: 'REJECTED', rejectedAt: now },
  });
  if (changed.count === 0) throw new Error('That email has already been dealt with — refresh the page.');

  const email = await db.outreachEmail.findUniqueOrThrow({ where: { id }, include: { lead: true } });
  await db.lead.update({ where: { id: email.leadId }, data: { status: decision } });
  await logActivity('OutreachEmail', id, decision === 'APPROVED' ? 'Approved' : 'Rejected', email.lead.companyName, userId);
  revalidatePath('/outreach');
}

export async function approveOutreachEmail(formData: FormData) {
  const user = await assertPermission('outreach.manage');
  assertCompanyAccess(user, 'BS_SUPPLIES'); // BCS Products only for now — the page guard alone isn't enough, actions are their own entry point
  await decideDraft(String(formData.get('id') ?? ''), 'APPROVED', user.id);
}

export async function rejectOutreachEmail(formData: FormData) {
  const user = await assertPermission('outreach.manage');
  assertCompanyAccess(user, 'BS_SUPPLIES');
  await decideDraft(String(formData.get('id') ?? ''), 'REJECTED', user.id);
}

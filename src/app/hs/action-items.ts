'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, getCurrentUser, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { ASSESSMENT_KIND, parseDay } from '@/lib/hs';

/** Every page an action shows on, so a change shows everywhere at once. */
function revalidateAction(a: { incidentId: string | null; assessmentId: string | null }, assessmentPath?: string) {
  revalidatePath('/hs/actions');
  revalidatePath('/hs');
  if (a.incidentId) revalidatePath(`/hs/incidents/${a.incidentId}`);
  if (a.assessmentId && assessmentPath) revalidatePath(`${assessmentPath}/${a.assessmentId}`);
}

/** Raises an action — on its own, or against an incident or assessment. */
export async function createHsAction(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Say what needs doing.');
  const dueOn = parseDay(formData.get('dueOn'));
  if (!dueOn) throw new Error('Choose when it\'s due.');
  const ownerId = String(formData.get('ownerId') ?? '') || null;

  const incidentId = String(formData.get('incidentId') ?? '') || null;
  const assessmentId = String(formData.get('assessmentId') ?? '') || null;
  let company = getActiveCompany(user);
  let assessmentPath: string | undefined;
  if (incidentId) {
    const incident = await db.hsIncident.findUniqueOrThrow({ where: { id: incidentId } });
    assertCompanyAccess(user, incident.company);
    company = incident.company;
  }
  if (assessmentId) {
    const a = await db.hsAssessment.findUniqueOrThrow({ where: { id: assessmentId } });
    if (a.company) { assertCompanyAccess(user, a.company); company = a.company; }
    assessmentPath = ASSESSMENT_KIND[a.kind].path;
  }

  const action = await db.hsAction.create({
    data: { company, title, dueOn, ownerId, incidentId, assessmentId, note: String(formData.get('note') ?? '').trim(), createdById: user.id },
  });
  await logActivity('HsAction', action.id, 'Raised', title, user.id);
  revalidateAction(action, assessmentPath);
  // From the pop-up on the Actions page: back to the list, which closes it.
  const returnTo = String(formData.get('returnTo') ?? '');
  if (returnTo.startsWith('/hs/')) redirect(returnTo);
}

/** Ticks an action off, or opens it again. Its owner can do this as well as H&S editors. */
export async function setHsActionDone(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const id = String(formData.get('id') ?? '');
  const done = formData.get('done') === '1';
  const action = await db.hsAction.findUniqueOrThrow({ where: { id }, include: { assessment: { select: { kind: true } } } });
  if (!(can(user, 'hs.edit') || (action.ownerId === user.id && can(user, 'hs.view')))) {
    throw new Error('You do not have permission to do that.');
  }
  assertCompanyAccess(user, action.company);

  await db.hsAction.update({
    where: { id },
    data: done ? { completedAt: new Date(), completedById: user.id } : { completedAt: null, completedById: null },
  });
  await logActivity('HsAction', id, done ? 'Completed' : 'Reopened', action.title, user.id);
  revalidateAction(action, action.assessment ? ASSESSMENT_KIND[action.assessment.kind].path : undefined);
}

/** For an action raised by mistake. What it was stays in the activity log. */
export async function deleteHsAction(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const action = await db.hsAction.findUniqueOrThrow({ where: { id }, include: { assessment: { select: { kind: true } } } });
  assertCompanyAccess(user, action.company);

  await db.hsAction.delete({ where: { id } });
  await logActivity('HsAction', id, 'Deleted', action.title, user.id);
  revalidateAction(action, action.assessment ? ASSESSMENT_KIND[action.assessment.kind].path : undefined);
}

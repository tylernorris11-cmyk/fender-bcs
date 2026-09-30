'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Company, HsAssessmentKind, HsRiskLevel } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess } from '@/lib/company';
import { ASSESSMENT_KIND, parseDay, riskLevelFor } from '@/lib/hs';
import { postedFile, storeHsFile } from '@/lib/hsFiles';

type HazardInput = { hazard: string; whoAtRisk: string; controls: string; likelihood: number; severity: number };

function parseKind(formData: FormData): HsAssessmentKind {
  const kind = String(formData.get('kind'));
  if (kind !== 'RISK_ASSESSMENT' && kind !== 'METHOD_STATEMENT') throw new Error('Unknown kind of assessment.');
  return kind;
}

/** The hazards table arrives as JSON from the editor; blank rows are dropped. */
function parseHazards(formData: FormData): HazardInput[] {
  let rows: unknown;
  try { rows = JSON.parse(String(formData.get('hazards') || '[]')); } catch { throw new Error('The hazards could not be read. Try again.'); }
  if (!Array.isArray(rows)) return [];
  const clampScore = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v) || 1)));
  return rows
    .map((r) => ({
      hazard: String(r?.hazard ?? '').trim(),
      whoAtRisk: String(r?.whoAtRisk ?? '').trim(),
      controls: String(r?.controls ?? '').trim(),
      likelihood: clampScore(r?.likelihood),
      severity: clampScore(r?.severity),
    }))
    .filter((r) => r.hazard);
}

async function nextRef(kind: HsAssessmentKind) {
  const prefix = ASSESSMENT_KIND[kind].prefix;
  const refs = await db.hsAssessment.findMany({ where: { kind }, select: { ref: true } });
  const n = Math.max(0, ...refs.map((r) => Number(r.ref.split('-')[1]) || 0)) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

/** Adds a risk assessment or method statement, or saves changes to one. */
export async function saveAssessment(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const existing = id ? await db.hsAssessment.findUniqueOrThrow({ where: { id } }) : null;
  if (existing?.company) assertCompanyAccess(user, existing.company);
  const kind = existing?.kind ?? parseKind(formData);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give it a title.');
  const area = String(formData.get('area') ?? '').trim();
  const companyRaw = String(formData.get('company') ?? '');
  const company: Company | null = companyRaw === 'FENDER' || companyRaw === 'BS_SUPPLIES' ? companyRaw : null;
  if (company) assertCompanyAccess(user, company);
  const reviewDue = parseDay(formData.get('reviewDue'));
  if (!reviewDue) throw new Error('Choose when it next needs reviewing.');

  const hazards = parseHazards(formData);
  const steps = kind === 'METHOD_STATEMENT'
    ? String(formData.get('steps') ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  // With hazards written in, the level is the worst risk left after controls;
  // with only a file, whoever uploads it chooses.
  const chosen = String(formData.get('riskLevel'));
  const riskLevel: HsRiskLevel = hazards.length
    ? hazards.map((h) => riskLevelFor(h.likelihood * h.severity)).reduce((worst, l) => (l === 'HIGH' || (l === 'MEDIUM' && worst === 'LOW') ? l : worst), 'LOW' as HsRiskLevel)
    : chosen === 'LOW' || chosen === 'HIGH' ? chosen : 'MEDIUM';

  const file = postedFile(formData, 'file');
  const removeFile = formData.get('removeFile') === 'on';
  const hasFile = !!file || (!!existing?.fileUrl && !removeFile);
  if (!hasFile && hazards.length === 0 && steps.length === 0) {
    throw new Error(kind === 'METHOD_STATEMENT'
      ? 'Upload the signed copy, or write in the steps or hazards.'
      : 'Upload the signed copy, or write in at least one hazard.');
  }
  const stored = file ? await storeHsFile(file, 'assessments', { allowWord: true }) : null;
  const fileFields = stored
    ? { fileUrl: stored.url, fileName: stored.name }
    : removeFile ? { fileUrl: '', fileName: '' } : {};

  const data = { company, title, area, riskLevel, reviewDue, steps, ...fileFields };
  const hazardRows = hazards.map((h, i) => ({ ...h, sortOrder: i }));

  let savedId: string;
  if (existing) {
    await db.$transaction([
      db.hsAssessment.update({ where: { id: existing.id }, data }),
      db.hsHazard.deleteMany({ where: { assessmentId: existing.id } }),
      db.hsHazard.createMany({ data: hazardRows.map((h) => ({ ...h, assessmentId: existing.id })) }),
    ]);
    savedId = existing.id;
    await logActivity('HsAssessment', savedId, 'Updated', `${existing.ref} ${title}`, user.id);
  } else {
    const created = await db.hsAssessment.create({
      data: { ...data, kind, ref: await nextRef(kind), createdById: user.id, hazards: { create: hazardRows } },
    });
    savedId = created.id;
    await logActivity('HsAssessment', savedId, 'Created', `${created.ref} ${title}`, user.id);
  }

  const base = ASSESSMENT_KIND[kind].path;
  revalidatePath(base);
  revalidatePath('/hs');
  redirect(`${base}/${savedId}`);
}

/** Records a review: stamps today and sets when the next one's due. */
export async function markAssessmentReviewed(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const a = await db.hsAssessment.findUniqueOrThrow({ where: { id } });
  if (a.company) assertCompanyAccess(user, a.company);
  const nextReview = parseDay(formData.get('nextReview'));
  if (!nextReview) throw new Error('Choose when it next needs reviewing.');

  await db.hsAssessment.update({ where: { id }, data: { lastReviewedAt: new Date(), reviewDue: nextReview, archived: false } });
  await logActivity('HsAssessment', id, 'Reviewed', `${a.ref}, next review ${nextReview.toISOString().slice(0, 10)}`, user.id);
  revalidatePath(ASSESSMENT_KIND[a.kind].path);
  revalidatePath(`${ASSESSMENT_KIND[a.kind].path}/${id}`);
  revalidatePath('/hs');
}

/** Takes one off the live register (or puts it back). Nothing is deleted. */
export async function setAssessmentArchived(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const archived = formData.get('archived') === '1';
  const a = await db.hsAssessment.findUniqueOrThrow({ where: { id } });
  if (a.company) assertCompanyAccess(user, a.company);

  await db.hsAssessment.update({ where: { id }, data: { archived } });
  await logActivity('HsAssessment', id, archived ? 'Archived' : 'Restored', a.ref, user.id);
  revalidatePath(ASSESSMENT_KIND[a.kind].path);
  revalidatePath(`${ASSESSMENT_KIND[a.kind].path}/${id}`);
  revalidatePath('/hs');
}

'use server';

import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';
import type { Company, HseDocumentCategory, TrainingCategory } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess } from '@/lib/company';

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/** A blank company field means "shared across both companies" — mirrors
 * Asset.company's null-means-shared convention. */
function parseCompanyField(formData: FormData): Company | null {
  const raw = String(formData.get('company') ?? '');
  return raw === 'FENDER' || raw === 'BS_SUPPLIES' ? raw : null;
}

function parseContent(formData: FormData): string[] {
  return String(formData.get('content') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// -------------------------------------------------------------- documents

export async function uploadHseDocument(formData: FormData) {
  const user = await assertPermission('hs.edit');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give the document a title.');
  const category = String(formData.get('category') ?? 'OTHER') as HseDocumentCategory;
  const company = parseCompanyField(formData);
  if (company) assertCompanyAccess(user, company);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file to upload.');
  if (!ALLOWED_DOC_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPEG or WebP files are supported.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN before uploading.');
  }

  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`hs-documents/${Date.now()}-${safeName}`, Buffer.from(bytes), { access: 'private' });

  const doc = await db.hseDocument.create({
    data: { company, category, title, fileUrl: blob.url, fileName: file.name, uploadedById: user.id },
  });
  await logActivity('HseDocument', doc.id, 'Uploaded', title, user.id);
  revalidatePath('/hs/documents');
}

export async function archiveHseDocument(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const doc = await db.hseDocument.findUniqueOrThrow({ where: { id } });
  if (doc.company) assertCompanyAccess(user, doc.company);

  await db.hseDocument.update({ where: { id }, data: { archived: true } });
  await logActivity('HseDocument', id, 'Archived', doc.title, user.id);
  revalidatePath('/hs/documents');
}

// -------------------------------------------------------------- training

export async function createTrainingModule(formData: FormData) {
  const user = await assertPermission('hs.manageTraining');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give the module a title.');
  const category = String(formData.get('category') ?? 'GENERAL') as TrainingCategory;
  const machineName = category === 'MACHINE' ? String(formData.get('machineName') ?? '').trim() : '';
  if (category === 'MACHINE' && !machineName) throw new Error('Name the machine this module is for.');
  const summary = String(formData.get('summary') ?? '').trim();
  const content = parseContent(formData);
  const company = parseCompanyField(formData);
  if (company) assertCompanyAccess(user, company);

  const count = await db.trainingModule.count();
  const module = await db.trainingModule.create({
    data: { company, category, machineName, title, summary, content, sortOrder: count, createdById: user.id },
  });
  await logActivity('TrainingModule', module.id, 'Created', title, user.id);
  revalidatePath('/hs/training');
  revalidatePath('/hs/training/manage');
}

export async function updateTrainingModule(formData: FormData) {
  const user = await assertPermission('hs.manageTraining');
  const id = String(formData.get('id') ?? '');
  const existing = await db.trainingModule.findUniqueOrThrow({ where: { id } });
  if (existing.company) assertCompanyAccess(user, existing.company);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give the module a title.');
  const category = String(formData.get('category') ?? 'GENERAL') as TrainingCategory;
  const machineName = category === 'MACHINE' ? String(formData.get('machineName') ?? '').trim() : '';
  if (category === 'MACHINE' && !machineName) throw new Error('Name the machine this module is for.');
  const summary = String(formData.get('summary') ?? '').trim();
  const content = parseContent(formData);
  const active = formData.get('active') === 'on';

  await db.trainingModule.update({
    where: { id },
    data: { title, category, machineName, summary, content, active },
  });
  await logActivity('TrainingModule', id, 'Updated', title, user.id);
  revalidatePath('/hs/training');
  revalidatePath(`/hs/training/${id}`);
  revalidatePath('/hs/training/manage');
}

/** Saves one person's full set of machine-module assignments in one go —
 * diffs what's posted against what's stored, so a no-op save touches no rows. */
export async function setMachineTrainingAssignments(formData: FormData) {
  const user = await assertPermission('hs.manageTraining');
  const targetUserId = String(formData.get('userId') ?? '');
  if (!targetUserId) throw new Error('Missing user.');

  const nextIds = new Set(formData.getAll('moduleIds').map(String));
  const existing = await db.userTrainingAssignment.findMany({
    where: { userId: targetUserId },
    select: { moduleId: true },
  });
  const existingIds = new Set(existing.map((a) => a.moduleId));

  const toAdd = [...nextIds].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !nextIds.has(id));

  if (toAdd.length) {
    await db.userTrainingAssignment.createMany({
      data: toAdd.map((moduleId) => ({ userId: targetUserId, moduleId, assignedById: user.id })),
      skipDuplicates: true,
    });
  }
  if (toRemove.length) {
    await db.userTrainingAssignment.deleteMany({ where: { userId: targetUserId, moduleId: { in: toRemove } } });
  }

  await logActivity('User', targetUserId, 'Training assignments updated', `${nextIds.size} machine module(s)`, user.id);
  revalidatePath('/hs/training/manage');
}

/** Idempotent — a double-click or re-reading a module never creates a
 * second completion row for the same person and module. */
export async function acknowledgeTraining(formData: FormData) {
  const user = await assertPermission('hs.view');
  const moduleId = String(formData.get('moduleId') ?? '');
  if (!moduleId) throw new Error('Missing module.');

  await db.trainingCompletion.upsert({
    where: { userId_moduleId: { userId: user.id, moduleId } },
    create: { userId: user.id, moduleId },
    update: {},
  });

  revalidatePath('/hs/training');
  revalidatePath(`/hs/training/${moduleId}`);
  revalidatePath('/');
}

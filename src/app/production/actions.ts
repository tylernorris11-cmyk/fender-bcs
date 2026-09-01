'use server';

import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';
import type { ProductionProcess } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { withinTolerance } from '@/lib/bs8666';
import { getActiveCompany, assertCompanyAccess } from '@/lib/company';

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

// ------------------------------------------------ production tally sheets

const PROCESSES = ['CUTTING', 'BENDING', 'STEMA'];

/** Start a tally-sheet job. Fender only — the fields (bar mark, mill) are rebar concepts. */
export async function startProductionJob(formData: FormData) {
  const user = await assertPermission('production.progress');
  if (getActiveCompany(user) !== 'FENDER') {
    throw new Error('Starting a job only applies to Fender Steel production.');
  }

  const jobNumber = String(formData.get('jobNumber') ?? '').trim();
  if (!jobNumber) throw new Error('Enter a job number.');
  const process = String(formData.get('process')) as ProductionProcess;
  if (!PROCESSES.includes(process)) throw new Error('Choose cutting, bending or Stema.');

  const existing = await db.productionJob.findFirst({ where: { userId: user.id, finishedAt: null } });
  if (existing) {
    revalidatePath('/production');
    return;
  }

  const matchedOrder = await db.order.findFirst({ where: { company: 'FENDER', number: jobNumber } });

  const job = await db.productionJob.create({
    data: { company: 'FENDER', jobNumber, process, orderId: matchedOrder?.id ?? null, userId: user.id },
  });

  await logActivity('ProductionJob', job.id, 'Started job', `${jobNumber} · ${process}`, user.id);
  revalidatePath('/production');
}

export async function finishProductionJob(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.userId !== user.id) throw new Error('You can only finish your own job.');
  if (job.finishedAt) return;

  await db.productionJob.update({ where: { id: jobId }, data: { finishedAt: new Date() } });
  await logActivity('ProductionJob', jobId, 'Finished job', job.jobNumber, user.id);
  revalidatePath('/production');
}

export async function addProductionJobRow(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { rows: true } });
  if (job.userId !== user.id) throw new Error('You can only add rows to your own job.');
  if (job.finishedAt) throw new Error('This job has already finished.');

  const diaRaw = formData.get('diaMm');

  await db.productionJobRow.create({
    data: {
      jobId,
      diaMm: diaRaw ? Number(diaRaw) : null,
      barMark: String(formData.get('barMark') ?? '').trim(),
      castNumber: String(formData.get('castNumber') ?? '').trim(),
      mill: String(formData.get('mill') ?? '').trim(),
      tallyWeightKg: Number(formData.get('tallyWeightKg') || 0),
      comments: String(formData.get('comments') ?? '').trim(),
      sortOrder: job.rows.length,
    },
  });

  revalidatePath('/production');
}

/**
 * Live cast-number check for the "add a row" tally form. Called directly
 * from CastNumberField's onBlur, not through a <form> — the first server
 * action in this codebase invoked as a plain function rather than a form
 * action, which Next.js supports as long as the file has 'use server'.
 */
export async function checkCastNumber(castNumber: string): Promise<boolean> {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);
  const value = castNumber.trim();
  if (!value) return false;

  const match = await db.batch.findFirst({ where: { company, heatNumber: { equals: value, mode: 'insensitive' } } });
  return !!match;
}

// -------------------------------------------------------------- other work

const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Post a job that needs doing, with optional photo context. Master Admin/Admin only. */
export async function createOtherWorkTask(formData: FormData) {
  const user = await assertPermission('production.assign');
  const company = getActiveCompany(user);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give the task a title.');
  const description = String(formData.get('description') ?? '').trim();

  let photoUrl: string | null = null;
  const file = formData.get('photo');
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) throw new Error('Only PNG, JPEG or WebP photos are supported.');
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN before attaching a photo.');
    }
    const bytes = await file.arrayBuffer();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
    const blob = await put(`other-work/${Date.now()}-${safeName}`, Buffer.from(bytes), { access: 'private' });
    photoUrl = blob.url;
  }

  const task = await db.otherWorkTask.create({
    data: { company, title, description, photoUrl, createdById: user.id, status: 'Open' },
  });

  await logActivity('OtherWorkTask', task.id, 'Posted work', title, user.id);
  revalidatePath('/production/other-work');
  revalidatePath('/production');
}

export async function completeOtherWorkTask(formData: FormData) {
  const user = await assertPermission('production.progress');
  const id = String(formData.get('taskId'));
  const task = await db.otherWorkTask.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, task.company);
  if (task.status === 'Done') return;

  const doneNote = String(formData.get('doneNote') ?? '').trim();
  await db.otherWorkTask.update({
    where: { id },
    data: { status: 'Done', doneById: user.id, doneAt: new Date(), doneNote },
  });
  await logActivity('OtherWorkTask', id, 'Marked done', doneNote, user.id);
  revalidatePath('/production/other-work');
  revalidatePath('/production');
}

/** Log work that isn't tied to a customer order and wasn't posted by anyone — already done. */
export async function logOtherWork(formData: FormData) {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Say what work you did.');
  const description = String(formData.get('description') ?? '').trim();

  const task = await db.otherWorkTask.create({
    data: { company, title, description, createdById: user.id, status: 'Done', doneById: user.id, doneAt: new Date() },
  });

  await logActivity('OtherWorkTask', task.id, 'Logged other work', title, user.id);
  revalidatePath('/production/other-work');
}

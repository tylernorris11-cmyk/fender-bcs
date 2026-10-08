'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { put } from '@vercel/blob';
import { Prisma, type ProductionProcess } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { withinTolerance } from '@/lib/bs8666';
import { getActiveCompany, assertCompanyAccess } from '@/lib/company';
import { isOutOfService } from '@/lib/assets';
import { lookupCast, type CastLookup } from '@/lib/castLookup';
import { allocateLineStock, settleAfterChange } from '@/lib/orderProduction';
import { MACHINE, MACHINES, machinesFor } from '@/lib/productionSplit';

export async function logProduction(formData: FormData) {
  const user = await assertPermission('production.progress');
  const orderId = String(formData.get('orderId'));
  const barMarkId = String(formData.get('barMarkId') ?? '');

  const assetId = String(formData.get('assetId') ?? '') || null;
  if (assetId) {
    const asset = await db.asset.findUnique({
      where: { id: assetId },
      include: { checks: { orderBy: { performedAt: 'desc' }, take: 1, include: { items: true } } },
    });
    if (asset && isOutOfService(asset.checks[0])) {
      throw new Error(`${asset.name} is out of service — resolve the critical issue before logging work against it.`);
    }
  }

  await db.productionEvent.create({
    data: {
      orderId,
      station: String(formData.get('station')),
      assetId,
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

/**
 * Start a tally-sheet job. Fender picks a process (cutting/bending/Stema) —
 * BCS only ever cuts fence post to length from coil, so that choice doesn't
 * apply and is set automatically.
 */
export async function startProductionJob(formData: FormData) {
  const user = await assertPermission('production.progress');
  const company = getActiveCompany(user);

  const jobNumber = String(formData.get('jobNumber') ?? '').trim();
  if (!jobNumber) throw new Error('Enter a job number.');
  const customerName = String(formData.get('customerName') ?? '').trim();

  let process: ProductionProcess = 'CUTTING';
  if (company === 'FENDER') {
    process = String(formData.get('process')) as ProductionProcess;
    if (!PROCESSES.includes(process)) throw new Error('Choose cutting, bending or Stema.');
  }

  // A worker can run more than one job at once (several machines in
  // parallel) — only stop them opening the exact same job number twice.
  // On the BCS side a job is shared once started (anyone can add to or
  // finish it, see the ownership checks below), so the duplicate check
  // there is against the job number full stop, not just this user's own —
  // otherwise a second person starting the same job number would fork it
  // into two separate tallies instead of adding to the one already open.
  const duplicate = await db.productionJob.findFirst({
    where: company === 'BS_SUPPLIES'
      ? { company, jobNumber, finishedAt: null }
      : { userId: user.id, company, jobNumber, finishedAt: null },
  });
  if (duplicate) {
    throw new Error(
      company === 'BS_SUPPLIES'
        ? `Job ${jobNumber} is already open — add to it from the list below instead of starting it again.`
        : `You already have job ${jobNumber} open.`,
    );
  }

  const matchedOrder = await db.order.findFirst({ where: { company, number: jobNumber } });

  const job = await db.productionJob.create({
    data: { company, jobNumber, customerName, process, orderId: matchedOrder?.id ?? null, userId: user.id },
  });

  await logActivity('ProductionJob', job.id, 'Started job', `${jobNumber}${customerName ? ` — ${customerName}` : ''} · ${process}`, user.id);
  revalidatePath('/production');
  // Fender's Production page lists open jobs rather than showing each one in
  // full, so go straight into the new one to start tallying.
  if (company === 'FENDER') redirect(`/production/jobs/${job.id}`);
}

export async function finishProductionJob(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  assertCompanyAccess(user, job.company);
  // BCS jobs are shared once started — anyone can finish one, not just
  // whoever opened it. Fender's tally sheets stay one person's own.
  if (job.company === 'FENDER' && job.userId !== user.id) throw new Error('You can only finish your own job.');
  if (job.finishedAt) return;

  await db.productionJob.update({ where: { id: jobId }, data: { finishedAt: new Date() } });
  await logActivity('ProductionJob', jobId, 'Finished job', job.jobNumber, user.id);
  revalidatePath('/production');
  // A Fender job is finished from its own page; back to the open jobs.
  if (job.company === 'FENDER') redirect('/production');
}

/**
 * A big job (e.g. a 28-tonne run) can take more than one day. "Finish job"
 * is the only real end — this just marks today's tally as counted, so it
 * shows up on the Production board straight away instead of sitting
 * invisible until the whole job is eventually finished. The job stays open:
 * rows can keep being added tomorrow, picking up where they left off.
 */
export async function partFinishProductionJob(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  assertCompanyAccess(user, job.company);
  if (job.company === 'FENDER' && job.userId !== user.id) throw new Error('You can only part-finish your own job.');
  if (job.finishedAt) return;

  await db.productionJob.update({ where: { id: jobId }, data: { lastPartFinishedAt: new Date() } });
  await logActivity('ProductionJob', jobId, 'Part-finished for the day', job.jobNumber, user.id);
  revalidatePath('/production');
  revalidatePath(`/production/jobs/${jobId}`);
}

export async function addProductionJobRow(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { rows: true } });
  assertCompanyAccess(user, job.company);
  if (job.company === 'FENDER' && job.userId !== user.id) throw new Error('You can only add rows to your own job.');
  if (job.finishedAt) throw new Error('This job has already finished.');

  const machine = String(formData.get('machine') ?? '').trim();
  if (machine) {
    const asset = await db.asset.findFirst({
      where: { name: machine, type: 'MACHINE' },
      include: { checks: { orderBy: { performedAt: 'desc' }, take: 1, include: { items: true } } },
    });
    if (asset && isOutOfService(asset.checks[0])) {
      throw new Error(`${machine} is out of service — resolve the critical issue before logging work against it.`);
    }
  }

  const diaRaw = formData.get('diaMm');

  await db.productionJobRow.create({
    data: {
      jobId,
      diaMm: diaRaw ? Number(diaRaw) : null,
      barMark: String(formData.get('barMark') ?? '').trim(),
      castNumber: String(formData.get('castNumber') ?? '').trim(),
      mill: String(formData.get('mill') ?? '').trim(),
      machine,
      steelGrade: String(formData.get('steelGrade') ?? '').trim(),
      tallyWeightKg: Number(formData.get('tallyWeightKg') || 0),
      comments: String(formData.get('comments') ?? '').trim(),
      sortOrder: job.rows.length,
    },
  });

  revalidatePath('/production');
  revalidatePath(`/production/jobs/${jobId}`);
}

// ------------------------------------- production from an approved order

/**
 * Start (or carry on with) one machine's share of an approved order — picked
 * from the order's pop-up on the Production page. Opens a tally sheet for
 * the viewer on that machine and that order; the first one started moves the
 * order into production and allocates its stock, as the order page's own
 * "Start production" does.
 */
export async function startOrderProduction(formData: FormData) {
  const user = await assertPermission('production.progress');
  const orderId = String(formData.get('orderId'));
  const process = String(formData.get('process')) as ProductionProcess;
  if (!MACHINES.includes(process)) throw new Error('Choose the Cutter, Bending or the Stema.');

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: { select: { name: true } }, barMarks: { select: { diaMm: true, shapeCode: true } } },
  });
  assertCompanyAccess(user, order.company);
  if (order.company !== 'FENDER') throw new Error('Only Fender orders are split by machine.');
  if (order.stage !== 'APPROVED' && order.stage !== 'IN_PRODUCTION') {
    throw new Error(`${order.number} isn't approved for production.`);
  }
  const machine = MACHINE[process];
  if (!order.barMarks.some((b) => machinesFor(b).includes(process))) {
    throw new Error(`Nothing on ${order.number} goes on the ${machine.name}.`);
  }

  const open = await db.productionJob.findFirst({ where: { userId: user.id, orderId, process, finishedAt: null } });
  if (open) redirect(`/production/jobs/${open.id}`);

  const job = await db.productionJob.create({
    data: { company: order.company, jobNumber: order.number, customerName: order.customer.name, process, orderId, userId: user.id },
  });
  await logActivity('ProductionJob', job.id, 'Started job', `${order.number} — ${order.customer.name} · ${process}`, user.id);

  // Only the first person to start moves the order on, however many start at once.
  const moved = await db.order.updateMany({ where: { id: orderId, stage: 'APPROVED' }, data: { stage: 'IN_PRODUCTION' } });
  if (moved.count) {
    await allocateLineStock(orderId, order.number, user.id);
    await logActivity('Order', orderId, 'Start production', `APPROVED → IN_PRODUCTION · ${user.name} on the ${machine.name}`, user.id);
  }

  revalidatePath('/production');
  revalidatePath(`/orders/${orderId}`);
  redirect(`/production/jobs/${job.id}`);
}

/**
 * Tick a bar mark off the schedule on the viewer's own job: a tally row for
 * the whole mark at its scheduled weight. The Cutter and the Stema record the
 * cast number and mill typed in; bending takes them from the mark's cutting
 * row, so a mark has to be cut before it can be bent. Each mark goes through
 * each machine once — if two people tick the same one, the second is told
 * who beat them to it.
 */
export async function completeBarMark(formData: FormData) {
  const user = await assertPermission('production.progress');
  const jobId = String(formData.get('jobId'));
  const barMarkId = String(formData.get('barMarkId'));

  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { _count: { select: { rows: true } } } });
  assertCompanyAccess(user, job.company);
  if (job.userId !== user.id) throw new Error('You can only tick off bar marks on your own job.');
  if (job.finishedAt) throw new Error('This job has already finished.');

  const mark = await db.barMark.findUniqueOrThrow({ where: { id: barMarkId } });
  if (mark.orderId !== job.orderId) throw new Error("That bar mark isn't on this job.");
  const machine = MACHINE[job.process];
  if (!machinesFor(mark).includes(job.process)) throw new Error(`${mark.mark} doesn't go on the ${machine.name}.`);

  let castNumber = String(formData.get('castNumber') ?? '').trim();
  let mill = String(formData.get('mill') ?? '').trim();
  if (job.process === 'BENDING') {
    const cut = await db.productionJobRow.findUnique({ where: { barMarkId_process: { barMarkId, process: 'CUTTING' } } });
    if (!cut) throw new Error(`${mark.mark} hasn't been cut yet — it needs cutting before it can be bent.`);
    castNumber = cut.castNumber;
    mill = cut.mill;
  } else if (!castNumber || !mill) {
    throw new Error('Enter the cast number and mill for this size first.');
  }

  try {
    await db.productionJobRow.create({
      data: {
        jobId, diaMm: mark.diaMm, barMark: mark.mark, castNumber, mill, tallyWeightKg: mark.weightKg,
        sortOrder: job._count.rows, barMarkId, process: job.process,
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    const other = await db.productionJobRow.findUnique({
      where: { barMarkId_process: { barMarkId, process: job.process } }, include: { job: { include: { user: true } } },
    });
    throw new Error(`${mark.mark} has already been ${machine.done} by ${other?.job.user.name ?? 'someone else'}.`);
  }

  await settleAfterChange(barMarkId, user.id);
  revalidatePath(`/production/jobs/${jobId}`);
  revalidatePath('/production');
  revalidatePath(`/orders/${mark.orderId}`);
}

/** Take back a bar mark ticked off by mistake — your own, on a job that's still open, and not once it's been bent. */
export async function undoBarMark(formData: FormData) {
  const user = await assertPermission('production.progress');
  const row = await db.productionJobRow.findUniqueOrThrow({ where: { id: String(formData.get('rowId')) }, include: { job: true } });
  assertCompanyAccess(user, row.job.company);
  if (row.job.userId !== user.id) throw new Error('You can only undo your own rows.');
  if (row.job.finishedAt) throw new Error('This job has already finished.');
  if (!row.barMarkId) throw new Error("That row isn't from the schedule.");

  if (row.process === 'CUTTING') {
    const bent = await db.productionJobRow.findUnique({ where: { barMarkId_process: { barMarkId: row.barMarkId, process: 'BENDING' } } });
    if (bent) throw new Error(`${row.barMark} has already been bent — that needs undoing first.`);
  }

  await db.productionJobRow.delete({ where: { id: row.id } });
  await settleAfterChange(row.barMarkId, user.id);
  revalidatePath(`/production/jobs/${row.jobId}`);
  revalidatePath('/production');
  if (row.job.orderId) revalidatePath(`/orders/${row.job.orderId}`);
}

/**
 * Live cast-number check for the "add a row" tally form. Called directly
 * from CastNumberField's onBlur, not through a <form> — the first server
 * action in this codebase invoked as a plain function rather than a form
 * action, which Next.js supports as long as the file has 'use server'.
 */
export async function checkCastNumber(castNumber: string): Promise<CastLookup> {
  const user = await assertPermission('production.progress');
  return lookupCast(getActiveCompany(user), castNumber);
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

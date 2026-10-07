'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { assertCompanyAccess } from '@/lib/company';

// Correcting a BCS tally job after the fact — finished ones from Production
// history mostly. Only for people given "Edit finished BCS production jobs"
// (and admins); every change goes in the activity log with what it was.

async function editableJob(jobId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Sign in again.');
  if (!can(user, 'production.editHistory')) throw new Error('You do not have permission to do that.');
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  assertCompanyAccess(user, job.company);
  if (job.company !== 'BS_SUPPLIES') throw new Error('Only BCS jobs can be edited here.');
  return { user, job };
}

function refresh(jobId: string) {
  revalidatePath('/production');
  revalidatePath('/production/history');
  revalidatePath(`/production/jobs/${jobId}`);
  revalidatePath(`/production/jobs/${jobId}/edit`);
}

/** The bundle fields a BCS row holds. Weight is required; the rest can be blank. */
function rowFields(formData: FormData) {
  const diaRaw = String(formData.get('diaMm') ?? '').trim();
  const diaMm = diaRaw ? Number(diaRaw) : null;
  if (diaMm != null && (!Number.isFinite(diaMm) || diaMm <= 0)) throw new Error('Enter the diameter in mm, or leave it blank.');
  const weightRaw = String(formData.get('tallyWeightKg') ?? '').trim();
  const tallyWeightKg = Number(weightRaw);
  if (!weightRaw || !Number.isFinite(tallyWeightKg) || tallyWeightKg < 0) throw new Error('Enter the weight of the bundle in kg.');
  return {
    machine: String(formData.get('machine') ?? '').trim(),
    steelGrade: String(formData.get('steelGrade') ?? '').trim(),
    diaMm,
    tallyWeightKg,
  };
}

const describe = (r: { machine: string; steelGrade: string; diaMm: unknown; tallyWeightKg: unknown }) =>
  `${r.machine || '—'} · ${r.steelGrade || '—'} · ${r.diaMm != null ? `${Number(r.diaMm)}mm` : '—'} · ${Number(r.tallyWeightKg)} kg`;

export async function updateJobDetails(formData: FormData) {
  const { user, job } = await editableJob(String(formData.get('jobId')));
  const jobNumber = String(formData.get('jobNumber') ?? '').trim();
  if (!jobNumber) throw new Error('Enter a job number.');
  const customerName = String(formData.get('customerName') ?? '').trim();
  if (jobNumber === job.jobNumber && customerName === job.customerName) return;

  // Same best-effort order match as starting a job.
  const order = jobNumber === job.jobNumber ? null : await db.order.findFirst({ where: { company: job.company, number: jobNumber } });
  await db.productionJob.update({
    where: { id: job.id },
    data: { jobNumber, customerName, ...(jobNumber === job.jobNumber ? {} : { orderId: order?.id ?? null }) },
  });
  await logActivity('ProductionJob', job.id, 'Edited from history',
    `Job ${job.jobNumber}${job.customerName ? ` (${job.customerName})` : ''} → ${jobNumber}${customerName ? ` (${customerName})` : ''}`, user.id);
  refresh(job.id);
}

export async function updateJobRow(formData: FormData) {
  const row = await db.productionJobRow.findUniqueOrThrow({ where: { id: String(formData.get('rowId')) } });
  const { user, job } = await editableJob(row.jobId);
  const fields = rowFields(formData);
  if (describe(row) === describe(fields)) return;

  await db.productionJobRow.update({ where: { id: row.id }, data: fields });
  await logActivity('ProductionJob', job.id, 'Row edited from history', `Job ${job.jobNumber}: ${describe(row)} → ${describe(fields)}`, user.id);
  refresh(job.id);
}

/** Field name `id`, for the shared confirm-then-delete button. */
export async function deleteJobRow(formData: FormData) {
  const row = await db.productionJobRow.findUniqueOrThrow({ where: { id: String(formData.get('id')) } });
  const { user, job } = await editableJob(row.jobId);

  await db.productionJobRow.delete({ where: { id: row.id } });
  await logActivity('ProductionJob', job.id, 'Row deleted from history', `Job ${job.jobNumber}: ${describe(row)}`, user.id);
  refresh(job.id);
}

/** A bundle that was cut but never logged. */
export async function addJobRow(formData: FormData) {
  const { user, job } = await editableJob(String(formData.get('jobId')));
  const fields = rowFields(formData);
  const last = await db.productionJobRow.findFirst({ where: { jobId: job.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });

  await db.productionJobRow.create({ data: { jobId: job.id, ...fields, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  await logActivity('ProductionJob', job.id, 'Row added from history', `Job ${job.jobNumber}: ${describe(fields)}`, user.id);
  refresh(job.id);
}

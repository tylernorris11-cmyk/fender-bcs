'use server';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCaresApplies, assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { nextNcrRef } from '@/lib/orders';
import { extractCastNumbers } from '@/lib/certExtraction';

export async function raiseNcr(formData: FormData) {
  const user = await assertPermission('compliance.ncr');
  assertCaresApplies(user);
  const ref = await nextNcrRef();

  const ncr = await db.ncr.create({
    data: {
      ref,
      company: getActiveCompany(user),
      type: String(formData.get('type')) as 'CUSTOMER_COMPLAINT' | 'INTERNAL' | 'SUPPLIER_ISSUE',
      description: String(formData.get('description') ?? '').trim(),
      correctiveAction: String(formData.get('correctiveAction') ?? ''),
      rootCause: String(formData.get('rootCause') ?? ''),
      orderId: String(formData.get('orderId') ?? '') || null,
      customerId: String(formData.get('customerId') ?? '') || null,
      batchId: String(formData.get('batchId') ?? '') || null,
      supplierId: String(formData.get('supplierId') ?? '') || null,
      raisedById: user.id,
    },
  });

  // A supplier problem with a named batch quarantines the steel straight away.
  if (ncr.batchId && ncr.type === 'SUPPLIER_ISSUE') {
    await db.batch.update({
      where: { id: ncr.batchId },
      data: { status: 'Quarantined', quarantineRef: ref },
    });
  }

  await logActivity('Ncr', ncr.id, 'Raised', ncr.description.slice(0, 120), user.id);
  revalidatePath('/compliance/ncr');
  revalidatePath('/compliance');
}

export async function closeNcr(formData: FormData) {
  const user = await assertPermission('compliance.ncr');
  assertCaresApplies(user);
  const id = String(formData.get('ncrId'));
  const correctiveAction = String(formData.get('correctiveAction') ?? '').trim();

  if (!correctiveAction) {
    throw new Error('Record the corrective action before closing. An NCR closed without one is a finding at audit.');
  }

  const existing = await db.ncr.findUniqueOrThrow({ where: { id }, select: { company: true } });
  assertCompanyAccess(user, existing.company);

  await db.ncr.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: user.name, correctiveAction },
  });
  await logActivity('Ncr', id, 'Closed', correctiveAction.slice(0, 120), user.id);
  revalidatePath('/compliance/ncr');
  revalidatePath('/compliance');
}

export async function saveCertificate(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const id = String(formData.get('certificateId') ?? '');

  const data = {
    scheme: String(formData.get('scheme')),
    title: String(formData.get('title')),
    reference: String(formData.get('reference') ?? ''),
    holder: String(formData.get('holder') ?? 'Fender Steel'),
    supplierId: String(formData.get('supplierId') ?? '') || null,
    issuedOn: new Date(String(formData.get('issuedOn'))),
    expiresOn: new Date(String(formData.get('expiresOn'))),
    fileUrl: String(formData.get('fileUrl') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  };

  if (id) {
    const existing = await db.certificate.findUniqueOrThrow({ where: { id }, select: { company: true } });
    assertCompanyAccess(user, existing.company);
    await db.certificate.update({ where: { id }, data });
  } else {
    await db.certificate.create({ data: { ...data, company: getActiveCompany(user) } });
  }

  await logActivity('Certificate', id || data.title, id ? 'Updated' : 'Added', `${data.scheme} · ${data.holder}`, user.id);
  revalidatePath('/compliance/suppliers');
  revalidatePath('/compliance');
}

export async function submitReturn(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const period = String(formData.get('period'));
  const tonnage = Number(formData.get('tonnage'));
  const company = getActiveCompany(user);

  await db.quarterlyReturn.upsert({
    where: { period_company: { period, company } },
    update: { tonnage, submittedAt: new Date(), preparedBy: user.name, reference: String(formData.get('reference') ?? '') },
    create: { period, company, tonnage, submittedAt: new Date(), preparedBy: user.name, reference: String(formData.get('reference') ?? '') },
  });
  await logActivity('QuarterlyReturn', period, 'Submitted', `${tonnage} t`, user.id);
  revalidatePath('/compliance/returns');
}

export async function closeAuditAction(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const id = String(formData.get('actionId'));
  const evidence = String(formData.get('evidence') ?? '').trim();
  if (!evidence) throw new Error('Note the evidence — what changed and where it is recorded.');
  const existing = await db.auditAction.findUniqueOrThrow({ where: { id }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  await db.auditAction.update({ where: { id }, data: { closedAt: new Date(), evidence } });
  await logActivity('AuditAction', id, 'Closed', evidence.slice(0, 120), user.id);
  revalidatePath('/compliance/returns');
  revalidatePath('/compliance');
}

// ------------------------------------------------- test cert cast-number reader

const ALLOWED_CERT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export async function uploadTestCertificate(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const company = getActiveCompany(user);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a PDF or image to upload.');
  if (!ALLOWED_CERT_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPEG or WebP files are supported.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN (create a store in Vercel → Storage → Blob) before uploading.');
  }

  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`test-certs/${Date.now()}-${safeName}`, Buffer.from(bytes), { access: 'private' });

  const certificate = await db.testCertificate.create({
    data: { company, fileUrl: blob.url, fileName: file.name, uploadedById: user.id, status: 'Processing' },
  });

  const { castNumbers, error } = await extractCastNumbers({
    base64: Buffer.from(bytes).toString('base64'),
    mimeType: file.type,
  });

  if (error) {
    await db.testCertificate.update({ where: { id: certificate.id }, data: { status: 'Failed', errorMessage: error } });
  } else if (castNumbers.length === 0) {
    await db.testCertificate.update({
      where: { id: certificate.id },
      data: { status: 'Failed', errorMessage: 'No cast numbers found on this document.' },
    });
  } else {
    await db.extractedCastNumber.createMany({
      data: castNumbers.map((castNumber) => ({ certificateId: certificate.id, castNumber })),
    });
    await db.testCertificate.update({ where: { id: certificate.id }, data: { status: 'NeedsReview' } });
  }

  await logActivity('TestCertificate', certificate.id, 'Uploaded', file.name, user.id);
  revalidatePath('/compliance/test-certs');
}

/**
 * A person confirms the AI read the cast number correctly before it's trusted
 * enough to fill in a batch's mill certificate. If a batch with this heat
 * number is already sitting there missing one, this closes that gap straight
 * away — the same gap "Trace a batch" lists as a broken trail.
 */
export async function confirmCastNumber(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const id = String(formData.get('castId'));

  const cast = await db.extractedCastNumber.findUniqueOrThrow({ where: { id }, include: { certificate: true } });
  assertCompanyAccess(user, cast.certificate.company);
  if (cast.confirmed) return;

  const match = await db.batch.findFirst({
    where: { company: cast.certificate.company, heatNumber: cast.castNumber, millCertUrl: '' },
  });

  await db.extractedCastNumber.update({
    where: { id },
    data: { confirmed: true, confirmedById: user.id, confirmedAt: new Date(), matchedBatchId: match?.id ?? null },
  });

  if (match) {
    await db.batch.update({ where: { id: match.id }, data: { millCertUrl: cast.certificate.fileUrl } });
  }

  const remaining = await db.extractedCastNumber.count({ where: { certificateId: cast.certificateId, confirmed: false } });
  if (remaining === 0) await db.testCertificate.update({ where: { id: cast.certificateId }, data: { status: 'Reviewed' } });

  await logActivity(
    'Batch', match?.id ?? cast.certificateId, 'Cast number confirmed',
    `${cast.castNumber}${match ? ' — matched to a batch missing its mill certificate' : ' — no matching batch yet, will match automatically at goods in'}`,
    user.id,
  );
  revalidatePath('/compliance/test-certs');
  revalidatePath('/compliance/trace');
  revalidatePath('/compliance');
  revalidatePath('/stock');
}

/** The AI misread it, or it isn't actually a cast number — drop the row. */
export async function rejectCastNumber(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const id = String(formData.get('castId'));
  const cast = await db.extractedCastNumber.findUniqueOrThrow({ where: { id }, include: { certificate: true } });
  assertCompanyAccess(user, cast.certificate.company);
  await db.extractedCastNumber.delete({ where: { id } });
  revalidatePath('/compliance/test-certs');
}

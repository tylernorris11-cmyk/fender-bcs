'use server';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import type { CertificateSize, Company, ComplianceDocumentCategory } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCaresApplies, assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { nextNcrRef } from '@/lib/orders';
import { CERT_SIZE_LABEL, CERT_SIZE_ORDER, extractCastNumbers } from '@/lib/certExtraction';
import { shortDate } from '@/lib/format';

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

  const size = String(formData.get('size') ?? '') as CertificateSize;
  if (!CERT_SIZE_ORDER.includes(size)) throw new Error('Choose which size this certificate is for.');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a PDF or image to upload.');
  if (!ALLOWED_CERT_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPEG or WebP files are supported.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN (create a store in Vercel → Storage → Blob) before uploading.');
  }

  // Same file name as one already on file for this company is almost
  // always the same certificate uploaded twice by mistake — a Failed one
  // doesn't count, since that upload never actually took and a retry with
  // the identical file should be allowed.
  const duplicate = await db.testCertificate.findFirst({
    where: { company, fileName: { equals: file.name, mode: 'insensitive' }, status: { not: 'Failed' } },
    orderBy: { uploadedAt: 'desc' },
  });
  if (duplicate) {
    throw new Error(`"${file.name}" was already uploaded on ${shortDate(duplicate.uploadedAt)} (filed under ${duplicate.size ? CERT_SIZE_LABEL[duplicate.size] : 'unspecified size'}) — check the certificate list below before uploading it again.`);
  }

  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`test-certs/${Date.now()}-${safeName}`, Buffer.from(bytes), { access: 'private' });

  const certificate = await db.testCertificate.create({
    data: { company, size, fileUrl: blob.url, fileName: file.name, uploadedById: user.id, status: 'Processing' },
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

  await logActivity('TestCertificate', certificate.id, 'Uploaded', `${CERT_SIZE_LABEL[size]} — ${file.name}`, user.id);
  revalidatePath('/compliance/test-certs');
}

/** Shared by confirmCastNumber and confirmAllCastNumbers — marks one
 * extracted cast number confirmed and files it against a batch that's
 * missing its mill certificate, if one's waiting for it. Doesn't touch the
 * certificate's own status or write an activity log entry; each caller
 * does that once for the whole operation, not once per cast number. */
async function confirmOneCastNumber(
  cast: { id: string; castNumber: string },
  certificate: { company: Company; fileUrl: string },
  userId: string,
): Promise<{ matchedBatchId: string | null }> {
  const match = await db.batch.findFirst({
    where: { company: certificate.company, heatNumber: cast.castNumber, millCertUrl: '' },
  });
  await db.extractedCastNumber.update({
    where: { id: cast.id },
    data: { confirmed: true, confirmedById: userId, confirmedAt: new Date(), matchedBatchId: match?.id ?? null },
  });
  if (match) {
    await db.batch.update({ where: { id: match.id }, data: { millCertUrl: certificate.fileUrl } });
  }
  return { matchedBatchId: match?.id ?? null };
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

  const { matchedBatchId } = await confirmOneCastNumber(cast, cast.certificate, user.id);

  const remaining = await db.extractedCastNumber.count({ where: { certificateId: cast.certificateId, confirmed: false } });
  if (remaining === 0) await db.testCertificate.update({ where: { id: cast.certificateId }, data: { status: 'Reviewed' } });

  await logActivity(
    'Batch', matchedBatchId ?? cast.certificateId, 'Cast number confirmed',
    `${cast.castNumber}${matchedBatchId ? ' — matched to a batch missing its mill certificate' : ' — no matching batch yet, will match automatically at goods in'}`,
    user.id,
  );
  revalidatePath('/compliance/test-certs');
  revalidatePath('/compliance/trace');
  revalidatePath('/compliance');
  revalidatePath('/stock');
}

/** Confirms every still-unconfirmed cast number on one certificate in one
 * go — a certificate that reads back cleanly (the common case) shouldn't
 * need Confirm clicked one at a time for every cast number on it. Same
 * match-to-batch rule as confirming one at a time, just for all of them;
 * logs a single summary line rather than one entry per cast number. */
export async function confirmAllCastNumbers(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const certificateId = String(formData.get('certificateId'));

  const certificate = await db.testCertificate.findUniqueOrThrow({ where: { id: certificateId } });
  assertCompanyAccess(user, certificate.company);

  const casts = await db.extractedCastNumber.findMany({ where: { certificateId, confirmed: false } });
  if (casts.length === 0) return;

  let matched = 0;
  for (const cast of casts) {
    const { matchedBatchId } = await confirmOneCastNumber(cast, certificate, user.id);
    if (matchedBatchId) matched += 1;
  }

  await db.testCertificate.update({ where: { id: certificateId }, data: { status: 'Reviewed' } });

  await logActivity(
    'TestCertificate', certificateId, 'All cast numbers confirmed',
    `${casts.length} confirmed, ${matched} matched to a batch missing its mill certificate`,
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

// ------------------------------------------------- CARES documents
// Reference material (procedures, CARES's own guidance, scope of approval)
// rather than certificates — same upload/archive shape as HS documents.

const ALLOWED_COMPLIANCE_DOC_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export async function uploadComplianceDocument(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const company = getActiveCompany(user);

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Give the document a title.');
  const category = String(formData.get('category') ?? 'OTHER') as ComplianceDocumentCategory;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file to upload.');
  if (!ALLOWED_COMPLIANCE_DOC_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPEG or WebP files are supported.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN before uploading.');
  }

  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`compliance-documents/${Date.now()}-${safeName}`, Buffer.from(bytes), { access: 'private' });

  const doc = await db.complianceDocument.create({
    data: { company, category, title, fileUrl: blob.url, fileName: file.name, uploadedById: user.id },
  });
  await logActivity('ComplianceDocument', doc.id, 'Uploaded', title, user.id);
  revalidatePath('/compliance/documents');
}

export async function archiveComplianceDocument(formData: FormData) {
  const user = await assertPermission('compliance.edit');
  assertCaresApplies(user);
  const id = String(formData.get('id') ?? '');
  const doc = await db.complianceDocument.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, doc.company);

  await db.complianceDocument.update({ where: { id }, data: { archived: true } });
  await logActivity('ComplianceDocument', id, 'Archived', doc.title, user.id);
  revalidatePath('/compliance/documents');
}

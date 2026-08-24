'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCaresApplies, assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { nextNcrRef } from '@/lib/orders';

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
  revalidatePath('/compliance/certificates');
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

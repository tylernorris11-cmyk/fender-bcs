'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Company } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { can, type SessionUser } from '@/lib/rbac';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { checkedNominalCodeId, checkedVatCodeId } from '@/lib/ledger';

/** The stock group chosen on a form, checked to be this company's. */
async function checkedGroup(raw: FormDataEntryValue | null, company: Company) {
  const id = String(raw ?? '');
  if (!id) throw new Error('Choose a stock group.');
  const group = await db.stockGroup.findUnique({ where: { id } });
  if (!group || group.company !== company) throw new Error("That stock group doesn't belong to this company.");
  return group;
}

async function checkedSupplierId(raw: FormDataEntryValue | null, company: Company) {
  const id = String(raw ?? '');
  if (!id) return null;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.company !== company) throw new Error("That supplier doesn't belong to this company.");
  return id;
}

/** VAT code and the three nominal codes a stock record posts to — only an accounts admin sets these. */
async function stockLedgerDefaults(formData: FormData, user: SessionUser, company: Company) {
  if (!can(user, 'accounts.setup')) return {};
  return {
    vatCodeId: await checkedVatCodeId(formData.get('vatCodeId'), company),
    salesNominalId: await checkedNominalCodeId(formData.get('salesNominalId'), company),
    costOfSalesNominalId: await checkedNominalCodeId(formData.get('costOfSalesNominalId'), company),
    stockNominalId: await checkedNominalCodeId(formData.get('stockNominalId'), company),
  };
}

export async function createProduct(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const company = getActiveCompany(user);
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  if (!code || !name) throw new Error('Give it a stock code and a name.');
  if (code.length > 21) throw new Error('Stock codes are 21 characters at most, the same as Exchequer.');
  const group = await checkedGroup(formData.get('stockGroupId'), company);
  const category = group.name;

  if (await db.product.findUnique({ where: { company_code: { company, code } } })) {
    throw new Error(`${code} is already in use. Stock codes have to be unique.`);
  }

  const numOrNull = (key: string) => {
    const raw = formData.get(key);
    return raw != null && raw !== '' ? Number(raw) : null;
  };

  const product = await db.product.create({
    data: {
      company, code, name, category,
      unit: String(formData.get('unit') ?? 't'),
      kgPerUnit: Number(formData.get('kgPerUnit') ?? 1000),
      standard: String(formData.get('standard') ?? ''),
      reorderAt: Number(formData.get('reorderAt') ?? 0),
      isRebar: formData.get('isRebar') === '1',
      lengthFt: numOrNull('lengthFt'),
      lengthIn: numOrNull('lengthIn'),
      thicknessMm: numOrNull('thicknessMm'),
      bundleWeightKg: numOrNull('bundleWeightKg'),
      stockGroupId: group.id,
      preferredSupplierId: await checkedSupplierId(formData.get('preferredSupplierId'), company),
      ...(await stockLedgerDefaults(formData, user, company)),
    },
  });

  await logActivity('Product', product.id, 'Added', `${code} — ${name}`, user.id);
  revalidatePath('/stock');
  redirect(`/stock/${product.id}`);
}

/** The Exchequer stock record fields on an existing product: its group, preferred supplier and the codes it posts to. */
export async function updateStockRecord(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('productId'));
  const product = await db.product.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, product.company);
  const group = await checkedGroup(formData.get('stockGroupId'), product.company);

  await db.product.update({
    where: { id },
    data: {
      stockGroupId: group.id,
      category: group.name,
      preferredSupplierId: await checkedSupplierId(formData.get('preferredSupplierId'), product.company),
      ...(await stockLedgerDefaults(formData, user, product.company)),
    },
  });
  await logActivity('Product', id, 'Stock record updated', '', user.id);
  revalidatePath(`/stock/${id}`);
  revalidatePath('/stock');
}

// ------------------------------------------------------------ stock groups

function readGroupCode(raw: FormDataEntryValue | null) {
  const code = String(raw ?? '').trim().toUpperCase();
  if (code.length > 21) throw new Error('Group codes are 21 characters at most, the same as Exchequer.');
  return code || null;
}

async function checkGroupCodeFree(company: Company, code: string | null, exceptId?: string) {
  if (!code) return;
  const clash = await db.stockGroup.findFirst({ where: { company, code, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw new Error(`Group code ${code} is already used by ${clash.name}.`);
}

export async function addStockGroup(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const company = getActiveCompany(user);
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Give the group a name.');
  const code = readGroupCode(formData.get('code'));
  await checkGroupCodeFree(company, code);

  const parentId = String(formData.get('parentId') ?? '') || null;
  if (parentId) {
    const parent = await db.stockGroup.findUnique({ where: { id: parentId } });
    if (!parent || parent.company !== company) throw new Error("That parent group doesn't belong to this company.");
  }

  const group = await db.stockGroup.create({ data: { company, name, code, parentId } });
  await logActivity('StockGroup', group.id, 'Added', `${code ?? ''} ${name}`.trim(), user.id);
  revalidatePath('/stock/groups');
}

/** Renaming a group renames the category every product in it shows, so the two never disagree. */
export async function updateStockGroup(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('stockGroupId'));
  const group = await db.stockGroup.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, group.company);
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Give the group a name.');
  const code = readGroupCode(formData.get('code'));
  await checkGroupCodeFree(group.company, code, id);

  await db.$transaction([
    db.stockGroup.update({ where: { id }, data: { name, code } }),
    db.product.updateMany({ where: { stockGroupId: id }, data: { category: name } }),
  ]);
  await logActivity('StockGroup', id, 'Updated', `${code ?? ''} ${name}`.trim(), user.id);
  revalidatePath('/stock/groups');
  revalidatePath('/stock');
}

export async function toggleProductActive(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('productId'));
  const product = await db.product.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, product.company);
  await db.product.update({ where: { id }, data: { active: !product.active } });
  await logActivity('Product', id, product.active ? 'Deactivated' : 'Reactivated', '', user.id);
  revalidatePath('/stock');
  revalidatePath(`/stock/${id}`);
}

/**
 * Booking steel in. This is where traceability starts: no batch exists without
 * a heat number and a named supplier, and the mill certificate reference is
 * captured at the gate rather than chased later.
 */
export async function receiveBatch(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');

  const productId = String(formData.get('productId'));
  const supplierId = String(formData.get('supplierId'));
  const heatNumber = String(formData.get('heatNumber') ?? '').trim();
  const qtyReceived = Number(formData.get('qty'));
  let millCertUrl = String(formData.get('millCertUrl') ?? '').trim();

  if (!heatNumber) throw new Error('Enter a batch or delivery reference.');
  if (!(qtyReceived > 0)) throw new Error('Enter how much arrived.');

  const [supplier, product] = await Promise.all([
    db.supplier.findUniqueOrThrow({ where: { id: supplierId }, include: { certificates: { where: { scheme: 'Supplier' } } } }),
    db.product.findUniqueOrThrow({ where: { id: productId } }),
  ]);

  // A Test certs upload may already have confirmed this cast number before the
  // steel itself was booked in — if so, carry its mill certificate straight over.
  let matchedCastId: string | null = null;
  if (!millCertUrl) {
    const preConfirmed = await db.extractedCastNumber.findFirst({
      where: { castNumber: heatNumber, confirmed: true, matchedBatchId: null, certificate: { company: product.company } },
      include: { certificate: true },
    });
    if (preConfirmed) { millCertUrl = preConfirmed.certificate.fileUrl; matchedCastId = preConfirmed.id; }
  }

  // CARES-driven quarantine only applies to Fender's reinforcing steel — BCS
  // Products isn't CARES-approved, so its goods-in never gets held up over a
  // mill certificate or a supplier approval that doesn't apply to it.
  const caresApplies = product.company === 'FENDER';
  const approved = supplier.certificates.some((c) => c.expiresOn > new Date());
  // Booking it in is still allowed — refusing would just mean it gets kept on
  // paper instead. But it lands quarantined and it shows on the alerts list.
  const status = caresApplies && (!approved || !millCertUrl) ? 'Quarantined' : 'Available';
  const unitCostRaw = formData.get('unitCost');
  const unitCost = can(user, 'finance.costs') && unitCostRaw ? Number(unitCostRaw) : null;

  const batch = await db.batch.create({
    data: {
      heatNumber, productId, supplierId, qtyReceived, qtyRemaining: qtyReceived, millCertUrl, status,
      company: product.company,
      unitCost,
      depot: String(formData.get('depot') ?? 'Scunthorpe'),
      certNumber: String(formData.get('certNumber') ?? ''),
      location: String(formData.get('location') ?? ''),
      deliveryNote: String(formData.get('deliveryNote') ?? ''),
      receivedAt: formData.get('receivedAt') ? new Date(String(formData.get('receivedAt'))) : new Date(),
      quarantineRef: status === 'Quarantined' ? (!approved ? 'Supplier approval not on file' : 'Mill certificate not received') : '',
    },
  });

  await db.stockMovement.create({
    data: { productId, batchId: batch.id, type: 'GOODS_IN', qty: qtyReceived, reference: batch.deliveryNote, userId: user.id },
  });
  if (matchedCastId) await db.extractedCastNumber.update({ where: { id: matchedCastId }, data: { matchedBatchId: batch.id } });
  await logActivity('Batch', batch.id, 'Received', `${qtyReceived} of heat ${heatNumber} from ${supplier.name}`, user.id);

  revalidatePath('/stock');
  revalidatePath('/compliance');
  revalidatePath('/compliance/test-certs');
  redirect(`/stock/${productId}`);
}

export async function adjustStock(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const batchId = String(formData.get('batchId'));
  const qty = Number(formData.get('qty'));
  const type = String(formData.get('type')) as 'ADJUSTMENT' | 'SCRAP' | 'RETURNED';
  const reason = String(formData.get('reason') ?? '');
  if (!reason.trim()) throw new Error('Say why — this is the record an auditor reads.');

  const batch = await db.batch.findUniqueOrThrow({ where: { id: batchId } });
  assertCompanyAccess(user, batch.company);
  const delta = type === 'RETURNED' ? qty : -qty;

  await db.batch.update({ where: { id: batchId }, data: { qtyRemaining: { increment: delta } } });
  await db.stockMovement.create({
    data: { productId: batch.productId, batchId, type, qty: Math.abs(qty), reason, userId: user.id },
  });
  await logActivity('Batch', batchId, `Stock ${type.toLowerCase()}`, reason, user.id);
  revalidatePath(`/stock/${batch.productId}`);
}

export async function setBatchStatus(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const batchId = String(formData.get('batchId'));
  const status = String(formData.get('status'));
  const reason = String(formData.get('reason') ?? '');

  const existing = await db.batch.findUniqueOrThrow({ where: { id: batchId }, select: { company: true } });
  assertCompanyAccess(user, existing.company);

  const batch = await db.batch.update({
    where: { id: batchId },
    data: { status, quarantineRef: status === 'Quarantined' ? reason : '' },
  });
  await db.stockMovement.create({
    data: {
      productId: batch.productId, batchId, qty: batch.qtyRemaining,
      type: status === 'Quarantined' ? 'QUARANTINE' : 'RELEASED', reason, userId: user.id,
    },
  });
  await logActivity('Batch', batchId, `Marked ${status}`, reason, user.id);
  revalidatePath(`/stock/${batch.productId}`);
  revalidatePath('/compliance');
}

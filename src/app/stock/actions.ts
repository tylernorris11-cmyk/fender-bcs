'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { assertCompanyAccess } from '@/lib/company';

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
  const millCertUrl = String(formData.get('millCertUrl') ?? '').trim();

  if (!heatNumber) throw new Error('Enter a batch or delivery reference.');
  if (!(qtyReceived > 0)) throw new Error('Enter how much arrived.');

  const [supplier, product] = await Promise.all([
    db.supplier.findUniqueOrThrow({ where: { id: supplierId }, include: { certificates: { where: { scheme: 'Supplier' } } } }),
    db.product.findUniqueOrThrow({ where: { id: productId } }),
  ]);

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
  await logActivity('Batch', batch.id, 'Received', `${qtyReceived} of heat ${heatNumber} from ${supplier.name}`, user.id);

  revalidatePath('/stock');
  revalidatePath('/compliance');
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

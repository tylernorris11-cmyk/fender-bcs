'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess } from '@/lib/company';
import { nextPoNumber, PO_NEXT_STATUS } from '@/lib/purchaseOrders';

/** Read the repeating line rows out of the new-purchase-order form. */
function rows(formData: FormData, prefix: string): Record<string, string>[] {
  const out: Record<string, Record<string, string>> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(new RegExp(`^${prefix}\\[(\\d+)]\\[(\\w+)]$`));
    if (!match) continue;
    (out[match[1]] ??= {})[match[2]] = String(value);
  }
  return Object.keys(out).sort((a, b) => Number(a) - Number(b)).map((k) => out[k]);
}

export async function createPurchaseOrder(formData: FormData) {
  const user = await assertPermission('purchaseOrders.create');

  const supplierId = String(formData.get('supplierId') ?? '');
  if (!supplierId) throw new Error('Choose a supplier before saving.');
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });

  const expectedDateRaw = String(formData.get('expectedDate') ?? '');
  const number = await nextPoNumber();

  const lineRows = rows(formData, 'line').filter((r) => r.description && Number(r.qty) > 0);
  const products = await db.product.findMany({ where: { id: { in: lineRows.map((r) => r.productId).filter(Boolean) } } });

  const po = await db.purchaseOrder.create({
    data: {
      number,
      company: supplier.company,
      supplierId,
      status: 'DRAFT',
      expectedDate: expectedDateRaw ? new Date(expectedDateRaw) : null,
      notes: String(formData.get('notes') ?? ''),
      raisedById: user.id,
      costCentreId: String(formData.get('costCentreId') ?? '') || null,
      lines: {
        create: lineRows.map((r, i) => {
          const product = products.find((p) => p.id === r.productId);
          const qty = Number(r.qty);
          const unitCost = Number(r.unitCost || 0);
          return {
            productId: r.productId || null,
            description: r.description || product?.name || 'Item',
            qty,
            unit: product?.unit ?? 't',
            unitCost,
            lineTotal: +(qty * unitCost).toFixed(2),
            sortOrder: i,
          };
        }),
      },
    },
  });

  await logActivity('PurchaseOrder', po.id, 'Created', `Raised as ${number}`, user.id);

  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${po.id}`);
}

export async function advancePurchaseOrderStatus(formData: FormData) {
  const poId = String(formData.get('purchaseOrderId'));
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });

  const step = PO_NEXT_STATUS[po.status];
  if (!step) throw new Error('This purchase order has nowhere left to go.');
  const user = await assertPermission('purchaseOrders.edit');
  assertCompanyAccess(user, po.company);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { status: step.to };
  if (step.to === 'SENT') data.sentAt = new Date();
  if (step.to === 'CONFIRMED') data.confirmedAt = new Date();
  if (step.to === 'RECEIVED') data.receivedAt = new Date();

  await db.purchaseOrder.update({ where: { id: poId }, data });
  await logActivity('PurchaseOrder', poId, step.label, `${po.status} → ${step.to}`, user.id);

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/purchase-orders');
}

export async function cancelPurchaseOrder(formData: FormData) {
  const user = await assertPermission('purchaseOrders.edit');
  const poId = String(formData.get('purchaseOrderId'));
  const existing = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  await db.purchaseOrder.update({ where: { id: poId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await logActivity('PurchaseOrder', poId, 'Cancelled', '', user.id);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath('/purchase-orders');
}

import 'server-only';
import type { Company, OrderStage } from '@prisma/client';
import { db } from './db';
import { creditBalances } from './alerts';

export const VAT_RATE = 0.2;

type LineLike = { lineTotal: unknown; weightKg?: unknown };

export function orderTotals(order: { lines: LineLike[]; barMarks: LineLike[] }) {
  const net =
    order.lines.reduce((s, l) => s + Number(l.lineTotal), 0) +
    order.barMarks.reduce((s, b) => s + Number(b.lineTotal), 0);
  const weightKg =
    order.lines.reduce((s, l) => s + Number(l.weightKg ?? 0), 0) +
    order.barMarks.reduce((s, b) => s + Number(b.weightKg ?? 0), 0);
  return { net, vat: net * VAT_RATE, gross: net * (1 + VAT_RATE), weightKg };
}

/** FS-26-05301 — FS, financial year, sequence. */
export async function nextOrderNumber(): Promise<string> {
  const now = new Date();
  // UK financial year runs to 31 March, so April onwards belongs to the next one.
  const fy = (now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear()) % 100;
  const prefix = `FS-${String(fy).padStart(2, '0')}-`;
  const last = await db.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 5301;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export async function nextNcrRef(): Promise<string> {
  const fy = String((new Date().getFullYear()) % 100).padStart(2, '0');
  const prefix = `NCR-${fy}-`;
  const last = await db.ncr.findFirst({ where: { ref: { startsWith: prefix } }, orderBy: { ref: 'desc' }, select: { ref: true } });
  const seq = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * What the yard is allowed to do next. Stages only ever move forwards, except
 * that an admin can send an order back to draft to fix a mistake.
 */
export const NEXT_STAGE: Partial<Record<OrderStage, { to: OrderStage; label: string; perm: 'orders.approve' | 'orders.progress' }>> = {
  DRAFT: { to: 'PENDING_APPROVAL', label: 'Submit for approval', perm: 'orders.progress' },
  PENDING_APPROVAL: { to: 'APPROVED', label: 'Approve order', perm: 'orders.approve' },
  APPROVED: { to: 'IN_PRODUCTION', label: 'Start production', perm: 'orders.progress' },
  IN_PRODUCTION: { to: 'READY_FOR_DELIVERY', label: 'Mark ready for delivery', perm: 'orders.progress' },
  READY_FOR_DELIVERY: { to: 'OUT_FOR_DELIVERY', label: 'Mark out for delivery', perm: 'orders.progress' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Mark delivered', perm: 'orders.progress' },
  DELIVERED: { to: 'COMPLETED', label: 'Complete order', perm: 'orders.progress' },
};

/**
 * Credit check. Returns how much room is left on the account, counting
 * everything unpaid and not cancelled. An order that breaches it can still be
 * raised — it just cannot leave Pending approval without someone with
 * `orders.approve` deciding to let it.
 */
export async function creditCheck(customerId: string, addingNet = 0) {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
  const used = (await creditBalances(customer.company)).get(customerId) ?? 0;
  const limit = Number(customer.creditLimit);
  return {
    customer,
    used,
    limit,
    remaining: limit - used,
    breaches: limit > 0 && used + addingNet > limit,
    pctUsed: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
  };
}

/** Attach the standard checklist to a new order. Each company keeps its own list. */
export async function applyChecklistTemplate(orderId: string, company: Company) {
  const template = await db.checklistTemplate.findMany({ where: { company, active: true }, orderBy: { sortOrder: 'asc' } });
  if (template.length === 0) return;
  await db.checklistItem.createMany({
    data: template.map((t) => ({ orderId, label: t.label, sortOrder: t.sortOrder })),
  });
}

/**
 * Pick stock oldest-first against an order line and record the movement.
 * Oldest-first is not a preference — it is how the mill certificate that
 * prints on the delivery note stays the right one for the steel on the lorry.
 */
export async function pickOldestFirst(productId: string, qty: number, reference: string, userId?: string) {
  const batches = await db.batch.findMany({
    where: { productId, status: 'Available', qtyRemaining: { gt: 0 } },
    orderBy: { receivedAt: 'asc' },
  });

  let outstanding = qty;
  const picked: { batchId: string; heatNumber: string; certNumber: string; qty: number }[] = [];

  for (const batch of batches) {
    if (outstanding <= 0) break;
    const take = Math.min(outstanding, Number(batch.qtyRemaining));
    outstanding -= take;
    picked.push({ batchId: batch.id, heatNumber: batch.heatNumber, certNumber: batch.certNumber, qty: take });

    await db.batch.update({
      where: { id: batch.id },
      data: {
        qtyRemaining: { decrement: take },
        status: Number(batch.qtyRemaining) - take <= 0 ? 'Consumed' : 'Available',
      },
    });
    await db.stockMovement.create({
      data: { productId, batchId: batch.id, type: 'PICKED', qty: take, reference, userId },
    });
  }

  return { picked, shortfall: outstanding };
}

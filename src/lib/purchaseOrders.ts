import 'server-only';
import { db } from './db';

type PoLineLike = { lineTotal: unknown };

export function poTotal(po: { lines: PoLineLike[] }) {
  return po.lines.reduce((s, l) => s + Number(l.lineTotal), 0);
}

/** PO-26-0001 — PO, financial year, sequence. */
export async function nextPoNumber(): Promise<string> {
  const now = new Date();
  const fy = (now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear()) % 100;
  const prefix = `PO-${String(fy).padStart(2, '0')}-`;
  const last = await db.purchaseOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  CONFIRMED: 'Confirmed',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

/** What can happen next to a purchase order. */
export const PO_NEXT_STATUS: Partial<Record<string, { to: string; label: string }>> = {
  DRAFT: { to: 'SENT', label: 'Mark sent' },
  SENT: { to: 'CONFIRMED', label: 'Mark confirmed' },
  CONFIRMED: { to: 'RECEIVED', label: 'Mark received' },
};

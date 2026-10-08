import 'server-only';
import type { ProductionProcess } from '@prisma/client';
import { db } from './db';
import { logActivity } from './auth';
import { pickOldestFirst } from './orders';
import { isStraight, machinesFor } from './productionSplit';

/**
 * Going into production is where steel is allocated and traceability
 * starts: each rebar stock line on the order is picked oldest cast first.
 * Lines already picked are left alone, so this is safe to run twice.
 */
export async function allocateLineStock(orderId: string, orderNumber: string, userId: string) {
  const lines = await db.orderLine.findMany({ where: { orderId }, include: { picks: { select: { id: true } } } });
  for (const line of lines) {
    if (!line.productId || line.picks.length > 0) continue;
    const product = await db.product.findUnique({ where: { id: line.productId } });
    if (!product?.isRebar) continue;
    const { picked, shortfall } = await pickOldestFirst(line.productId, Number(line.qty), orderNumber, userId);
    if (picked.length > 0) {
      await db.orderLineBatch.createMany({
        data: picked.map((p) => ({ orderLineId: line.id, batchId: p.batchId, qty: p.qty })),
      });
    }
    if (shortfall > 0) {
      await logActivity('Order', orderId, 'Short on stock', `${shortfall} short on ${line.description}`, userId);
    }
  }
}

/** Which machines each bar mark has been through, from the rows ticked off the schedule. */
export function doneByMark(rows: { barMarkId: string | null; process: ProductionProcess | null }[]) {
  const done = new Map<string, Set<ProductionProcess>>();
  for (const r of rows) {
    if (!r.barMarkId || !r.process) continue;
    (done.get(r.barMarkId) ?? done.set(r.barMarkId, new Set()).get(r.barMarkId)!).add(r.process);
  }
  return done;
}

/**
 * After a bar mark is ticked off or undone: its status (Scheduled, Cut once
 * it's off the Cutter, Bent or Cut once it's finished), and the order moved
 * to ready for delivery when every mark is through every machine — or back
 * into production if one's undone after that. A mark that's since been
 * dimension-checked or tagged keeps that status.
 */
export async function settleAfterChange(barMarkId: string, userId: string) {
  const mark = await db.barMark.findUniqueOrThrow({
    where: { id: barMarkId },
    include: { productionRows: { select: { process: true } }, order: { select: { id: true, number: true, stage: true } } },
  });
  const done = new Set(mark.productionRows.map((r) => r.process));
  const finished = machinesFor(mark).every((p) => done.has(p));
  const status = finished ? (isStraight(mark) ? 'Cut' : 'Bent') : done.has('CUTTING') ? 'Cut' : 'Scheduled';
  if (['Scheduled', 'Cut', 'Bent'].includes(mark.status) && mark.status !== status) {
    await db.barMark.update({ where: { id: barMarkId }, data: { status } });
  }

  const { order } = mark;
  if (order.stage !== 'IN_PRODUCTION' && order.stage !== 'READY_FOR_DELIVERY') return;
  const [marks, rows] = await Promise.all([
    db.barMark.findMany({ where: { orderId: order.id }, select: { id: true, diaMm: true, shapeCode: true } }),
    db.productionJobRow.findMany({ where: { scheduleMark: { orderId: order.id } }, select: { barMarkId: true, process: true } }),
  ]);
  const byMark = doneByMark(rows);
  const allDone = marks.every((m) => machinesFor(m).every((p) => byMark.get(m.id)?.has(p)));

  if (allDone && order.stage === 'IN_PRODUCTION') {
    const moved = await db.order.updateMany({ where: { id: order.id, stage: 'IN_PRODUCTION' }, data: { stage: 'READY_FOR_DELIVERY' } });
    if (moved.count) await logActivity('Order', order.id, 'Ready for delivery', 'Every bar mark is through production', userId);
  } else if (!allDone && order.stage === 'READY_FOR_DELIVERY') {
    const moved = await db.order.updateMany({ where: { id: order.id, stage: 'READY_FOR_DELIVERY' }, data: { stage: 'IN_PRODUCTION' } });
    if (moved.count) await logActivity('Order', order.id, 'Back in production', 'A bar mark was undone in production', userId);
  }
}

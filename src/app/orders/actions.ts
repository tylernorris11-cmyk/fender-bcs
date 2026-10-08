'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type OrderStage } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { suggestAccountCode } from '@/lib/accountCodes';
import { tidyTicketColour } from '@/lib/ticketColours';
import { applyChecklistTemplate, creditCheck, nextOrderNumber, NEXT_STAGE, pickOldestFirst, ticketColourOptions } from '@/lib/orders';
import { barWeightKg, shapeName } from '@/lib/bs8666';
import { feetInches } from '@/lib/format';

/** Read the repeating product / bar-mark rows out of the new-order form. */
function rows(formData: FormData, prefix: string): Record<string, string>[] {
  const out: Record<string, Record<string, string>> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(new RegExp(`^${prefix}\\[(\\d+)]\\[(\\w+)]$`));
    if (!match) continue;
    (out[match[1]] ??= {})[match[2]] = String(value);
  }
  return Object.keys(out).sort((a, b) => Number(a) - Number(b)).map((k) => out[k]);
}

/** The ticket colour picked or typed in, tidied to match one used before when it's the same colour; blank for none. */
async function ticketColourFrom(formData: FormData) {
  const typed = String(formData.get('ticketColour') ?? '');
  return typed.trim() ? tidyTicketColour(typed, await ticketColourOptions()) : '';
}

/** The job number typed on the form, or the next automatic one when it's left blank. */
async function orderNumberFor(formData: FormData) {
  const typed = String(formData.get('number') ?? '').trim();
  if (!typed) return nextOrderNumber();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]{0,39}$/.test(typed)) {
    throw new Error('A job number can only use letters, numbers, spaces, dots, dashes and slashes, up to 40 characters.');
  }
  const taken = await db.order.findFirst({ where: { number: { equals: typed, mode: 'insensitive' } }, select: { number: true } });
  if (taken) throw new Error(`Job number ${taken.number} is already used by another order.`);
  return typed;
}

export async function createOrder(formData: FormData) {
  const user = await assertPermission('orders.create');

  // Either an account picked from the list, or a name typed in for someone
  // who isn't on it yet: that opens a basic account for them (on no credit
  // limit, as any new account starts), unless an account of that name exists.
  const newCustomerName = String(formData.get('newCustomerName') ?? '').trim();
  const customerId = String(formData.get('customerId') ?? '');
  if (!newCustomerName && !customerId) throw new Error('Choose a customer, or type the name of one who is not on the list.');
  const company = getActiveCompany(user);
  const existing = newCustomerName
    ? await db.customer.findFirst({ where: { company, name: { equals: newCustomerName, mode: 'insensitive' } } })
    : await db.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (existing) assertCompanyAccess(user, existing.company);

  const deliveryDateRaw = String(formData.get('deliveryDate') ?? '');
  const number = await orderNumberFor(formData);
  const ticketColour = await ticketColourFrom(formData);
  const invoiceAddress = String(formData.get('invoiceAddress') ?? '').trim();

  const productRows = rows(formData, 'product').filter((r) => r.productId && Number(r.qty) > 0);
  const barRows = rows(formData, 'bar').filter((r) => r.mark && Number(r.bars) > 0);
  const fenceRows = rows(formData, 'fence').filter((r) => r.thicknessMm && Number(r.qty) > 0);

  const products = await db.product.findMany({
    where: { id: { in: productRows.map((r) => r.productId) } },
  });

  // Fence post is described inline (length, thickness) rather than picked from Stock —
  // BCS Products cuts it to length from coil, so there's no catalogue SKU to require.
  const fenceLines = fenceRows.map((r) => {
    const qty = Number(r.qty);
    const unitPrice = Number(r.unitPrice || 0);
    const label = feetInches(r.lengthFt ? Number(r.lengthFt) : null, r.lengthIn ? Number(r.lengthIn) : null);
    return {
      productId: null,
      description: `${label ? `${label} x ` : ''}${r.thicknessMm}mm fence post`,
      qty,
      unit: 't',
      unitPrice,
      lineTotal: +(qty * unitPrice).toFixed(2),
      weightKg: +(qty * 1000).toFixed(3),
    };
  });

  const save = () => db.$transaction(async (tx) => {
    const customer = existing ?? await tx.customer.create({
      data: {
        company,
        name: newCustomerName,
        code: await suggestAccountCode(newCustomerName, async (code) => !!(await tx.customer.findFirst({ where: { company, code }, select: { id: true } }))),
        // A new account's address is the invoice address it was opened with.
        address: invoiceAddress,
        notes: `Opened with order ${number}.`,
      },
    });
    // Fender's own delivery note numbers (FS0001…), one per order, in order of saving.
    const deliveryNoteSeq = customer.company === 'FENDER'
      ? ((await tx.order.aggregate({ where: { company: 'FENDER' }, _max: { deliveryNoteSeq: true } }))._max.deliveryNoteSeq ?? 0) + 1
      : null;
    const order = await tx.order.create({
      data: {
        number,
        company: customer.company,
        customerId: customer.id,
        deliveryNoteSeq,
        invoiceAddress,
        stage: 'DRAFT',
        deliveryDate: deliveryDateRaw ? new Date(deliveryDateRaw) : null,
        depot: String(formData.get('depot') ?? 'Scunthorpe'),
        town: String(formData.get('town') ?? ''),
        address: String(formData.get('address') ?? ''),
        poNumber: String(formData.get('poNumber') ?? ''),
        ticketColour,
        yardNotes: String(formData.get('yardNotes') ?? ''),
        raisedById: user.id,
        lines: {
          create: [
            ...productRows.map((r) => {
              const product = products.find((p) => p.id === r.productId);
              const qty = Number(r.qty);
              const unitPrice = Number(r.unitPrice || 0);
              return {
                productId: r.productId,
                description: product?.name ?? 'Item',
                qty,
                unit: product?.unit ?? 'each',
                unitPrice,
                lineTotal: +(qty * unitPrice).toFixed(2),
                weightKg: +(qty * Number(product?.kgPerUnit ?? 0)).toFixed(3),
              };
            }),
            ...fenceLines,
          ].map((line, i) => ({ ...line, sortOrder: i })),
        },
        barMarks: {
          create: barRows.map((r, i) => {
            const dia = Number(r.diaMm);
            const lengthMm = Number(r.lengthMm);
            const bars = Number(r.bars);
            const weightKg = barWeightKg(dia, lengthMm, bars);
            const unitPrice = Number(r.unitPrice || 0);
            return {
              mark: r.mark,
              diaMm: dia,
              grade: (r.grade || 'H').toUpperCase(),
              shapeCode: r.shapeCode || '99',
              shapeName: shapeName(r.shapeCode || '99'),
              lengthMm,
              bars,
              a: r.a ? Number(r.a) : null,
              b: r.b ? Number(r.b) : null,
              c: r.c ? Number(r.c) : null,
              d: r.d ? Number(r.d) : null,
              ef: r.ef ? Number(r.ef) : null,
              radiusMm: r.radiusMm ? Number(r.radiusMm) : null,
              weightKg,
              unitPrice,
              lineTotal: +(bars * unitPrice).toFixed(2),
              sortOrder: i,
            };
          }),
        },
      },
    });
    return { order, customer };
  });

  // Two orders saved at the same moment can reach for the same delivery note
  // number; the database refuses the second, which just tries the next one.
  // The same refusal on the job number means someone else has just used it.
  let saved: Awaited<ReturnType<typeof save>> | undefined;
  for (let attempt = 1; !saved; attempt++) {
    try {
      saved = await save();
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      if (String(err.meta?.target ?? '').includes('deliveryNoteSeq') && attempt < 5) continue;
      throw new Error(`Job number ${number} has just been used by another order. Choose another.`);
    }
  }
  const { order, customer } = saved;

  if (!existing) await logActivity('Customer', customer.id, 'Account opened', `${customer.code} ${customer.name}, with order ${number}`, user.id);
  await applyChecklistTemplate(order.id, customer.company);
  await logActivity('Order', order.id, 'Created', `Raised as ${number}`, user.id);

  revalidatePath('/orders');
  redirect(`/orders/${order.id}`);
}

export async function advanceStage(formData: FormData) {
  const orderId = String(formData.get('orderId'));
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { include: { picks: { select: { id: true } } } }, barMarks: true, customer: true },
  });

  const step = NEXT_STAGE[order.stage];
  if (!step) throw new Error('This order has nowhere left to go.');
  const user = await assertPermission(step.perm);
  assertCompanyAccess(user, order.company);

  // Approving is the credit gate. Everything downstream assumes it was checked.
  if (step.to === 'APPROVED') {
    const check = await creditCheck(order.customerId);
    if (check.breaches && !order.overrideCredit) {
      const override = formData.get('override') === 'on';
      if (!override) {
        throw new Error(
          `${order.customer.name} is over its £${check.limit.toLocaleString('en-GB')} credit limit. ` +
          'Tick the override box to approve anyway — it will be recorded against your name.',
        );
      }
      await db.order.update({ where: { id: orderId }, data: { overrideCredit: true } });
      await logActivity('Order', orderId, 'Credit limit overridden', `Approved by ${user.name} over the limit`, user.id);
    }
  }

  // Going into production is where steel is allocated and traceability starts.
  if (step.to === 'IN_PRODUCTION') {
    for (const line of order.lines) {
      if (!line.productId || line.picks.length > 0) continue;
      const product = await db.product.findUnique({ where: { id: line.productId } });
      if (!product?.isRebar) continue;
      const { picked, shortfall } = await pickOldestFirst(line.productId, Number(line.qty), order.number, user.id);
      if (picked.length > 0) {
        await db.orderLineBatch.createMany({
          data: picked.map((p) => ({ orderLineId: line.id, batchId: p.batchId, qty: p.qty })),
        });
      }
      if (shortfall > 0) {
        await logActivity('Order', orderId, 'Short on stock', `${shortfall} short on ${line.description}`, user.id);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { stage: step.to };
  if (step.to === 'APPROVED') { data.approvedAt = new Date(); data.approvedBy = user.name; }
  if (step.to === 'DELIVERED') data.deliveredAt = new Date();
  if (step.to === 'COMPLETED') data.completedAt = new Date();

  await db.order.update({ where: { id: orderId }, data });
  await logActivity('Order', orderId, step.label, `${order.stage} → ${step.to}`, user.id);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath('/planning');
}

export async function setStage(formData: FormData) {
  const user = await assertPermission('orders.approve');
  const orderId = String(formData.get('orderId'));
  const existing = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  const stage = String(formData.get('stage')) as OrderStage;
  await db.order.update({ where: { id: orderId }, data: { stage } });
  await logActivity('Order', orderId, 'Stage changed by hand', `Set to ${stage}`, user.id);
  revalidatePath(`/orders/${orderId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const user = await assertPermission('orders.progress');
  const id = String(formData.get('itemId'));
  const item = await db.checklistItem.findUniqueOrThrow({ where: { id }, include: { order: { select: { company: true } } } });
  assertCompanyAccess(user, item.order.company);
  await db.checklistItem.update({
    where: { id },
    data: item.done
      ? { done: false, doneById: null, doneAt: null }
      : { done: true, doneById: user.id, doneAt: new Date() },
  });
  revalidatePath(`/orders/${item.orderId}`);
}

export async function addChecklistItem(formData: FormData) {
  const user = await assertPermission('orders.progress');
  const orderId = String(formData.get('orderId'));
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { company: true } });
  assertCompanyAccess(user, order.company);
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;
  const count = await db.checklistItem.count({ where: { orderId } });
  await db.checklistItem.create({ data: { orderId, label, sortOrder: count } });
  revalidatePath(`/orders/${orderId}`);
}

export async function removeChecklistItem(formData: FormData) {
  const user = await assertPermission('orders.progress');
  const id = String(formData.get('itemId'));
  const existing = await db.checklistItem.findUniqueOrThrow({ where: { id }, include: { order: { select: { company: true } } } });
  assertCompanyAccess(user, existing.order.company);
  const item = await db.checklistItem.delete({ where: { id } });
  revalidatePath(`/orders/${item.orderId}`);
}

export async function markPaid(formData: FormData) {
  const user = await assertPermission('orders.markPaid');
  const orderId = String(formData.get('orderId'));
  const existing = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  const undo = formData.get('undo') === '1';
  await db.order.update({
    where: { id: orderId },
    data: undo ? { paymentStatus: 'UNPAID', paidAt: null } : { paymentStatus: 'PAID', paidAt: new Date() },
  });
  await logActivity('Order', orderId, undo ? 'Payment reversed' : 'Marked paid', '', user.id);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/customers');
}

export async function archiveOrder(formData: FormData) {
  const user = await assertPermission('orders.archive');
  const orderId = String(formData.get('orderId'));
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertCompanyAccess(user, order.company);
  await db.order.update({ where: { id: orderId }, data: { archived: !order.archived } });
  await logActivity('Order', orderId, order.archived ? 'Restored' : 'Archived', '', user.id);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}

export async function setTicketColour(formData: FormData) {
  const user = await assertPermission('orders.edit');
  const orderId = String(formData.get('orderId'));
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { company: true, ticketColour: true } });
  assertCompanyAccess(user, order.company);
  const ticketColour = await ticketColourFrom(formData);
  if (ticketColour === order.ticketColour) return;
  await db.order.update({ where: { id: orderId }, data: { ticketColour } });
  await logActivity('Order', orderId, 'Ticket colour', `${order.ticketColour || 'none'} → ${ticketColour || 'none'}`, user.id);
  revalidatePath(`/orders/${orderId}`);
}

export async function updateDelivery(formData: FormData) {
  const user = await assertPermission('orders.edit');
  const orderId = String(formData.get('orderId'));
  const existing = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  const date = String(formData.get('deliveryDate') ?? '');
  await db.order.update({
    where: { id: orderId },
    data: {
      deliveryDate: date ? new Date(date) : null,
      town: String(formData.get('town') ?? ''),
      address: String(formData.get('address') ?? ''),
      poNumber: String(formData.get('poNumber') ?? ''),
    },
  });
  revalidatePath(`/orders/${orderId}`);
}

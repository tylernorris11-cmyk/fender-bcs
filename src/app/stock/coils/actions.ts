'use server';

import { revalidatePath } from 'next/cache';
import type { CoilGrade } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';

const GRADES: CoilGrade[] = ['SOFT', 'MEDIUM', 'HIGH_CARBON'];
const NEXT_COIL_REF_KEY = 'nextCoilRef';

/**
 * Issues a batch of 4-digit coil numbers ahead of the steel actually
 * arriving, so they're ready to write onto the coils at the gate.
 * A number on its own isn't stock — see receiveCoil — it's just a ticket
 * waiting for a coil to be matched up to it.
 */
export async function allocateCoilNumbers(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Coil numbers are a BCS Products thing.');

  const count = Number(formData.get('count'));
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error('Enter how many numbers you need (1–200 at a time).');
  }

  // The sequence is tracked on its own in Setting rather than derived from
  // the highest ref in the table — a coil added via "already in the yard"
  // (addExistingCoil, below) carries whatever code was already written on
  // it, some of them from well before this system existed (into the
  // thousands), and MAX(ref) across every coil picked those up too, jumping
  // the generator straight past them instead of carrying on cleanly from
  // where the sequence itself had actually got to.
  const setting = await db.setting.findUnique({ where: { key: NEXT_COIL_REF_KEY } });
  // First-ever run: 0001–0031 were already used (0001–0021 before this
  // system went live, 0022–0031 issued since) — 32 picks up where that left
  // off rather than restarting at 1.
  let next = setting ? Number(setting.value) : 32;

  const taken = new Set((await db.coil.findMany({ select: { ref: true } })).map((c) => c.ref));
  const refs: string[] = [];
  while (refs.length < count) {
    const candidate = String(next).padStart(4, '0');
    next += 1;
    if (taken.has(candidate)) continue; // an old "already in the yard" code happens to sit in the sequence's path — skip it, never hand out a ref twice
    refs.push(candidate);
  }

  const coils = await db.$transaction(
    refs.map((ref) => db.coil.create({ data: { ref, company, allocatedById: user.id } })),
  );
  await db.setting.upsert({
    where: { key: NEXT_COIL_REF_KEY },
    create: { key: NEXT_COIL_REF_KEY, value: String(next) },
    update: { value: String(next) },
  });

  await logActivity('Coil', coils[0].id, 'Numbers allocated', `${refs[0]}–${refs[refs.length - 1]} (${count})`, user.id);
  revalidatePath('/stock/coils');
}

/**
 * Fills in a pre-allocated number once the coil it's for has actually
 * turned up — this is the moment it becomes real stock (see the Coil model
 * comment: receivedAt null means it isn't stock yet).
 */
export async function receiveCoil(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  const id = String(formData.get('coilId'));
  const coil = await db.coil.findUniqueOrThrow({ where: { id } });
  if (coil.company !== 'BS_SUPPLIES') throw new Error('Not found.');
  if (coil.receivedAt) throw new Error('This coil has already been received.');

  const grade = String(formData.get('grade') ?? '') as CoilGrade;
  if (!GRADES.includes(grade)) throw new Error('Choose the grade — soft, medium or high carbon.');
  const diameterMm = Number(formData.get('diameterMm'));
  if (!(diameterMm > 0)) throw new Error('Enter the diameter.');
  const weightKg = Number(formData.get('weightKg'));
  if (!(weightKg > 0)) throw new Error('Enter the weight.');

  await db.coil.update({
    where: { id },
    data: {
      grade, diameterMm, weightKg,
      note: String(formData.get('note') ?? '').trim(),
      receivedAt: new Date(),
      receivedById: user.id,
    },
  });

  await logActivity('Coil', id, 'Received', `${coil.ref} — ${grade.replace('_', ' ').toLowerCase()}, ${diameterMm}mm, ${weightKg} kg`, user.id);
  revalidatePath('/stock/coils');
}

/**
 * Cancels a number that was issued but never matched to a coil — printed
 * wrong, the delivery didn't turn up, whatever. Only allowed before it's
 * received: once a coil is real stock it needs an adjustment, not a delete.
 */
export async function cancelCoilAllocation(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  const id = String(formData.get('coilId'));
  const coil = await db.coil.findUniqueOrThrow({ where: { id } });
  if (coil.company !== 'BS_SUPPLIES') throw new Error('Not found.');
  if (coil.receivedAt) throw new Error('This coil is already in stock — it can only be removed as a stock adjustment.');

  await db.coil.delete({ where: { id } });
  await logActivity('Coil', id, 'Allocation cancelled', `${coil.ref} — removed before a coil was matched to it`, user.id);
  revalidatePath('/stock/coils');
}

/**
 * A coil that's already on site with its own 4-digit code already written
 * on it — from before the system went live, or one that got missed —
 * rather than a number this system generated. Goes straight into stock in
 * one step, keyed to whatever code is already on it instead of the next
 * number in sequence.
 */
export async function addExistingCoil(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Coil numbers are a BCS Products thing.');

  const refInput = String(formData.get('ref') ?? '').trim();
  if (!/^\d{1,4}$/.test(refInput)) throw new Error('Enter the 4-digit number written on the coil.');
  const ref = refInput.padStart(4, '0');

  const clash = await db.coil.findUnique({ where: { ref } });
  if (clash) throw new Error(`${ref} is already in the system${clash.receivedAt ? '' : ' — allocated but not yet received'}.`);

  const grade = String(formData.get('grade') ?? '') as CoilGrade;
  if (!GRADES.includes(grade)) throw new Error('Choose the grade — soft, medium or high carbon.');
  const diameterMm = Number(formData.get('diameterMm'));
  if (!(diameterMm > 0)) throw new Error('Enter the diameter.');
  const weightKg = Number(formData.get('weightKg'));
  if (!(weightKg > 0)) throw new Error('Enter the weight.');

  const coil = await db.coil.create({
    data: {
      ref, company, grade, diameterMm, weightKg,
      note: String(formData.get('note') ?? '').trim(),
      allocatedById: user.id,
      receivedAt: new Date(),
      receivedById: user.id,
    },
  });

  await logActivity('Coil', coil.id, 'Added to stock', `${ref} — already in the yard, ${grade.replace('_', ' ').toLowerCase()}, ${diameterMm}mm, ${weightKg} kg`, user.id);
  revalidatePath('/stock/coils');
}

/**
 * Removes a coil that's already real stock — used up, scrapped, entered
 * wrong and easier to redo than fix. A stock.adjust action rather than
 * stock.goodsIn, since this is a write-off of stock that exists, not
 * undoing a number that was never matched to anything (see
 * cancelCoilAllocation for that one).
 */
export async function removeCoilFromStock(formData: FormData) {
  const user = await assertPermission('stock.adjust');
  const id = String(formData.get('coilId'));
  const coil = await db.coil.findUniqueOrThrow({ where: { id } });
  if (coil.company !== 'BS_SUPPLIES') throw new Error('Not found.');
  if (!coil.receivedAt) throw new Error("This coil isn't in stock yet — cancel the allocation instead.");

  await db.coil.delete({ where: { id } });
  await logActivity(
    'Coil',
    id,
    'Removed from stock',
    `${coil.ref} — ${coil.grade ? coil.grade.replace('_', ' ').toLowerCase() : 'no grade'}, ${coil.diameterMm}mm, ${coil.weightKg} kg`,
    user.id,
  );
  revalidatePath('/stock/coils/stock');
  revalidatePath('/stock/coils');
}

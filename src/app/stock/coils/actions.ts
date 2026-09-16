'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CoilGrade } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';

const GRADES: CoilGrade[] = ['SOFT', 'MEDIUM', 'HIGH_CARBON'];

/**
 * Issues a batch of 4-digit coil numbers ahead of the steel actually
 * arriving, so they can be printed and stuck on the coils at the gate.
 * A number on its own isn't stock — see receiveCoil — it's just a ticket
 * waiting for a coil to be matched up against it.
 */
export async function allocateCoilNumbers(formData: FormData) {
  const user = await assertPermission('stock.goodsIn');
  const company = getActiveCompany(user);
  if (company !== 'BS_SUPPLIES') throw new Error('Coil numbers are a BCS Products thing.');

  const count = Number(formData.get('count'));
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error('Enter how many numbers you need (1–200 at a time).');
  }

  // Plain sequential 4-digit numbers — find the highest one issued so far
  // and count up from there, same idea as every other reference number in
  // this app (order/PO/asset refs). Computed from the refs themselves
  // rather than "whichever row has the latest allocatedAt" — that sounds
  // equivalent but isn't: allocatedAt is a timestamp, not the sequence
  // itself, and anything that ever disagrees with strict ref order (a
  // backfilled batch, a clock correction) would make the "last" row by
  // time not actually be the highest number, handing out a ref that's
  // already in use.
  const existing = await db.coil.findMany({ select: { ref: true } });
  // Numbering starts at 0022 — 0001–0021 were already used before the coil
  // system went live, so the floor keeps the sequence picking up where the
  // real paper tally left off rather than restarting at 1.
  const start = Math.max(21, ...existing.map((c) => Number(c.ref))) + 1;
  const refs = Array.from({ length: count }, (_, i) => String(start + i).padStart(4, '0'));

  const coils = await db.$transaction(
    refs.map((ref) => db.coil.create({ data: { ref, company, allocatedById: user.id } })),
  );

  await logActivity('Coil', coils[0].id, 'Numbers allocated', `${refs[0]}–${refs[refs.length - 1]} (${count})`, user.id);
  revalidatePath('/stock/coils');
  redirect(`/stock/coils/print?refs=${refs.join(',')}`);
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

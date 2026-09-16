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
  const start = existing.length > 0 ? Math.max(...existing.map((c) => Number(c.ref))) + 1 : 1;
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

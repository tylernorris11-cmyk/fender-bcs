import type { Company } from '@prisma/client';
import { db } from './db';

export type CastLookup = { inStock: boolean; certificate: boolean };

/**
 * Where a cast number on a tally row is known from: a coil or bundle in
 * Fender's light/heavy gauge stock, and a confirmed cast on an uploaded mill
 * certificate. The old batch records still count towards "on a certificate"
 * for casts booked in before stock was restarted. Matched ignoring case,
 * since stock stores casts in capitals and certificates as read.
 */
export async function lookupCast(company: Company, castNumber: string): Promise<CastLookup> {
  const value = castNumber.trim();
  if (!value) return { inStock: false, certificate: false };
  const match = { equals: value, mode: 'insensitive' as const };

  const [stock, cert, batch] = await Promise.all([
    db.steelStockItem.findFirst({ where: { company, castNumber: match }, select: { id: true } }),
    db.extractedCastNumber.findFirst({ where: { confirmed: true, castNumber: match, certificate: { company } }, select: { id: true } }),
    db.batch.findFirst({ where: { company, heatNumber: match }, select: { id: true } }),
  ]);
  return { inStock: !!stock, certificate: !!cert || !!batch };
}

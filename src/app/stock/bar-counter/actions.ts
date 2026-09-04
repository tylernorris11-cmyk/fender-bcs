'use server';

import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';
import { Prisma, type BarCountMode } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { detectBarCircles, type DetectedCircle } from '@/lib/barDetection';
import { estimateBarCount } from '@/lib/barCountAI';

const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VALID_MODES: BarCountMode[] = ['CIRCLE_DETECTOR', 'AI_ESTIMATE', 'BOTH'];

export type BarDetectResult =
  | { ok: false; error: string }
  | {
      ok: true;
      mode: BarCountMode;
      photoUrl: string;
      photoWidth: number;
      photoHeight: number;
      detectedCount: number | null;
      circles: DetectedCircle[];
      aiEstimateCount: number | null;
      aiEstimateError: string;
    };

/** Uploads the photo once and runs whichever detector(s) the worker picked.
 * No DB write here — a BarCount row only exists once confirmed, so trying a
 * different photo or mode before confirming just leaves an unused Blob file. */
export async function runBarDetection(formData: FormData): Promise<BarDetectResult> {
  await assertPermission('stock.goodsIn');

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo first.' };
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return { ok: false, error: 'Only PNG, JPEG or WebP photos are supported.' };
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: 'File storage is not set up yet — add BLOB_READ_WRITE_TOKEN before uploading a photo.' };
  }

  const mode = String(formData.get('mode') ?? '') as BarCountMode;
  if (!VALID_MODES.includes(mode)) return { ok: false, error: 'Choose Circle detector, AI estimate, or Both.' };

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`bar-counts/${Date.now()}-${safeName}`, buffer, { access: 'private' });

  let detectedCount: number | null = null;
  let circles: DetectedCircle[] = [];
  let photoWidth = 0;
  let photoHeight = 0;
  if (mode === 'CIRCLE_DETECTOR' || mode === 'BOTH') {
    const result = await detectBarCircles(buffer, file.type);
    if (result.error) return { ok: false, error: result.error };
    circles = result.circles;
    detectedCount = result.circles.length;
    photoWidth = result.width;
    photoHeight = result.height;
  }

  let aiEstimateCount: number | null = null;
  let aiEstimateError = '';
  if (mode === 'AI_ESTIMATE' || mode === 'BOTH') {
    const result = await estimateBarCount({ base64: buffer.toString('base64'), mimeType: file.type });
    aiEstimateCount = result.count;
    aiEstimateError = result.error ?? '';
  }

  return {
    ok: true, mode, photoUrl: blob.url, photoWidth, photoHeight,
    detectedCount, circles, aiEstimateCount, aiEstimateError,
  };
}

/** Saves the worker's confirmed count. When a corrected circle array is
 * present the confirmed count is always recomputed from its length server
 * side, so the stored number can never drift from the stored positions —
 * only AI-only mode (no overlay to correct) takes a typed count directly. */
export async function confirmBarCount(formData: FormData): Promise<void> {
  const user = await assertPermission('stock.goodsIn');
  const company = getActiveCompany(user);

  const mode = String(formData.get('mode') ?? '') as BarCountMode;
  if (!VALID_MODES.includes(mode)) throw new Error('Missing detection mode — run detection again.');

  const photoUrl = String(formData.get('photoUrl') ?? '');
  if (!photoUrl) throw new Error('Missing photo — run detection again.');
  const photoWidth = Number(formData.get('photoWidth') ?? 0) || null;
  const photoHeight = Number(formData.get('photoHeight') ?? 0) || null;

  const orderId = String(formData.get('orderId') ?? '') || null;
  if (orderId) {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    assertCompanyAccess(user, order.company);
  }

  const detectedCountRaw = formData.get('detectedCount');
  const detectedCount = detectedCountRaw ? Number(detectedCountRaw) : null;
  const detectedCirclesRaw = String(formData.get('detectedCircles') ?? '');
  const detectedCircles = detectedCirclesRaw ? JSON.parse(detectedCirclesRaw) : null;

  const aiEstimateCountRaw = formData.get('aiEstimateCount');
  const aiEstimateCount = aiEstimateCountRaw ? Number(aiEstimateCountRaw) : null;
  const aiEstimateError = String(formData.get('aiEstimateError') ?? '');

  const confirmedCirclesRaw = String(formData.get('confirmedCircles') ?? '');
  let confirmedCount: number;
  let confirmedCircles: DetectedCircle[] | null = null;
  if (confirmedCirclesRaw) {
    confirmedCircles = JSON.parse(confirmedCirclesRaw);
    confirmedCount = confirmedCircles!.length;
  } else {
    confirmedCount = Number(formData.get('confirmedCount') ?? NaN);
    if (!Number.isFinite(confirmedCount) || confirmedCount < 0) throw new Error('Enter the confirmed count.');
  }

  const notes = String(formData.get('notes') ?? '').trim();

  const barCount = await db.barCount.create({
    data: {
      company, mode, photoUrl, photoWidth, photoHeight, orderId,
      detectedCount, detectedCircles: detectedCircles ?? Prisma.JsonNull, aiEstimateCount, aiEstimateError,
      confirmedCount, confirmedCircles: confirmedCircles ?? Prisma.JsonNull, notes, createdById: user.id,
    },
  });

  await logActivity('BarCount', barCount.id, 'Confirmed count', `${confirmedCount} bars`, user.id);
  revalidatePath('/stock/bar-counter');
}

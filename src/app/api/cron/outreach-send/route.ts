import { NextResponse } from 'next/server';
import { runSendBatch } from '@/lib/outreach/send';

export const maxDuration = 60;

/**
 * Hit daily by Vercel Cron (see vercel.json) — sends today's batch of
 * person-approved emails, up to OUTREACH_DAILY_SEND_CAP. Guarded by
 * CRON_SECRET the same way as api/cron/backup-drive.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse('CRON_SECRET is not set.', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Not authorized', { status: 401 });
  }

  try {
    const result = await runSendBatch();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

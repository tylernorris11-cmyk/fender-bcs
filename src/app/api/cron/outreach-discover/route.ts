import { NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/outreach/discover';

export const maxDuration = 60;

/**
 * Hit daily by Vercel Cron (see vercel.json) — finds new leads, looks up
 * contacts, and drafts emails for review. Guarded by CRON_SECRET the same
 * way as api/cron/backup-drive.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse('CRON_SECRET is not set.', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Not authorized', { status: 401 });
  }

  try {
    const result = await runDiscovery({ deadline: Date.now() + 50_000 }); // stop before the 60s function limit; leftovers wait for tomorrow
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

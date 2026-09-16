import { NextResponse } from 'next/server';
import { runBackupSync } from '@/lib/backupSync';

export const maxDuration = 60;

/**
 * Hit once a day by Vercel Cron (see vercel.json) — not a user-facing route,
 * so it's guarded by CRON_SECRET rather than a signed-in permission check.
 * Vercel sends that secret as a bearer token automatically once the env var
 * exists; see .env.example for how to generate one.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse('CRON_SECRET is not set.', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Not authorized', { status: 401 });
  }

  try {
    const result = await runBackupSync({ limit: 25 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { processInbox } from '@/lib/outreach/replies';
import { runSendBatch } from '@/lib/outreach/send';

export const maxDuration = 60;

/**
 * Hit daily by Vercel Cron (see vercel.json). Reads the outreach mailbox
 * first — so an opt-out or bounce that arrived overnight is honoured — then
 * sends today's batch of person-approved emails, up to OUTREACH_DAILY_SEND_CAP.
 * Guarded by CRON_SECRET the same way as api/cron/backup-drive.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse('CRON_SECRET is not set.', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Not authorized', { status: 401 });
  }

  try {
    // A problem reading the inbox must not stop the sends going out — but it
    // does mean a fresh opt-out might not be seen yet, so say so loudly.
    let inbox;
    try {
      inbox = await processInbox();
    } catch (err) {
      inbox = { error: err instanceof Error ? err.message : 'Unknown error reading the mailbox' };
    }
    const send = await runSendBatch();
    return NextResponse.json({ inbox, send });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

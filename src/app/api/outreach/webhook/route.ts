import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OUTREACH_FORWARD_TO } from '@/lib/outreach/config';
import { addSuppression } from '@/lib/outreach/postmark';
import { sendEmail } from '@/lib/email';

/**
 * Postmark inbound webhook — handles both a reply landing in the inbox and a
 * bounce notification, since both get pointed at this one URL (see
 * docs/OUTREACH_SETUP.md for the Postmark side of the setup). Postmark
 * doesn't sign these requests, so the URL itself carries a shared secret;
 * set POSTMARK_WEBHOOK_SECRET and use the same value in the webhook URL you
 * give Postmark: .../api/outreach/webhook?secret=...
 */
// Postmark reports every kind of bounce here, including out-of-office
// auto-replies and full mailboxes. Only these mean the address is dead or
// doesn't want us — suppressing on the rest would permanently drop a good
// lead because someone was on holiday.
const PERMANENT_BOUNCE_TYPES = new Set(['HardBounce', 'BadEmailAddress', 'SpamNotification', 'SpamComplaint', 'ManuallyDeactivated', 'Unsubscribe', 'Blocked']);

const OPT_OUT_PATTERN = /\b(unsubscribe|remove me|stop emailing|no longer interested|take (me|us) off)\b/i;

export async function POST(request: Request) {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  const provided = new URL(request.url).searchParams.get('secret');
  if (!secret || provided !== secret) return new NextResponse('Not authorized', { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload) return new NextResponse('Bad payload', { status: 400 });

  // ---------------------------------------------------------------- bounce
  if (payload.RecordType === 'Bounce') {
    const email = String(payload.Email ?? '').toLowerCase();
    if (email && PERMANENT_BOUNCE_TYPES.has(String(payload.Type ?? ''))) {
      const complaint = payload.Type === 'SpamComplaint' || payload.Type === 'SpamNotification' || payload.Type === 'Unsubscribe';
      await addSuppression(email, '', complaint ? 'opted_out' : 'bounced');
      await db.lead.updateMany({ where: { contactEmail: email }, data: { status: complaint ? 'OPTED_OUT' : 'BOUNCED' } });
    }
    return NextResponse.json({ ok: true });
  }

  // A spam complaint has its own record type when the webhook is set to send them.
  if (payload.RecordType === 'SpamComplaint') {
    const email = String(payload.Email ?? '').toLowerCase();
    if (email) {
      await addSuppression(email, '', 'opted_out');
      await db.lead.updateMany({ where: { contactEmail: email }, data: { status: 'OPTED_OUT' } });
    }
    return NextResponse.json({ ok: true });
  }

  // ---------------------------------------------------------------- reply
  const fromEmail = String(payload.From ?? payload.FromFull?.Email ?? '').toLowerCase();
  const subject = String(payload.Subject ?? '(no subject)');
  const text = String(payload.StrippedTextReply || payload.TextBody || '');
  if (!fromEmail) return NextResponse.json({ ok: true });

  const lead = await db.lead.findFirst({ where: { contactEmail: fromEmail }, orderBy: { updatedAt: 'desc' } });
  const isOptOut = OPT_OUT_PATTERN.test(text);

  if (lead) {
    const latestSent = await db.outreachEmail.findFirst({
      where: { leadId: lead.id, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
    });
    if (latestSent) {
      await db.outreachEmail.update({ where: { id: latestSent.id }, data: { repliedAt: new Date(), replyText: text.slice(0, 5000) } });
    }
    await db.lead.update({ where: { id: lead.id }, data: { status: isOptOut ? 'OPTED_OUT' : 'REPLIED' } });
  }

  if (isOptOut) {
    await addSuppression(fromEmail, lead?.companyName ?? '', 'opted_out');
  }

  // Always forwarded, opt-out or not, so a person sees every reply.
  await sendEmail({
    to: OUTREACH_FORWARD_TO,
    subject: `[BCS outreach reply] ${lead?.companyName ?? fromEmail} — ${subject}`,
    text: [
      `From: ${fromEmail}`,
      lead ? `Lead: ${lead.companyName} (${lead.status})` : 'No matching lead found for this address.',
      isOptOut ? 'Looks like an opt-out — added to the suppression list automatically.' : '',
      '',
      text || '(empty reply)',
    ].filter(Boolean).join('\n'),
  });

  return NextResponse.json({ ok: true });
}

import 'server-only';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { OUTREACH_FORWARD_TO } from './config';
import { listInboxSince, mailboxConfigured } from './mailbox';
import { addSuppression } from './mail';

export type InboxResult = { checked: number; replies: number; optOuts: number; bounces: number; errors: string[] };

const CURSOR_KEY = 'outreachInboxCursor';

const OPT_OUT_PATTERN = /\b(unsubscribe|remove me|stop emailing|no longer interested|take (me|us) off)\b/i;
// Out-of-office and other auto-replies: not a real answer, and not a reason to drop the lead.
const AUTO_REPLY_SUBJECT = /^(automatic reply|auto[- ]?reply|autoreply|out of office)/i;
const BOUNCE_SENDER = /^(postmaster|mailer-daemon)@/i;
const BOUNCE_SUBJECT = /^(undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail|delivery failure)/i;
const DELAYED_BOUNCE = /(delayed|will (continue to )?retry|still trying)/i;
// Enhanced status codes starting 5. are permanent failures; the phrases cover
// Exchange's plain-English "couldn't be delivered" notices.
const PERMANENT_FAILURE = /\b5\.\d{1,3}\.\d{1,3}\b|couldn.t be delivered|wasn.t delivered|doesn.t exist|user unknown|mailbox unavailable|address not found/i;
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'yahoo.com', 'yahoo.co.uk',
  'icloud.com', 'aol.com', 'btinternet.com', 'sky.com', 'talktalk.net', 'virginmedia.com', 'msn.com',
]);

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';
const EMAIL_IN_TEXT = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Reads the outreach mailbox for anything new since the last run and acts on
 * it: a reply marks the lead Replied (and forwards a heads-up), an opt-out is
 * added to the suppression list, a permanent bounce suppresses the address.
 * Runs just before the daily send, so an opt-out that came in overnight is
 * respected by that morning's batch. Only mail from a known lead or a
 * delivery-failure notice is touched — anything else stays in the inbox for
 * a person.
 */
export async function processInbox(): Promise<InboxResult> {
  const result: InboxResult = { checked: 0, replies: 0, optOuts: 0, bounces: 0, errors: [] };
  if (!mailboxConfigured()) return result;

  const cursor = await db.setting.findUnique({ where: { key: CURSOR_KEY } });
  const firstSent = await db.outreachEmail.findFirst({ where: { status: 'SENT' }, orderBy: { sentAt: 'asc' }, select: { sentAt: true } });
  if (!cursor && !firstSent?.sentAt) return result; // nothing has gone out yet, so nothing can have replied

  const since = cursor ? new Date(cursor.value) : firstSent!.sentAt!;
  let messages;
  try {
    messages = await listInboxSince(since);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Could not read the mailbox.');
    return result;
  }

  const ownAddress = (process.env.OUTREACH_MAILBOX ?? '').toLowerCase();

  for (const m of messages) {
    result.checked += 1;
    try {
      if (m.from === ownAddress) continue;

      // ---------------------------------------------------------- bounces
      if (BOUNCE_SENDER.test(m.from) || BOUNCE_SUBJECT.test(m.subject)) {
        if (DELAYED_BOUNCE.test(m.subject) || !PERMANENT_FAILURE.test(`${m.subject}\n${m.text}`)) continue;
        const candidates = [...new Set((m.text.match(EMAIL_IN_TEXT) ?? []).map((e) => e.toLowerCase()))].filter((e) => e !== ownAddress);
        const leads = candidates.length ? await db.lead.findMany({ where: { contactEmail: { in: candidates } } }) : [];
        for (const lead of leads) {
          await addSuppression(lead.contactEmail, lead.companyName, 'bounced');
          await db.lead.update({ where: { id: lead.id }, data: { status: 'BOUNCED' } });
          result.bounces += 1;
        }
        continue;
      }

      if (AUTO_REPLY_SUBJECT.test(m.subject)) continue;

      // ---------------------------------------------------------- replies
      let lead = await db.lead.findFirst({ where: { contactEmail: m.from }, orderBy: { updatedAt: 'desc' } });
      // A different person at the same company answering is still a reply
      // from that lead — but never match on a free-mail domain, which would
      // pair unrelated people.
      if (!lead && !FREE_MAIL.has(domainOf(m.from))) {
        lead = await db.lead.findFirst({
          where: { contactEmail: { endsWith: `@${domainOf(m.from)}` }, status: { in: ['SENT', 'REPLIED'] } },
          orderBy: { updatedAt: 'desc' },
        });
      }
      if (!lead) continue; // not about outreach — leave it for a person

      const isOptOut = OPT_OUT_PATTERN.test(m.text);
      const latestSent = await db.outreachEmail.findFirst({ where: { leadId: lead.id, status: 'SENT' }, orderBy: { sentAt: 'desc' } });
      if (latestSent) {
        await db.outreachEmail.update({ where: { id: latestSent.id }, data: { repliedAt: m.receivedAt, replyText: m.text.slice(0, 5000) } });
      }
      await db.lead.update({ where: { id: lead.id }, data: { status: isOptOut ? 'OPTED_OUT' : 'REPLIED' } });
      if (isOptOut) {
        await addSuppression(m.from, lead.companyName, 'opted_out');
        if (lead.contactEmail && lead.contactEmail !== m.from) await addSuppression(lead.contactEmail, lead.companyName, 'opted_out');
        result.optOuts += 1;
      } else {
        result.replies += 1;
      }

      // The reply is already in the mailbox; this just makes sure someone notices.
      await sendEmail({
        to: OUTREACH_FORWARD_TO,
        subject: `[BCS outreach reply] ${lead.companyName} — ${m.subject}`,
        text: [
          `From: ${m.from}`,
          `Lead: ${lead.companyName}`,
          isOptOut ? 'Looks like an opt-out — added to the suppression list automatically.' : '',
          '',
          m.text.slice(0, 3000) || '(empty reply)',
        ].filter(Boolean).join('\n'),
      });
    } catch (err) {
      result.errors.push(`${m.subject}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // Move the cursor past everything just read, even if some messages errored —
  // reprocessing would resend the heads-up emails.
  const newest = messages.length ? messages[messages.length - 1].receivedAt.toISOString() : since.toISOString();
  await db.setting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: newest }, update: { value: newest } });

  return result;
}

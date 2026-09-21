import 'server-only';
import { db } from '@/lib/db';
import { OUTREACH_DAILY_SEND_CAP } from './config';
import { isSuppressed, sendOutreachEmail } from './postmark';

export type SendResult = { attempted: number; sent: number; failed: number; errors: string[] };

/**
 * Sends today's batch of approved-but-not-yet-sent emails, up to the daily
 * cap. Only ever touches emails a person has explicitly approved (status
 * APPROVED) — a DRAFT sits in the review queue until someone acts on it.
 */
export async function runSendBatch(): Promise<SendResult> {
  const result: SendResult = { attempted: 0, sent: 0, failed: 0, errors: [] };

  const alreadySentToday = await db.outreachEmail.count({
    where: { status: 'SENT', sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
  });
  const remaining = Math.max(0, OUTREACH_DAILY_SEND_CAP - alreadySentToday);
  if (remaining === 0) return result;

  const batch = await db.outreachEmail.findMany({
    where: { status: 'APPROVED' },
    include: { lead: true },
    orderBy: { approvedAt: 'asc' },
    take: remaining,
  });

  for (const email of batch) {
    result.attempted += 1;
    const to = email.lead.contactEmail;
    if (!to) {
      result.failed += 1;
      result.errors.push(`${email.lead.companyName}: lead has no contact email anymore`);
      await db.outreachEmail.update({ where: { id: email.id }, data: { status: 'FAILED', failReason: 'No contact email' } });
      continue;
    }
    if (await isSuppressed(to)) {
      result.failed += 1;
      await db.outreachEmail.update({ where: { id: email.id }, data: { status: 'FAILED', failReason: 'Address is suppressed' } });
      await db.lead.update({ where: { id: email.leadId }, data: { status: 'OPTED_OUT' } });
      continue;
    }

    const outcome = await sendOutreachEmail({
      to, subject: email.subject, body: email.bodyText, unsubscribeToken: email.unsubscribeToken,
    });

    if (outcome.sent) {
      result.sent += 1;
      await db.outreachEmail.update({
        where: { id: email.id },
        data: { status: 'SENT', sentAt: new Date(), postmarkId: outcome.postmarkId ?? '' },
      });
      await db.lead.update({ where: { id: email.leadId }, data: { status: 'SENT' } });
    } else {
      result.failed += 1;
      result.errors.push(`${email.lead.companyName}: ${outcome.error ?? 'unknown error'}`);
      await db.outreachEmail.update({ where: { id: email.id }, data: { status: 'FAILED', failReason: outcome.error ?? 'unknown error' } });
    }
  }

  return result;
}

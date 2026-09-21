import 'server-only';
import { db } from '@/lib/db';
import { OUTREACH_SENDER } from './config';
import { sendFromMailbox } from './mailbox';

/**
 * Everything about turning an approved draft into an email that's safe to
 * send: the unsubscribe link, the compliance footer, and the suppression
 * list. The actual delivery is in mailbox.ts (Microsoft 365). Cold outreach
 * goes out from its own mailbox on its own domain, never through the app's
 * regular transactional email (lib/email.ts) — see docs/OUTREACH_SETUP.md.
 */

const APP_URL = process.env.OUTREACH_APP_URL || 'https://fenderbcs.com';

export function unsubscribeUrl(token: string): string {
  return `${APP_URL}/api/outreach/unsubscribe?token=${token}`;
}

/** A lead is never sent to if their address (or any address for that company) has opted out or bounced before. */
export async function isSuppressed(email: string): Promise<boolean> {
  const hit = await db.outreachSuppression.findUnique({ where: { email: email.toLowerCase() } });
  return !!hit;
}

export async function addSuppression(email: string, companyName: string, reason: string): Promise<void> {
  await db.outreachSuppression.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), companyName, reason },
    update: { reason },
  });
}

function buildFooter(unsubscribeToken: string): string {
  const lines = [
    '—',
    OUTREACH_SENDER.label,
    OUTREACH_SENDER.registeredAddress,
    OUTREACH_SENDER.companyNumber ? `Company no. ${OUTREACH_SENDER.companyNumber}` : '',
    '',
    `Don't want emails like this from us again? ${unsubscribeUrl(unsubscribeToken)}`,
  ];
  return lines.filter((l) => l !== '').join('\n');
}

export async function sendOutreachEmail({
  to, subject, body, unsubscribeToken,
}: { to: string; subject: string; body: string; unsubscribeToken: string }): Promise<{ sent: boolean; error?: string }> {
  // PECR requires the sender's identity and a postal address on every
  // commercial email — never send one that's missing them.
  if (!OUTREACH_SENDER.registeredAddress || !OUTREACH_SENDER.companyNumber) {
    return { sent: false, error: 'OUTREACH_REGISTERED_ADDRESS and OUTREACH_COMPANY_NUMBER must both be set before anything is sent.' };
  }

  if (await isSuppressed(to)) return { sent: false, error: 'This address is on the suppression list — not sending.' };

  return sendFromMailbox({ to, subject, text: `${body.trim()}\n\n${buildFooter(unsubscribeToken)}` });
}

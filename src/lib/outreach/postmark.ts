import 'server-only';
import { db } from '@/lib/db';
import { OUTREACH_MESSAGE_STREAM, OUTREACH_SENDER } from './config';

/**
 * Thin wrapper over the Postmark HTTP API — same house style as lib/email.ts
 * (no SDK). A separate provider from the Resend wrapper the rest of the app
 * uses: Postmark handles inbound-reply routing (see
 * app/api/outreach/webhook/route.ts), which Resend doesn't, and keeping cold
 * outreach on its own provider/subdomain means a deliverability problem here
 * never touches the app's regular transactional email. See
 * docs/OUTREACH_SETUP.md for the one-time Postmark + DNS setup.
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
}: { to: string; subject: string; body: string; unsubscribeToken: string }): Promise<{ sent: boolean; postmarkId?: string; error?: string }> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) return { sent: false, error: 'POSTMARK_SERVER_TOKEN is not set.' };

  // PECR requires the sender's identity and a postal address on every
  // commercial email — never send one that's missing them.
  if (!OUTREACH_SENDER.registeredAddress || !OUTREACH_SENDER.companyNumber) {
    return { sent: false, error: 'OUTREACH_REGISTERED_ADDRESS and OUTREACH_COMPANY_NUMBER must both be set before anything is sent.' };
  }

  if (await isSuppressed(to)) return { sent: false, error: 'This address is on the suppression list — not sending.' };

  const fullBody = `${body.trim()}\n\n${buildFooter(unsubscribeToken)}`;

  try {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: `${OUTREACH_SENDER.label} <${OUTREACH_SENDER.fromEmail}>`,
        To: to,
        ReplyTo: OUTREACH_SENDER.replyTo,
        Subject: subject,
        TextBody: fullBody,
        Headers: [
          { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl(unsubscribeToken)}>` },
          { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
        ],
        MessageStream: OUTREACH_MESSAGE_STREAM,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ErrorCode) {
      const error = `Postmark: ${data.Message || res.statusText}`;
      return { sent: false, error };
    }
    return { sent: true, postmarkId: data.MessageID };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error sending the email.' };
  }
}

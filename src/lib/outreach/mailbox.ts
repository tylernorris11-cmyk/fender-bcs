import 'server-only';

/**
 * Thin wrapper over the Microsoft Graph mail API, for one dedicated
 * Microsoft 365 mailbox — same house style as lib/email.ts: no SDK, just
 * fetch. Signs in as an app (client credentials), not as a person, so it
 * needs no password and no interactive login; what it can touch is limited
 * to that one mailbox by an Exchange Online role assignment (see
 * docs/OUTREACH_SETUP.md, step 5). Without that, the send permission would
 * let this app send as anyone in the company.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

export type InboxMessage = { id: string; from: string; subject: string; text: string; receivedAt: Date };

let cachedToken: { value: string; expiresAt: number } | null = null;

function config() {
  const tenant = process.env.OUTREACH_M365_TENANT_ID;
  const clientId = process.env.OUTREACH_M365_CLIENT_ID;
  const clientSecret = process.env.OUTREACH_M365_CLIENT_SECRET;
  const mailbox = process.env.OUTREACH_MAILBOX;
  if (!tenant || !clientId || !clientSecret || !mailbox) return null;
  return { tenant, clientId, clientSecret, mailbox };
}

export function mailboxConfigured(): boolean {
  return config() !== null;
}

async function graphToken(cfg: NonNullable<ReturnType<typeof config>>): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Microsoft sign-in failed: ${data.error_description?.split('\r\n')[0] || data.error || res.statusText}`);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function graphError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  const detail = data?.error?.message || data?.error?.code || res.statusText;
  return `Microsoft 365 returned ${res.status}: ${String(detail).slice(0, 300)}`;
}

/** Sends one plain-text email as the outreach mailbox. It's saved in that mailbox's Sent Items. */
export async function sendFromMailbox({
  to, subject, text,
}: { to: string; subject: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const cfg = config();
  if (!cfg) return { sent: false, error: 'The Microsoft 365 mailbox settings are not all set.' };

  try {
    const token = await graphToken(cfg);
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: text },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    // 202 = accepted for delivery. Graph returns no message id.
    if (res.status !== 202) return { sent: false, error: await graphError(res) };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error sending the email.' };
  }
}

/** Messages that arrived in the mailbox's Inbox after `since`, oldest first, bodies as plain text (just the newest reply, not the quoted thread). */
export async function listInboxSince(since: Date): Promise<InboxMessage[]> {
  const cfg = config();
  if (!cfg) throw new Error('The Microsoft 365 mailbox settings are not all set.');
  const token = await graphToken(cfg);

  // $orderby properties must also appear in $filter, in the same order — Graph's own rule.
  const query = new URLSearchParams({
    $filter: `receivedDateTime gt ${since.toISOString()}`,
    $orderby: 'receivedDateTime asc',
    $select: 'id,from,subject,uniqueBody,bodyPreview,receivedDateTime',
    $top: '50',
  });
  let url: string | null = `${GRAPH}/users/${encodeURIComponent(cfg.mailbox)}/mailFolders/inbox/messages?${query}`;
  const out: InboxMessage[] = [];

  for (let page = 0; url && page < 6; page += 1) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
    });
    if (!res.ok) throw new Error(await graphError(res));
    const data = await res.json();
    for (const m of data.value ?? []) {
      out.push({
        id: m.id,
        from: String(m.from?.emailAddress?.address ?? '').toLowerCase(),
        subject: String(m.subject ?? ''),
        text: String(m.uniqueBody?.content || m.bodyPreview || ''),
        receivedAt: new Date(m.receivedDateTime),
      });
    }
    url = data['@odata.nextLink'] ?? null;
  }
  return out;
}

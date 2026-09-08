import 'server-only';

/**
 * Thin wrapper over the Resend HTTP API — no SDK, just fetch, so this app's
 * dependency list stays as small as it's always been. Set RESEND_API_KEY to
 * actually send; without it this quietly no-ops (the caller still saves
 * whatever it was emailing about, so nothing is lost either way).
 *
 * Every failure is logged here, not left to each caller to notice — none of
 * the six call sites in this app actually checked the returned `sent` flag,
 * so a broken send (bad key, unverified domain, Resend down) previously left
 * no trace anywhere. This doesn't fix that at every call site individually;
 * it makes it impossible to add a seventh call site that repeats the mistake.
 */
export async function sendEmail({
  to, subject, text,
}: { to: string; subject: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = 'RESEND_API_KEY is not set.';
    console.error(`[email] not sent to ${to} ("${subject}"): ${error}`);
    return { sent: false, error };
  }

  const from = process.env.BUG_REPORT_FROM_EMAIL || 'Fender BCS <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = `Resend returned ${res.status}: ${body.slice(0, 200)}`;
      console.error(`[email] not sent to ${to} ("${subject}"): ${error}`);
      return { sent: false, error };
    }
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error sending email.';
    console.error(`[email] not sent to ${to} ("${subject}"): ${error}`);
    return { sent: false, error };
  }
}

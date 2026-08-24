import 'server-only';

/**
 * Thin wrapper over the Resend HTTP API — no SDK, just fetch, so this app's
 * dependency list stays as small as it's always been. Set RESEND_API_KEY to
 * actually send; without it this quietly no-ops (the caller still saves
 * whatever it was emailing about, so nothing is lost either way).
 */
export async function sendEmail({
  to, subject, text,
}: { to: string; subject: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not set.' };

  const from = process.env.BUG_REPORT_FROM_EMAIL || 'Fender BCS <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, error: `Resend returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error sending email.' };
  }
}

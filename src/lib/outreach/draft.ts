import 'server-only';
import { OUTREACH_SENDER } from './config';

/**
 * Drafts one introductory email for a lead — same house style as
 * lib/barCountAI.ts and lib/certExtraction.ts: a plain fetch against the
 * Anthropic Messages API, no SDK. The compliance footer (sender identity,
 * address, unsubscribe link) is appended separately in mail.ts, never
 * left to the model, so it's never missing or reworded.
 */
export async function draftOutreachEmail({
  companyName, sicCodes,
}: { companyName: string; sicCodes: string[] }): Promise<{ subject: string; body: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY is not set.' };

  const prompt = [
    `Write a short, genuinely useful cold introductory email from ${OUTREACH_SENDER.label}, a UK supplier of fence post steel`,
    'for concrete fence post and gravel board manufacturers, to a prospective trade customer.',
    `The recipient company is "${companyName}"${sicCodes.length ? ` (UK SIC code(s): ${sicCodes.join(', ')})` : ''}.`,
    'Assume they manufacture or supply concrete fence posts and/or gravel boards, or fencing materials more broadly — tailor',
    'one sentence to that if the SIC code makes it clear, otherwise keep it general.',
    '',
    'Cover, briefly: who we are, that we supply steel for concrete fence posts and gravel boards, and an invitation to',
    'get in touch for pricing or a sample. Keep it short — 90-130 words. Plain, direct, trade-to-trade tone, no exclamation',
    'marks, no marketing fluff, no fake urgency, no "I hope this email finds you well". Do not invent named contacts,',
    'phone numbers, prices, or claims about the recipient you cannot know from the SIC code alone. Do not include a',
    'sign-off, signature block, address, or unsubscribe line — those are added separately.',
    '',
    'Reply with nothing but a JSON object of the form {"subject": "...", "body": "..."} — plain text body, paragraphs',
    'separated by a blank line, no markdown, no other text.',
  ].join(' ');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { error: `Anthropic returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const data = await res.json();
    const raw = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('').trim();
    const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.subject || !parsed?.body) return { error: 'Unexpected response shape from Anthropic.' };
    return { subject: String(parsed.subject), body: String(parsed.body) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error drafting the email.' };
  }
}

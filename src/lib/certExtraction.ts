import 'server-only';

/**
 * Thin wrapper over the Anthropic Messages API — no SDK, same house style as
 * lib/email.ts. Reads every cast/heat number off a mill test certificate
 * (PDF or photo). A certificate can list several casts on one page, so this
 * always returns an array — empty if none were found or the key isn't set.
 */
export async function extractCastNumbers({
  base64, mimeType,
}: { base64: string; mimeType: string }): Promise<{ castNumbers: string[]; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { castNumbers: [], error: 'ANTHROPIC_API_KEY is not set.' };

  const isPdf = mimeType === 'application/pdf';
  const content = [
    {
      type: isPdf ? 'document' : 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
    {
      type: 'text',
      text: [
        'This is a mill test certificate for reinforcing steel. Find every cast number',
        '(also called a heat number) printed on it — there may be more than one if the',
        'certificate covers several casts. Reply with nothing but a JSON array of the',
        'cast numbers as strings, exactly as printed (keep letters, digits, leading',
        'zeros). If you cannot find any, reply with []. No other text, no markdown.',
      ].join(' '),
    },
  ];

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
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { castNumbers: [], error: `Anthropic returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const data = await res.json();
    const raw = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('').trim();
    const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return { castNumbers: [], error: 'Unexpected response shape from Anthropic.' };
    const castNumbers = parsed.map((v) => String(v).trim()).filter(Boolean);
    return { castNumbers };
  } catch (err) {
    return { castNumbers: [], error: err instanceof Error ? err.message : 'Unknown error reading the certificate.' };
  }
}

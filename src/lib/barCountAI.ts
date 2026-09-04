import 'server-only';

/**
 * Thin wrapper over the Anthropic Messages API — no SDK, same house style as
 * lib/certExtraction.ts. Asks for a rough total bar-end count only — never
 * per-object coordinates, since vision models can't reliably pinpoint many
 * small, similar, densely-packed objects. It's a comparison number for the
 * worker, not a substitute for the Hough-detected, tap-corrected overlay.
 */
export async function estimateBarCount({
  base64, mimeType,
}: { base64: string; mimeType: string }): Promise<{ count: number | null; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { count: null, error: 'ANTHROPIC_API_KEY is not set.' };

  const content = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
    {
      type: 'text',
      text: [
        'This is a photo of the cut end of a bundle of steel reinforcement bars, taken',
        'end-on. Count how many individual bar ends are visible in the bundle. Reply',
        'with nothing but a JSON object of the form {"count": <integer>} — your best',
        'single estimate of the total, not a range. No other text, no markdown.',
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
        max_tokens: 256,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { count: null, error: `Anthropic returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const data = await res.json();
    const raw = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('').trim();
    const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const count = Number(parsed?.count);
    if (!Number.isFinite(count) || count < 0) return { count: null, error: 'Unexpected response shape from Anthropic.' };
    return { count: Math.round(count) };
  } catch (err) {
    return { count: null, error: err instanceof Error ? err.message : 'Unknown error estimating the count.' };
  }
}

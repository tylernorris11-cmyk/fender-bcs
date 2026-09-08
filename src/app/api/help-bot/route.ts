import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { HELP_BOT_SYSTEM_PROMPT } from '@/lib/helpBotKnowledge';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Keeps a runaway conversation (or someone pasting a novel into the box)
// from turning into an unbounded API bill — plenty for a genuine
// how-do-I exchange, which rarely runs more than a few turns.
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'The help bot is not set up yet — ask a Master Administrator to add ANTHROPIC_API_KEY.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const rawMessages = body?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: 'No message to send.' }, { status: 400 });
  }

  const messages: ChatMessage[] = rawMessages
    .slice(-MAX_MESSAGES)
    .filter((m): m is ChatMessage => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  if (messages.length === 0) return NextResponse.json({ error: 'No message to send.' }, { status: 400 });

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
        system: HELP_BOT_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[help-bot] Anthropic returned ${res.status}: ${errBody.slice(0, 300)}`);
      return NextResponse.json({ error: 'Could not reach the help assistant — try again in a moment.' }, { status: 502 });
    }

    const data = await res.json();
    const reply = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('').trim();
    if (!reply) return NextResponse.json({ error: 'Got an empty reply — try rephrasing the question.' }, { status: 502 });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[help-bot] request failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong reaching the help assistant.' }, { status: 502 });
  }
}

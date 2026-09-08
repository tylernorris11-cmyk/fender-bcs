import 'server-only';

/**
 * Posts a message into a Telegram group via a bot already added to it — no
 * SDK, same house style as lib/email.ts: a plain fetch against Telegram's
 * HTTP API. Quietly no-ops without the two env vars set, so this can ship
 * and start working the moment the bot/group exist, same as email did
 * before RESEND_API_KEY was set.
 */
export async function sendTelegramMessage(text: string): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    const error = 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.';
    console.error(`[telegram] not sent: ${error}`);
    return { sent: false, error };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = `Telegram returned ${res.status}: ${body.slice(0, 200)}`;
      console.error(`[telegram] not sent: ${error}`);
      return { sent: false, error };
    }
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error sending to Telegram.';
    console.error(`[telegram] not sent: ${error}`);
    return { sent: false, error };
  }
}

import 'server-only';

function telegramConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

/**
 * Posts a message into a Telegram group via a bot already added to it — no
 * SDK, same house style as lib/email.ts: a plain fetch against Telegram's
 * HTTP API. Quietly no-ops without the two env vars set, so this can ship
 * and start working the moment the bot/group exist, same as email did
 * before RESEND_API_KEY was set.
 */
export async function sendTelegramMessage(text: string): Promise<{ sent: boolean; error?: string }> {
  const config = telegramConfig();
  if (!config) {
    const error = 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.';
    console.error(`[telegram] not sent: ${error}`);
    return { sent: false, error };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, text }),
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

/**
 * Posts a photo into the Telegram group, with a caption — used when
 * whatever triggered the alert has a photo attached (a check), so it shows
 * up inline instead of everyone having to click through to see it.
 * sendMessage can't carry an image at all; sendPhoto needs either a public
 * URL or the raw bytes, and a check's photo is stored as an inline data:
 * URL rather than a hosted one, so this decodes it and uploads the bytes
 * directly as multipart form data.
 */
export async function sendTelegramPhoto(dataUrl: string, caption: string): Promise<{ sent: boolean; error?: string }> {
  const config = telegramConfig();
  if (!config) {
    const error = 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.';
    console.error(`[telegram] photo not sent: ${error}`);
    return { sent: false, error };
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const error = 'Photo was not a recognizable data: URL.';
    console.error(`[telegram] photo not sent: ${error}`);
    return { sent: false, error };
  }
  const [, mimeType, base64] = match;

  try {
    const bytes = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.set('chat_id', config.chatId);
    // Telegram's own caption limit — long enough for anything this app
    // sends, but a check with many flagged items could in principle run
    // past it, so truncate rather than let the whole send fail.
    form.set('caption', caption.slice(0, 1024));
    form.set('photo', new Blob([bytes], { type: mimeType }), 'photo.jpg');

    const res = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = `Telegram returned ${res.status}: ${body.slice(0, 200)}`;
      console.error(`[telegram] photo not sent: ${error}`);
      return { sent: false, error };
    }
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error sending a photo to Telegram.';
    console.error(`[telegram] photo not sent: ${error}`);
    return { sent: false, error };
  }
}

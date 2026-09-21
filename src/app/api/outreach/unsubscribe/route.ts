import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addSuppression } from '@/lib/outreach/postmark';

/**
 * The link (and the one-click List-Unsubscribe header) in every outreach
 * email. No login needed — the token in the query string is the only proof
 * required, same as any other mailing-list unsubscribe link. GET and POST
 * both work, since a one-click header can trigger either.
 */
async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return new NextResponse('Missing token.', { status: 400 });

  const email = await db.outreachEmail.findUnique({ where: { unsubscribeToken: token }, include: { lead: true } });
  if (!email) return new NextResponse('That link is not recognised.', { status: 404 });

  if (email.lead.contactEmail) {
    await addSuppression(email.lead.contactEmail, email.lead.companyName, 'opted_out');
  }
  await db.lead.update({ where: { id: email.leadId }, data: { status: 'OPTED_OUT' } });

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>` +
    `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#1a1a1a">` +
    `<h1 style="font-size:20px">You're unsubscribed</h1>` +
    `<p>${email.lead.companyName} won't get any more emails from ${email.senderLabel}.</p>` +
    `</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }

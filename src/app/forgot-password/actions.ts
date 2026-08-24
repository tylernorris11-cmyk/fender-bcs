'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { createResetToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

/** Same crude in-memory throttle style as login/actions.ts — stops one address being emailed on a loop. */
const attempts = new Map<string, { count: number; until: number }>();

function throttled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= 3;
}

function recordAttempt(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: Date.now() + 15 * 60_000 };
  entry.count += 1;
  attempts.set(key, entry);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) redirect(`/forgot-password?error=${encodeURIComponent('Enter your email address.')}`);

  if (!throttled(email)) {
    recordAttempt(email);
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.active) {
      const token = await createResetToken(user.id);
      const h = headers();
      const link = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/reset-password/${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your Fender BCS password',
        text: [
          `Hi ${user.name},`,
          '',
          'Someone (hopefully you) asked to reset the password on your Fender BCS account.',
          `Choose a new password here: ${link}`,
          '',
          'This link works once and expires in an hour. If you did not ask for this, ignore this email — your password is unchanged.',
        ].join('\n'),
      });
    }
  }

  // Same confirmation either way — never confirm which emails have accounts.
  redirect('/forgot-password?sent=1');
}

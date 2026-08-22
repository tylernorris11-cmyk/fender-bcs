'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { setSessionCookie, verifyPassword } from '@/lib/auth';

/**
 * Crude in-memory throttle. Good enough to stop someone sitting in the car park
 * guessing passwords; if you put this behind a load balancer with several
 * instances, move it to the database or to Vercel KV.
 */
const attempts = new Map<string, { count: number; until: number }>();

function throttled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= 8;
}

function recordFailure(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: Date.now() + 15 * 60_000 };
  entry.count += 1;
  attempts.set(key, entry);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/') || '/';

  const fail = (message: string) =>
    redirect(`/login?error=${encodeURIComponent(message)}`);

  if (!email || !password) fail('Enter your email and password.');

  if (throttled(email)) {
    fail('Too many attempts. Wait fifteen minutes, or ask John or Claire to reset your password.');
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    recordFailure(email);
    // Deliberately the same message either way — never confirm which accounts exist.
    fail('That email and password do not match.');
  }

  attempts.delete(email);
  await db.user.update({ where: { id: user!.id }, data: { lastLoginAt: new Date() } });
  setSessionCookie(user!.id);

  // Only ever send people to a path inside this app.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

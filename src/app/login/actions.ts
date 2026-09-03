'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Company } from '@prisma/client';
import { db } from '@/lib/db';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { COMPANY_COOKIE } from '@/lib/company';

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
    fail('Too many attempts. Wait fifteen minutes, or ask Lee or Tyler to reset your password.');
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

  // A password set by someone else (admin reset, approved access request)
  // means straight to a dedicated reset screen — not wherever they were headed.
  if (user!.mustReset) redirect('/change-password');

  // Only ever send people to a path inside this app.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

/**
 * Nobody is signed in yet, so this can't check against a user's real access —
 * it only ever changes which brand the login screen itself shows. Every real
 * read of the active company re-clamps against the signed-in user's own
 * `companies` list once they're actually in.
 */
export async function setLoginBrand(formData: FormData) {
  const company = String(formData.get('company') ?? '') as Company;
  if (company === 'FENDER' || company === 'BS_SUPPLIES') {
    cookies().set(COMPANY_COOKIE, company, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect('/login');
}

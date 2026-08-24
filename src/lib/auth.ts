import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'node:crypto';
import { db } from './db';
import { can, type Permission, type SessionUser } from './rbac';

const COOKIE = 'fs_session';
const MAX_AGE = 60 * 60 * 12; // a working day, then sign in again

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) {
    throw new Error('SESSION_SECRET is missing or too short. Set it in .env — see .env.example.');
  }
  return s;
}

// ------------------------------------------------------------- passwords

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const candidate = crypto.scryptSync(plain, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Rejects the obvious ones. Anything longer and mixed is fine. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/i.test(plain) || !/[0-9]/.test(plain)) return 'Include letters and at least one number.';
  if (/^(password|fender|steel|welcome|letmein)/i.test(plain)) return 'That is too easy to guess.';
  return null;
}

// -------------------------------------------------------------- sessions

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: string): string {
  const body = `${userId}.${Date.now() + MAX_AGE * 1000}`;
  return `${Buffer.from(body).toString('base64url')}.${sign(body)}`;
}

function readSessionToken(token: string): string | null {
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) return null;
  const body = Buffer.from(encoded, 'base64url').toString();
  const expected = sign(body);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const [userId, expires] = body.split('.');
  if (!userId || Number(expires) < Date.now()) return null;
  return userId;
}

export function setSessionCookie(userId: string) {
  cookies().set(COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

// --------------------------------------------------------------- guards

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const userId = readSessionToken(token);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, initials: true, colour: true, active: true, companies: true },
  });
  if (!user || !user.active) return null;
  const { active: _active, ...session } = user;
  return session;
}

/** Use at the top of every protected page. Sends people to sign in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Use when a page or action needs a specific permission. */
export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, perm)) redirect(`/no-access?needed=${encodeURIComponent(perm)}`);
  return user;
}

/** Use inside server actions — throws rather than redirects. */
export async function assertPermission(perm: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Sign in again.');
  if (!can(user, perm)) throw new Error('You do not have permission to do that.');
  return user;
}

export async function logActivity(entity: string, entityId: string, action: string, detail = '', userId?: string) {
  await db.activityLog.create({ data: { entity, entityId, action, detail, userId } });
}

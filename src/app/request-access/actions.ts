'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Company } from '@prisma/client';
import { db } from '@/lib/db';
import { hashPassword, passwordProblem } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { COMPANY_LABEL } from '@/lib/company';

/** Same crude in-memory throttle style used across the other public forms. */
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

export async function submitAccessRequest(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const jobTitle = String(formData.get('jobTitle') ?? '').trim();
  const companies = formData.getAll('companies').map(String) as Company[];
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const fail = (message: string) => redirect(`/request-access?error=${encodeURIComponent(message)}`);

  if (!name || !email) fail('Enter your name and email.');
  if (companies.length === 0 || companies.some((c) => c !== 'FENDER' && c !== 'BS_SUPPLIES')) {
    fail('Choose which company (or companies) you need access to.');
  }
  if (password !== confirm) fail('Those passwords do not match.');
  const problem = passwordProblem(password);
  if (problem) fail(problem);

  if (throttled(email)) fail('Too many requests from that email. Try again later.');
  recordAttempt(email);

  if (await db.user.findUnique({ where: { email } })) {
    fail('An account with that email already exists — sign in instead, or use Forgot password.');
  }
  const existingPending = await db.accessRequest.findFirst({ where: { email, status: 'PENDING' } });
  if (existingPending) fail('A request for that email is already waiting for approval.');

  await db.accessRequest.create({
    data: { name, email, jobTitle, companies, passwordHash: hashPassword(password) },
  });

  // Best-effort — the request is already saved regardless of whether this send works.
  const admins = await db.user.findMany({ where: { role: 'MASTER_ADMIN', active: true } });
  const h = headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const companyText = companies.map((c) => COMPANY_LABEL[c]).join(' and ');
  for (const admin of admins) {
    await sendEmail({
      to: admin.email,
      subject: `Access request — ${name}`,
      text: [
        `${name} (${email}) has asked for access to ${companyText}${jobTitle ? ` as ${jobTitle}` : ''}.`,
        '',
        `Review it here: ${origin}/setup/access-requests`,
      ].join('\n'),
    });
  }

  redirect('/request-access?sent=1');
}

'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword, passwordProblem } from '@/lib/auth';

/**
 * For the forced first-sign-in reset only — the session already proves who
 * they are, and someone else chose their current password for them, so
 * asking them to also confirm it here is just friction, not real security.
 */
export async function completeMustReset(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const fail = (message: string) => redirect(`/change-password?error=${encodeURIComponent(message)}`);

  if (password !== confirm) fail('Those passwords do not match.');
  const problem = passwordProblem(password);
  if (problem) fail(problem);

  await db.user.update({ where: { id: user!.id }, data: { passwordHash: hashPassword(password), mustReset: false } });
  redirect('/');
}

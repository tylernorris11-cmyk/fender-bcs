'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { passwordProblem, resetPasswordWithToken, setSessionCookie } from '@/lib/auth';

export async function completeReset(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const fail = (message: string) => redirect(`/reset-password/${token}?error=${encodeURIComponent(message)}`);

  if (password !== confirm) fail('Those passwords do not match.');
  const problem = passwordProblem(password);
  if (problem) fail(problem);

  const result = await resetPasswordWithToken(token, password);
  if (!result) fail('This link has expired or has already been used. Request a new one.');

  await db.user.update({ where: { id: result!.id }, data: { lastLoginAt: new Date() } });
  setSessionCookie(result!.id);
  redirect('/');
}

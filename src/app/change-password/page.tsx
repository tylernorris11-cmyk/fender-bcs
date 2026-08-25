import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PasswordInput } from '@/components/PasswordInput';
import { completeMustReset } from './actions';

export default async function ChangePasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { mustReset: true } });
  if (!record.mustReset) redirect('/');

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-canvas">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Choose your own password</h1>
        <p className="text-ink-muted mt-1">Your password was set by someone else — pick a new one to carry on.</p>

        <form action={completeMustReset} className="card card-pad mt-6 space-y-4">
          {searchParams.error && (
            <p className="banner-bad" role="alert">{decodeURIComponent(searchParams.error)}</p>
          )}
          <div>
            <label className="label" htmlFor="password">New password</label>
            <PasswordInput id="password" name="password" autoComplete="new-password" required className="input" />
            <p className="hint">At least ten characters with a number.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">Set password and continue</button>
        </form>
      </div>
    </div>
  );
}

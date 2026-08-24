import Link from 'next/link';
import { redirect } from 'next/navigation';
import { findByResetToken, getCurrentUser } from '@/lib/auth';
import { completeReset } from '../actions';

export default async function ResetPasswordPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { error?: string } }) {
  if (await getCurrentUser()) redirect('/');

  const account = await findByResetToken(params.token);

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-canvas">
      <div className="w-full max-w-sm">
        {!account ? (
          <>
            <h1 className="text-2xl font-bold">That link has expired</h1>
            <div className="card card-pad mt-6">
              <p className="banner-warn">
                Reset links only work once and expire an hour after they're sent. Request a fresh one below.
              </p>
              <Link href="/forgot-password" className="btn-primary w-full mt-4 justify-center">Send a new link</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Choose a new password</h1>
            <p className="text-ink-muted mt-1">For {account.email}.</p>

            <form action={completeReset} className="card card-pad mt-6 space-y-4">
              <input type="hidden" name="token" value={params.token} />
              {searchParams.error && (
                <p className="banner-bad" role="alert">{decodeURIComponent(searchParams.error)}</p>
              )}
              <div>
                <label className="label" htmlFor="password">New password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
                <p className="hint">At least ten characters with a number.</p>
              </div>
              <div>
                <label className="label" htmlFor="confirm">Confirm password</label>
                <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
              </div>
              <button type="submit" className="btn-primary w-full">Set password and sign in</button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-ink-faint mt-4">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

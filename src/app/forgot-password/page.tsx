import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { requestPasswordReset } from './actions';

export default async function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  if (await getCurrentUser()) redirect('/');

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-canvas">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="text-ink-muted mt-1">Enter your account email and we'll send you a link to choose a new one.</p>

        {searchParams.sent ? (
          <div className="card card-pad mt-6">
            <p className="banner-ok">
              If that email has an account, a reset link is on its way. It works once and expires in an hour.
            </p>
            <p className="text-sm text-ink-muted mt-4">
              No email arrived after a few minutes? Check junk mail, or ask John or Claire to reset it for you.
            </p>
          </div>
        ) : (
          <form action={requestPasswordReset} className="card card-pad mt-6 space-y-4">
            {searchParams.error && (
              <p className="banner-bad" role="alert">{decodeURIComponent(searchParams.error)}</p>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="username" required
                     placeholder="you@fendersteel.co.uk" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Send reset link</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-faint mt-4">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

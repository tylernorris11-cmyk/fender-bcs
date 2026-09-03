import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PasswordInput } from '@/components/PasswordInput';
import { submitAccessRequest } from './actions';

export default async function RequestAccessPage({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  if (await getCurrentUser()) redirect('/');

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-canvas">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Request access</h1>
        <p className="text-ink-muted mt-1">Ask for a login — a Master Administrator reviews every request.</p>

        {searchParams.sent ? (
          <div className="card card-pad mt-6">
            <p className="banner-ok">
              Sent. You&apos;ll be able to sign in with the email and password you gave once it&apos;s approved.
            </p>
          </div>
        ) : (
          <form action={submitAccessRequest} className="card card-pad mt-6 space-y-4">
            {searchParams.error && (
              <p className="banner-bad" role="alert">{decodeURIComponent(searchParams.error)}</p>
            )}

            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" required className="input" />
            </div>

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="username" required
                     placeholder="you@fendersteel.co.uk" className="input" />
            </div>

            <div>
              <label className="label" htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" name="jobTitle" className="input" placeholder="Yard manager" />
            </div>

            <div>
              <span className="label">Which company?</span>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="companies" value="FENDER" className="h-4 w-4 accent-brand" />
                  Fender Steel
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="companies" value="BS_SUPPLIES" className="h-4 w-4 accent-brand" />
                  BCS Products
                </label>
              </div>
              <p className="hint">Tick both if you need to work across both businesses.</p>
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <PasswordInput id="password" name="password" autoComplete="new-password" required className="input" />
              <p className="hint">At least ten characters with a number. This is what you&apos;ll sign in with if approved.</p>
            </div>

            <div>
              <label className="label" htmlFor="confirm">Confirm password</label>
              <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required className="input" />
            </div>

            <button type="submit" className="btn-primary w-full">Send request</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-faint mt-4">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

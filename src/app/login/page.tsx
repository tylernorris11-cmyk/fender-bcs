import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { signIn } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (await getCurrentUser()) redirect('/');

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,52%)_1fr]">
      {/* ------------------------------------------------- brand panel */}
      <div className="relative bg-forest text-white overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[280px]">
        <div className="absolute inset-0 mesh-bg pointer-events-none" aria-hidden />
        <div className="relative">
          <div className="inline-block rounded-2xl bg-white/95 px-7 py-6 shadow-pop">
            <p className="text-3xl font-bold tracking-tight text-forest">
              Fender<span className="text-signal">BCS</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-brand-700 mt-1.5">
              Reinforcing steel specialists
            </p>
          </div>
        </div>

        <div className="relative max-w-md mt-12 lg:mt-0">
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
            The whole yard,<br />in one place.
          </h1>
          <p className="text-white/75 mt-5 text-lg leading-relaxed">
            Orders, production, deliveries, customers, CARES compliance, stock and assets —
            the business control system built for Fender Steel.
          </p>
        </div>

        <p className="relative text-sm text-white/55 mt-12 lg:mt-0">
          Reinforcing steel specialists · Scunthorpe &amp; Sunderland ·{' '}
          <strong className="text-white/85 font-semibold">Established 1981</strong>
        </p>
      </div>

      {/* ------------------------------------------------------- form */}
      <div className="grid place-items-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="text-ink-muted mt-1">Welcome back to the control centre.</p>

          <form action={signIn} className="card card-pad mt-6 space-y-4">
            <input type="hidden" name="next" value={searchParams.next ?? '/'} />

            {searchParams.error && (
              <p className="banner-bad" role="alert">{decodeURIComponent(searchParams.error)}</p>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="username" required
                     placeholder="you@fendersteel.co.uk" className="input" />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>

            <button type="submit" className="btn-primary w-full">Sign in</button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-4">
            Locked out? Ask John or Claire to reset your password.
          </p>
        </div>
      </div>
    </div>
  );
}

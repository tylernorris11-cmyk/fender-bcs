import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { COMPANY_COOKIE } from '@/lib/company';
import { PasswordInput } from '@/components/PasswordInput';
import { signIn, setLoginBrand } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (await getCurrentUser()) redirect('/');

  // No signed-in user yet to check access against, so this is purely
  // cosmetic — whichever brand this browser last looked at.
  const isBsSupplies = cookies().get(COMPANY_COOKIE)?.value === 'BS_SUPPLIES';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,52%)_1fr]">
      {/* ------------------------------------------------- brand panel */}
      <div className="relative bg-forest text-white overflow-hidden flex flex-col justify-between p-8 sm:p-12 min-h-[280px]">
        <div className="absolute inset-0 mesh-bg pointer-events-none" aria-hidden />
        <div className="relative flex items-start justify-between gap-4">
          <div className="inline-block rounded-2xl bg-white/95 px-7 py-6 shadow-pop">
            {isBsSupplies ? (
              <p className="text-3xl font-bold tracking-tight text-forest">BCS <span className="text-signal">Products</span></p>
            ) : (
              <Image src="/fender-logo.png" alt="Fender" width={200} height={141} priority className="w-[200px] h-auto" />
            )}
            <p className="text-[10px] uppercase tracking-[0.16em] text-brand-700 mt-1.5">
              {isBsSupplies ? 'Steel & building supplies' : 'Reinforcing steel specialists'}
            </p>
          </div>

          <div className="flex items-center rounded-xl bg-white/10 p-1 text-xs font-semibold shrink-0">
            <form action={setLoginBrand}>
              <input type="hidden" name="company" value="FENDER" />
              <button type="submit" className={`rounded-lg px-3 py-1.5 transition-colors ${!isBsSupplies ? 'bg-white text-forest' : 'text-white/70 hover:text-white'}`}>
                Fender Steel
              </button>
            </form>
            <form action={setLoginBrand}>
              <input type="hidden" name="company" value="BS_SUPPLIES" />
              <button type="submit" className={`rounded-lg px-3 py-1.5 transition-colors ${isBsSupplies ? 'bg-white text-forest' : 'text-white/70 hover:text-white'}`}>
                BCS Products
              </button>
            </form>
          </div>
        </div>

        <div className="relative max-w-md mt-12 lg:mt-0">
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
            The whole yard,<br />in one place.
          </h1>
          <p className="text-white/75 mt-5 text-lg leading-relaxed">
            {isBsSupplies
              ? 'Orders, production, deliveries, customers, stock and assets — the business control system built for BCS Products.'
              : 'Orders, production, deliveries, customers, CARES compliance, stock and assets — the business control system built for Fender Steel.'}
          </p>
        </div>

        <p className="relative text-sm text-white/55 mt-12 lg:mt-0">
          {isBsSupplies ? 'Steel & building supplies · Scunthorpe' : 'Reinforcing steel specialists · Scunthorpe & Houghton le Spring'} ·{' '}
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
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">Forgot it?</Link>
              </div>
              <PasswordInput id="password" name="password" autoComplete="current-password" required className="input" />
            </div>

            <button type="submit" className="btn-primary w-full">Sign in</button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-4">
            Still stuck? Ask John or Claire to reset it for you.
          </p>
          <p className="text-center text-sm text-ink-faint mt-2">
            New here? <Link href="/request-access" className="font-semibold text-brand-700 hover:underline">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

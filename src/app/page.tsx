import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Bell, Bug, CalendarDays, ClipboardCheck, ClipboardList, Factory, Layers,
  LogOut, Settings, ShieldCheck, ShoppingCart, Truck, Users,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can, MODULES, ROLE_LABELS } from '@/lib/rbac';
import { getAlerts } from '@/lib/alerts';
import { longDate } from '@/lib/format';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { Avatar } from '@/components/ui';
import { GlobalSearch } from '@/components/GlobalSearch';

const ICONS = {
  orders: ClipboardList, purchaseOrders: ShoppingCart, production: Factory, planning: CalendarDays, customers: Users,
  compliance: ShieldCheck, stock: Layers, assets: Truck, checks: ClipboardCheck,
} as const;

// Each tile gets its own accent so people learn the colour before the label.
const TONES = {
  orders: { icon: 'bg-brand-100 text-brand-700', bar: 'bg-brand', arrow: 'border-brand text-brand' },
  purchaseOrders: { icon: 'bg-cyan-100 text-cyan-700', bar: 'bg-cyan-500', arrow: 'border-cyan-500 text-cyan-600' },
  production: { icon: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', arrow: 'border-violet-500 text-violet-600' },
  planning: { icon: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500', arrow: 'border-sky-500 text-sky-600' },
  customers: { icon: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', arrow: 'border-emerald-500 text-emerald-600' },
  compliance: { icon: 'bg-signal/10 text-signal', bar: 'bg-signal', arrow: 'border-signal text-signal' },
  stock: { icon: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', arrow: 'border-amber-500 text-amber-600' },
  assets: { icon: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-500', arrow: 'border-indigo-500 text-indigo-600' },
  checks: { icon: 'bg-lime-100 text-lime-700', bar: 'bg-lime-500', arrow: 'border-lime-500 text-lime-600' },
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function Launcher() {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const active = getActiveCompany(user);
  const tiles = MODULES.filter((m) => can(user, m.perm) && (!('company' in m) || m.company === active));
  const isBsSupplies = active === 'BS_SUPPLIES';
  // BCS cuts fence post to length from coil — the default blurb describes
  // Fender's cut-and-bend-to-BS-8666 process, which doesn't apply there.
  const blurbOverrides: Partial<Record<string, string>> = isBsSupplies
    ? { production: "What still needs cutting to length, and what's already off the straightening line." }
    : {};

  return (
    <div className="min-h-screen">
      <header className="bg-forest text-white relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute inset-0 mesh-bg" />
        </div>
        <div className="relative max-w-[1200px] mx-auto px-6 py-5 flex items-center gap-3">
          {isBsSupplies ? (
            <span className="text-xl font-bold tracking-tight shrink-0">BCS<span className="text-white/60 font-medium"> Products</span></span>
          ) : (
            <Image src="/fender-logo.png" alt="Fender" width={64} height={45} priority className="w-[64px] h-auto shrink-0" />
          )}

          <GlobalSearch
            label="Search the whole system"
            placeholder="Search orders, customers, stock, assets…"
            className="hidden sm:flex flex-1 max-w-xl relative ml-4"
          />

          <div className="ml-auto flex items-center gap-3">
            {user.companies.length > 1 && (
              <div className="hidden md:flex items-center rounded-xl bg-white/10 p-1 text-xs font-semibold">
                {user.companies.map((c) => (
                  <form key={c} action="/api/company" method="post">
                    <input type="hidden" name="company" value={c} />
                    <input type="hidden" name="back" value="/" />
                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-1.5 transition-colors ${c === active ? 'bg-white text-forest' : 'text-white/70 hover:text-white'}`}
                    >
                      {COMPANY_LABEL[c]}
                    </button>
                  </form>
                ))}
              </div>
            )}
            <Link href="/alerts" className="relative rounded-xl bg-white/10 hover:bg-white/15 p-2.5" aria-label={`Alerts, ${alerts.length} needing attention`}>
              <Bell size={18} />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-signal text-[10px] font-bold grid place-items-center">
                  {alerts.length}
                </span>
              )}
            </Link>
            {can(user, 'setup.view') && (
              <Link href="/setup/pricing" className="btn bg-white/10 hover:bg-white/15 text-white text-sm">
                <Settings size={16} /> Set Up
              </Link>
            )}
            <Link href="/account" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 pl-1.5 pr-3.5 py-1.5">
              <Avatar name={user.name} colour={user.colour} size={30} />
              <span className="leading-tight text-left hidden sm:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-[11px] text-white/60">{user.jobTitle || ROLE_LABELS[user.role]}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-9">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{greeting()}, {user.name.split(' ')[0]}</h1>
            <p className="text-ink-muted mt-1.5">Welcome back to the {COMPANY_LABEL[active]} control centre</p>
          </div>
          <div className="card px-5 py-3.5 flex items-center gap-3 text-sm font-medium">
            <CalendarDays size={18} className="text-brand" aria-hidden />
            {longDate(new Date())}
          </div>
        </div>

        {alerts.length > 0 && (
          <Link href="/alerts" className="banner-warn mb-8 hover:bg-amber-100 transition-colors">
            <Bell size={18} className="shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong>{alerts.length} {alerts.length === 1 ? 'thing needs' : 'things need'} attention.</strong>{' '}
              {alerts[0].title}
              {alerts.length > 1 && <> and {alerts.length - 1} more.</>}
            </span>
          </Link>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((m) => {
            const Icon = ICONS[m.key];
            const tone = TONES[m.key];
            return (
              <Link key={m.key} href={m.href} className="card relative overflow-hidden p-6 pb-8 group hover:shadow-pop transition-shadow">
                <span className={`absolute bottom-0 left-0 right-0 h-1 ${tone.bar}`} aria-hidden />
                <span className={`inline-grid place-items-center h-14 w-14 rounded-2xl ${tone.icon}`} aria-hidden>
                  <Icon size={26} />
                </span>
                <h2 className="text-lg font-bold mt-14">{m.label}</h2>
                <p className="text-sm text-ink-muted mt-1.5 pr-14">{blurbOverrides[m.key] ?? m.blurb}</p>
                <span className={`absolute bottom-6 right-6 grid place-items-center h-10 w-10 rounded-full border-2 ${tone.arrow} group-hover:translate-x-0.5 transition-transform`} aria-hidden>
                  <ArrowRight size={18} />
                </span>
              </Link>
            );
          })}
        </div>

        <footer className="text-center text-sm text-ink-muted mt-12 flex items-center justify-center gap-6 flex-wrap">
          <span>
            {isBsSupplies ? 'BCS Products · Scunthorpe' : 'Fender Steel Reinforcing Specialists'} ·{' '}
            <strong className="text-signal">Established 1981</strong>
          </span>
          <Link href="/report-bug?from=/" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Bug size={14} /> Report a bug
          </Link>
          <form action="/api/sign-out" method="post">
            <button className="inline-flex items-center gap-1.5 hover:text-ink"><LogOut size={14} /> Sign out</button>
          </form>
        </footer>
      </div>
    </div>
  );
}

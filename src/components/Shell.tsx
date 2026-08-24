import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';
import { can, MODULES, ROLE_LABELS, type Permission, type SessionUser } from '@/lib/rbac';
import { Avatar } from './ui';

export type NavItem = { label: string; href: string; perm?: Permission };

const MODULE_TITLE: Record<string, string> = {
  orders: 'Sales Orders', purchaseOrders: 'Purchase Orders', production: 'Production', planning: 'Planning',
  customers: 'Customers', compliance: 'Compliance', stock: 'Stock', assets: 'Assets', checks: 'Checks', setup: 'Set Up',
};

export function Shell({
  user, module, nav, current, alerts = 0, children,
}: {
  user: SessionUser;
  module: keyof typeof MODULE_TITLE;
  nav: NavItem[];
  current: string;
  alerts?: number;
  children: ReactNode;
}) {
  const visible = nav.filter((n) => !n.perm || can(user, n.perm));

  return (
    <div className="min-h-screen lg:flex">
      {/* -------------------------------------------------------- sidebar */}
      <aside className="lg:w-64 lg:shrink-0 bg-forest text-white lg:min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg pointer-events-none" aria-hidden />
        <div className="relative flex lg:block items-center justify-between p-4 lg:p-0">
          <Link href="/" className="block lg:px-5 lg:pt-6 lg:pb-4">
            <span className="text-xl font-bold tracking-tight">
              Fender<span className="text-white/60 font-medium">BCS</span>
            </span>
            <span className="hidden lg:block text-[10px] uppercase tracking-[0.18em] text-white/45 mt-1">
              Reinforcing steel specialists
            </span>
          </Link>

          <nav className="hidden lg:block px-3 pt-4" aria-label={MODULE_TITLE[module]}>
            <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {MODULE_TITLE[module]}
            </p>
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`navlink ${current === item.href ? 'navlink-active' : ''}`}
                aria-current={current === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile: horizontal scroller instead of a hidden drawer. Yard tablets
            live in landscape but the office iPhones do not. */}
        <nav className="lg:hidden flex gap-2 overflow-x-auto px-4 pb-4 relative" aria-label={MODULE_TITLE[module]}>
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-pill px-4 py-2 text-sm ${
                current === item.href ? 'bg-white text-forest font-semibold' : 'bg-white/10 text-white/80'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block absolute bottom-0 left-0 right-0 p-5 text-sm">
          <p className="text-white/45 leading-tight mb-3">Fender Steel<br />Control Centre</p>
          <form action="/api/sign-out" method="post">
            <button type="submit" className="flex items-center gap-2 text-white/85 hover:text-white">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ------------------------------------------------------------ main */}
      <div className="flex-1 min-w-0">
        <header className="bg-forest text-white px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="btn bg-white/10 hover:bg-white/15 text-white px-4 py-2 text-sm">
            {MODULE_TITLE[module]} <ChevronDown size={16} />
          </Link>

          <form action="/search" className="hidden sm:flex flex-1 max-w-xl relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" aria-hidden />
            <label className="sr-only" htmlFor="global-search">Search orders and customers</label>
            <input
              id="global-search" name="q"
              placeholder="Search orders, customers…"
              className="w-full rounded-xl bg-white/10 border border-white/10 pl-10 pr-4 py-2.5 text-sm
                         text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/alerts" className="relative rounded-xl bg-white/10 hover:bg-white/15 p-2.5" aria-label={`Alerts, ${alerts} needing attention`}>
              <Bell size={18} />
              {alerts > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-signal text-[10px] font-bold grid place-items-center">
                  {alerts}
                </span>
              )}
            </Link>
            <Link href="/account" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 pl-1.5 pr-3.5 py-1.5">
              <Avatar name={user.name} colour={user.colour} size={30} />
              <span className="hidden sm:block leading-tight text-left">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-[11px] text-white/60">{user.jobTitle || ROLE_LABELS[user.role]}</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-7 max-w-[1200px]">{children}</main>
      </div>
    </div>
  );
}

/** Nav definitions, kept next to the shell so every module reads the same list. */
export const NAV: Record<string, NavItem[]> = {
  orders: [
    { label: 'All orders', href: '/orders' },
    { label: 'New order', href: '/orders/new', perm: 'orders.create' },
    { label: 'Awaiting approval', href: '/orders?stage=PENDING_APPROVAL' },
  ],
  purchaseOrders: [
    { label: 'All purchase orders', href: '/purchase-orders' },
    { label: 'New purchase order', href: '/purchase-orders/new', perm: 'purchaseOrders.create' },
    { label: 'Awaiting delivery', href: '/purchase-orders?status=SENT' },
  ],
  production: [
    { label: 'Work in progress', href: '/production' },
    { label: 'Bending schedules', href: '/production/schedules' },
    { label: 'Dimensional checks', href: '/production/checks' },
  ],
  planning: [
    { label: 'This week', href: '/planning' },
    { label: 'Today', href: '/planning?view=day' },
    { label: 'Month', href: '/planning?view=month' },
  ],
  customers: [{ label: 'All customers', href: '/customers' }],
  compliance: [
    { label: 'Overview', href: '/compliance' },
    { label: 'Certificates', href: '/compliance/certificates' },
    { label: 'Trace a batch', href: '/compliance/trace' },
    { label: 'Suppliers', href: '/compliance/suppliers' },
    { label: 'Non-conformance', href: '/compliance/ncr' },
    { label: 'Returns & actions', href: '/compliance/returns' },
  ],
  stock: [
    { label: 'All stock', href: '/stock' },
    { label: 'Goods in', href: '/stock/goods-in', perm: 'stock.goodsIn' },
    { label: 'Movements', href: '/stock/movements' },
  ],
  assets: [
    { label: 'Vehicles', href: '/assets' },
    { label: 'Machinery', href: '/assets?type=MACHINE' },
    { label: 'Retired', href: '/assets?retired=1' },
  ],
  checks: [
    { label: 'Check history', href: '/checks' },
    { label: 'Run a check', href: '/checks/new', perm: 'checks.create' },
  ],
  setup: [
    { label: 'Pricing', href: '/setup/pricing', perm: 'setup.pricing' },
    { label: 'Users & roles', href: '/setup/users', perm: 'setup.users' },
    { label: 'Drivers', href: '/setup/drivers', perm: 'setup.lists' },
    { label: 'Towns & cities', href: '/setup/towns', perm: 'setup.lists' },
    { label: 'Order checklist', href: '/setup/checklist', perm: 'setup.lists' },
    { label: 'Backups', href: '/setup/backups', perm: 'setup.backups' },
  ],
};

export { MODULES };

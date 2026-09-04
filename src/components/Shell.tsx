import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Bell, Bug, Home, LogOut } from 'lucide-react';
import type { Company } from '@prisma/client';
import { can, MODULES, ROLE_LABELS, type Permission, type SessionUser } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { Avatar } from './ui';
import { ModuleSwitcher } from './ModuleSwitcher';
import { GlobalSearch } from './GlobalSearch';

// `company`, when set, only shows this nav item while that company's view is
// active — for things like BCS Products' cost centres that don't exist on
// the Fender side at all.
export type NavItem = { label: string; href: string; perm?: Permission; company?: Company };

const MODULE_TITLE: Record<string, string> = {
  orders: 'Sales Orders', purchaseOrders: 'Purchase Orders', production: 'Production', planning: 'Deliveries', holidays: 'Holidays',
  customers: 'Customers', compliance: 'Compliance', stock: 'Stock', assets: 'Assets', checks: 'Checks', fuel: 'Fuel', hs: 'Health & Safety', setup: 'Set Up',
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
  const active = getActiveCompany(user);
  const isBsSupplies = active === 'BS_SUPPLIES';
  const visible = nav.filter((n) => (!n.perm || can(user, n.perm)) && (!n.company || n.company === active));
  const switcherItems = [
    ...MODULES.filter((m) => can(user, m.perm) && (!('company' in m) || m.company === active)).map((m) => ({ key: m.key, label: m.label, href: m.href })),
    ...(can(user, 'setup.view') ? [{ key: 'setup', label: 'Set Up', href: '/setup/pricing' }] : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      {/* -------------------------------------------------------- sidebar */}
      <aside className="lg:w-64 lg:shrink-0 bg-forest text-white lg:min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg pointer-events-none" aria-hidden />
        <div className="relative flex lg:block items-center justify-between p-4 lg:p-0">
          <Link href="/" className="block lg:px-5 lg:pt-6 lg:pb-4">
            {isBsSupplies ? (
              <Image src="/bcs-logo.png" alt="BCS Products" width={148} height={119} priority className="w-[148px] h-auto" />
            ) : (
              <span className="inline-block bg-white rounded-xl px-3 py-2 shadow-pop">
                <Image src="/fender-logo.png" alt="Fender" width={140} height={98} priority className="w-[140px] h-auto" />
              </span>
            )}
            <span className="hidden lg:block text-[10px] uppercase tracking-[0.18em] text-white/45 mt-1">
              {isBsSupplies ? 'Steel & building supplies' : 'Reinforcing steel specialists'}
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
          <p className="text-white/45 leading-tight mb-3">{isBsSupplies ? 'BCS Products' : 'Fender Steel'}<br />Control Centre</p>
          <Link href={`/report-bug?from=${encodeURIComponent(current)}`} className="flex items-center gap-2 text-white/85 hover:text-white mb-3">
            <Bug size={16} /> Report a bug
          </Link>
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
          <Link href="/" className="rounded-xl bg-white/10 hover:bg-white/15 text-white p-2.5 shrink-0" aria-label="Home">
            <Home size={18} />
          </Link>
          <ModuleSwitcher current={module} currentLabel={MODULE_TITLE[module]} items={switcherItems} />

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-3">
            {user.companies.length > 1 && (
              <div className="hidden md:flex items-center rounded-xl bg-white/10 p-1 text-xs font-semibold">
                {user.companies.map((c) => (
                  <form key={c} action="/api/company" method="post">
                    <input type="hidden" name="company" value={c} />
                    <input type="hidden" name="back" value={current} />
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
    { label: 'Other work', href: '/production/other-work' },
    { label: 'Bar counter', href: '/stock/bar-counter', perm: 'stock.goodsIn' },
    // Bending and BS 8666 dimensional tolerances are rebar-specific — BCS
    // Products cuts fence post to length from coil, nothing to bend or check.
    { label: 'Bending schedules', href: '/production/schedules', company: 'FENDER' },
    { label: 'Dimensional checks', href: '/production/checks', company: 'FENDER' },
  ],
  planning: [
    { label: 'This week', href: '/planning' },
    { label: 'Today', href: '/planning?view=day' },
    { label: 'Month', href: '/planning?view=month' },
  ],
  holidays: [
    { label: 'Requests', href: '/holidays' },
    { label: 'Calendar', href: '/holidays/calendar' },
  ],
  customers: [{ label: 'All customers', href: '/customers' }],
  compliance: [
    { label: 'Overview', href: '/compliance' },
    { label: 'Upload certificate', href: '/compliance/test-certs' },
    { label: 'Trace a batch', href: '/compliance/trace' },
    { label: 'Suppliers', href: '/compliance/suppliers' },
    { label: 'Non-conformance', href: '/compliance/ncr' },
    { label: 'Returns & actions', href: '/compliance/returns' },
  ],
  stock: [
    { label: 'All stock', href: '/stock' },
    { label: 'Goods in', href: '/stock/goods-in', perm: 'stock.goodsIn' },
    { label: 'Movements', href: '/stock/movements' },
    { label: 'Bar counter', href: '/stock/bar-counter', perm: 'stock.goodsIn' },
  ],
  assets: [
    { label: 'Both', href: '/assets' },
    { label: 'Vehicles', href: '/assets?type=VEHICLE' },
    { label: 'Machinery', href: '/assets?type=MACHINE' },
    { label: 'Retired', href: '/assets?retired=1' },
  ],
  checks: [
    { label: 'Check history', href: '/checks' },
    { label: 'Run a check', href: '/checks/new', perm: 'checks.create' },
    { label: 'Notes', href: '/checks/notes' },
  ],
  fuel: [
    { label: 'Fuel log', href: '/fuel' },
    { label: 'Add entry', href: '/fuel/new', perm: 'fuel.create' },
  ],
  hs: [
    { label: 'Overview', href: '/hs' },
    { label: 'Documents', href: '/hs/documents' },
    { label: 'My training', href: '/hs/training' },
    { label: 'Manage training', href: '/hs/training/manage', perm: 'hs.manageTraining' },
  ],
  setup: [
    { label: 'Pricing', href: '/setup/pricing', perm: 'setup.pricing' },
    { label: 'Users & roles', href: '/setup/users', perm: 'setup.users' },
    { label: 'Access requests', href: '/setup/access-requests', perm: 'setup.users' },
    { label: 'Drivers', href: '/setup/drivers', perm: 'setup.lists' },
    { label: 'Towns & cities', href: '/setup/towns', perm: 'setup.lists' },
    { label: 'Locations', href: '/setup/locations', perm: 'setup.lists' },
    { label: 'Cost centres', href: '/setup/cost-centres', perm: 'setup.lists', company: 'BS_SUPPLIES' },
    { label: 'Order checklist', href: '/setup/checklist', perm: 'setup.lists' },
    { label: 'Backups', href: '/setup/backups', perm: 'setup.backups' },
    { label: 'Bug reports', href: '/setup/bugs', perm: 'setup.bugs' },
  ],
};

export { MODULES };

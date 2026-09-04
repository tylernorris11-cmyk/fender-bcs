import type { Company, Role } from '@prisma/client';

/**
 * Every gated capability in the system. Add a permission here, grant it below,
 * then check it with `can(user, 'orders.approve')`. Nothing else in the app
 * decides who is allowed to do what.
 */
export type Permission =
  // Orders and sales
  | 'orders.view'
  | 'orders.create'
  | 'orders.edit'
  | 'orders.approve' // move past Pending approval, override credit limit
  | 'orders.progress' // move through delivery stages
  | 'orders.archive'
  | 'orders.markPaid'
  | 'orders.export'
  // Customers
  | 'customers.view'
  | 'customers.edit'
  | 'customers.credit' // set credit limits and payment terms
  // Stock
  | 'stock.view'
  | 'stock.goodsIn'
  | 'stock.pick'
  | 'stock.adjust' // write-offs, scrap, manual corrections
  // Production
  | 'production.view'
  | 'production.progress'
  | 'production.qc'
  | 'production.assign' // post an "other work" task for someone else — Master Admin/Admin only
  // Compliance
  | 'compliance.view'
  | 'compliance.edit' // certificates, suppliers, returns
  | 'compliance.ncr' // raise and close non-conformances
  // Assets
  | 'assets.view'
  | 'assets.edit'
  // Purchase orders (buying steel and materials from suppliers)
  | 'purchaseOrders.view'
  | 'purchaseOrders.create'
  | 'purchaseOrders.edit'
  // Checks — morning pre-use checks on vehicles and machines
  | 'checks.view'
  | 'checks.create'
  // Fuel — logging fill-ups against the yard tank meter
  | 'fuel.view'
  | 'fuel.create'
  // Planning
  | 'planning.view'
  | 'planning.edit'
  // Holidays — request/view is universal; deciding is a Master Admin-only
  // role check, not a grantable permission (see holidays/actions.ts)
  | 'holidays.view'
  // Health & Safety — HSE documents and mandatory training. view is universal.
  | 'hs.view'
  | 'hs.edit' // upload/archive HSE documents
  | 'hs.manageTraining' // author training modules, assign machine training
  // Set Up
  | 'setup.view'
  | 'setup.pricing'
  | 'setup.users'
  | 'setup.lists'
  | 'setup.backups'
  | 'setup.bugs' // read the "report a bug" inbox
  // Commercially sensitive
  | 'finance.costs' // purchase costs and margin — CEO only
  | 'finance.debtors';

const ALL: Permission[] = [
  'orders.view', 'orders.create', 'orders.edit', 'orders.approve', 'orders.progress',
  'orders.archive', 'orders.markPaid', 'orders.export',
  'customers.view', 'customers.edit', 'customers.credit',
  'stock.view', 'stock.goodsIn', 'stock.pick', 'stock.adjust',
  'production.view', 'production.progress', 'production.qc', 'production.assign',
  'compliance.view', 'compliance.edit', 'compliance.ncr',
  'assets.view', 'assets.edit',
  'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit',
  'checks.view', 'checks.create',
  'fuel.view', 'fuel.create',
  'planning.view', 'planning.edit',
  'holidays.view',
  'hs.view', 'hs.edit', 'hs.manageTraining',
  'setup.view', 'setup.pricing', 'setup.users', 'setup.lists', 'setup.backups', 'setup.bugs',
  'finance.costs', 'finance.debtors',
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  // Owns the whole system. Same permissions as Administrator — the
  // difference between the two is company access, enforced separately.
  MASTER_ADMIN: ALL,

  // The CEO and directors. Everything, including purchase cost and margin.
  // Locked to a single company (see setup/actions.ts) rather than both.
  ADMIN: ALL,

  // Runs the yard. Can do the whole job except set pay-grade pricing,
  // manage user accounts, or see what the steel cost to buy.
  MANAGER: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.approve', 'orders.progress',
    'orders.archive', 'orders.markPaid', 'orders.export',
    'customers.view', 'customers.edit',
    'stock.view', 'stock.goodsIn', 'stock.pick', 'stock.adjust',
    'production.view', 'production.progress', 'production.qc',
    'compliance.view', 'compliance.ncr',
    'assets.view', 'assets.edit',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit',
    'checks.view', 'checks.create',
    'fuel.view', 'fuel.create',
    'planning.view', 'planning.edit',
    'holidays.view',
    'hs.view', 'hs.edit', 'hs.manageTraining',
    'setup.view', 'setup.lists',
    'finance.debtors',
  ],

  // Takes orders and looks after accounts. Cannot approve past a credit limit
  // and cannot touch stock or production.
  SALES: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.export',
    'customers.view', 'customers.edit',
    'stock.view',
    'production.view',
    'planning.view',
    'holidays.view',
    'compliance.view',
    'hs.view',
    'finance.debtors',
  ],

  // General office admin — same ground as Sales (orders, accounts, no
  // pricing or cost data) plus visibility on vehicles/machinery and checks.
  OFFICE: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.export',
    'customers.view', 'customers.edit',
    'stock.view',
    'production.view',
    'planning.view',
    'holidays.view',
    'compliance.view',
    'finance.debtors',
    'assets.view',
    'checks.view',
    'fuel.view',
    'hs.view',
  ],

  // Quality manager. Owns the audit file.
  QUALITY: [
    'orders.view',
    'customers.view',
    'stock.view', 'stock.adjust',
    'production.view', 'production.qc',
    'compliance.view', 'compliance.edit', 'compliance.ncr',
    'assets.view', 'assets.edit',
    'purchaseOrders.view',
    'checks.view',
    'fuel.view',
    'planning.view', 'planning.edit',
    'holidays.view',
    'hs.view',
    'setup.view', 'setup.lists',
  ],

  // Yard and production staff.
  YARD: [
    'orders.view', 'orders.progress',
    'stock.view', 'stock.goodsIn', 'stock.pick',
    'production.view', 'production.progress',
    'compliance.view', 'compliance.ncr',
    'assets.view',
    'purchaseOrders.view', 'purchaseOrders.create',
    'checks.view', 'checks.create',
    'fuel.view', 'fuel.create',
    'planning.view',
    'holidays.view',
    'hs.view',
  ],

  // Drivers see the run and mark deliveries done.
  DRIVER: ['orders.view', 'orders.progress', 'planning.view', 'holidays.view', 'assets.view', 'checks.view', 'checks.create', 'fuel.view', 'fuel.create', 'hs.view'],

  // Read only — auditors, office cover, new starters.
  VIEWER: [
    'orders.view', 'customers.view', 'stock.view', 'production.view', 'compliance.view', 'planning.view', 'holidays.view', 'assets.view',
    'purchaseOrders.view', 'checks.view', 'fuel.view', 'hs.view',
  ],
};

export type SessionUser = {
  id: string; name: string; email: string; role: Role; jobTitle: string; initials: string; colour: string;
  companies: Company[]; hiddenModules: string[];
};

/**
 * A permission's own module ("orders" out of "orders.view") doubles as the
 * key a Master Administrator can hide for someone in Set Up — hiding it
 * blocks every permission under that prefix, not just view, so a hidden
 * module is gone from the page itself, not just the menu. Never applies to
 * a Master Administrator; there would be no way back in for the last one.
 */
export function can(user: Pick<SessionUser, 'role' | 'hiddenModules'> | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role !== 'MASTER_ADMIN' && user.hiddenModules?.includes(perm.split('.')[0])) return false;
  return PERMISSIONS[user.role]?.includes(perm) ?? false;
}

export function canAny(user: SessionUser | null | undefined, ...perms: Permission[]): boolean {
  return perms.some((p) => can(user, p));
}

/** Which launcher tiles this user gets. */
export const MODULES = [
  { key: 'orders', label: 'Sales Orders', href: '/orders', perm: 'orders.view' as Permission, blurb: 'Create, manage and track customer sales orders.' },
  { key: 'purchaseOrders', label: 'Purchase Orders', href: '/purchase-orders', perm: 'purchaseOrders.view' as Permission, blurb: 'Raise and track orders placed with suppliers.' },
  { key: 'production', label: 'Production', href: '/production', perm: 'production.view' as Permission, blurb: 'Cutting, bending and dimensional checks to BS 8666.' },
  { key: 'planning', label: 'Deliveries', href: '/planning', perm: 'planning.view' as Permission, blurb: 'View and manage deliveries, collections and site schedules.' },
  { key: 'holidays', label: 'Holidays', href: '/holidays', perm: 'holidays.view' as Permission, blurb: 'Request time off, approve requests and see who else is away.' },
  { key: 'customers', label: 'Customers', href: '/customers', perm: 'customers.view' as Permission, blurb: 'Manage customer profiles, contacts and history.' },
  { key: 'compliance', label: 'Compliance', href: '/compliance', perm: 'compliance.view' as Permission, blurb: 'CARES approval, certificates and full steel traceability.', company: 'FENDER' as Company },
  { key: 'stock', label: 'Stock', href: '/stock', perm: 'stock.view' as Permission, blurb: 'Track inventory levels, materials and movements.' },
  { key: 'barCounter', label: 'Bar Counter', href: '/stock/bar-counter', perm: 'stock.goodsIn' as Permission, blurb: 'Photograph a bundle end and count the bars automatically.' },
  { key: 'assets', label: 'Assets', href: '/assets', perm: 'assets.view' as Permission, blurb: 'Manage company assets, equipment and maintenance.' },
  { key: 'checks', label: 'Checks', href: '/checks', perm: 'checks.view' as Permission, blurb: 'Morning checks on machines, lorries and pickups before use.' },
  { key: 'fuel', label: 'Fuel', href: '/fuel', perm: 'fuel.view' as Permission, blurb: 'Log fuel taken from the yard tank against each vehicle.' },
  { key: 'hs', label: 'Health & Safety', href: '/hs', perm: 'hs.view' as Permission, blurb: 'HSE documents, RAMS and mandatory training.' },
] as const;

/** Every module a Master Administrator can hide for someone in Set Up — everything except Set Up itself. */
export const TOGGLEABLE_MODULES = MODULES.map((m) => ({ key: m.key, label: m.label }));

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: 'Master Administrator',
  ADMIN: 'Administrator',
  MANAGER: 'Yard manager',
  SALES: 'Sales',
  OFFICE: 'Office',
  QUALITY: 'Quality',
  YARD: 'Yard operative',
  DRIVER: 'Driver',
  VIEWER: 'Read only',
};

export const ROLE_BLURBS: Record<Role, string> = {
  MASTER_ADMIN: 'Everything, across both companies. Only role that can grant Master Administrator or multi-company access.',
  ADMIN: 'Everything, including purchase costs, pricing and user accounts — locked to a single company.',
  MANAGER: 'Runs the yard. No purchase costs, pricing or user management.',
  SALES: 'Orders and customers. Cannot approve over a credit limit.',
  OFFICE: 'General office admin — orders, accounts, vehicles and checks. No pricing or cost data.',
  QUALITY: 'Owns the audit file — certificates, NCRs, calibration, returns.',
  YARD: 'Goods in, picking, production and delivery progress.',
  DRIVER: 'Their runs and delivery sheets.',
  VIEWER: 'Read only. Safe account to hand an auditor.',
};

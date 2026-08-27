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
  // Planning
  | 'planning.view'
  | 'planning.edit'
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
  'production.view', 'production.progress', 'production.qc',
  'compliance.view', 'compliance.edit', 'compliance.ncr',
  'assets.view', 'assets.edit',
  'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit',
  'checks.view', 'checks.create',
  'planning.view', 'planning.edit',
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
    'planning.view', 'planning.edit',
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
    'compliance.view',
    'finance.debtors',
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
    'planning.view', 'planning.edit',
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
    'planning.view',
  ],

  // Drivers see the run and mark deliveries done.
  DRIVER: ['orders.view', 'orders.progress', 'planning.view', 'assets.view', 'checks.view', 'checks.create'],

  // Read only — auditors, office cover, new starters.
  VIEWER: [
    'orders.view', 'customers.view', 'stock.view', 'production.view', 'compliance.view', 'planning.view', 'assets.view',
    'purchaseOrders.view', 'checks.view',
  ],
};

export type SessionUser = {
  id: string; name: string; email: string; role: Role; jobTitle: string; initials: string; colour: string;
  companies: Company[];
};

export function can(user: Pick<SessionUser, 'role'> | null | undefined, perm: Permission): boolean {
  if (!user) return false;
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
  { key: 'customers', label: 'Customers', href: '/customers', perm: 'customers.view' as Permission, blurb: 'Manage customer profiles, contacts and history.' },
  { key: 'compliance', label: 'Compliance', href: '/compliance', perm: 'compliance.view' as Permission, blurb: 'CARES approval, certificates and full steel traceability.', company: 'FENDER' as Company },
  { key: 'stock', label: 'Stock', href: '/stock', perm: 'stock.view' as Permission, blurb: 'Track inventory levels, materials and movements.' },
  { key: 'assets', label: 'Assets', href: '/assets', perm: 'assets.view' as Permission, blurb: 'Manage company assets, equipment and maintenance.' },
  { key: 'checks', label: 'Checks', href: '/checks', perm: 'checks.view' as Permission, blurb: 'Morning checks on machines, lorries and pickups before use.' },
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: 'Master Administrator',
  ADMIN: 'Administrator',
  MANAGER: 'Yard manager',
  SALES: 'Sales',
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
  QUALITY: 'Owns the audit file — certificates, NCRs, calibration, returns.',
  YARD: 'Goods in, picking, production and delivery progress.',
  DRIVER: 'Their runs and delivery sheets.',
  VIEWER: 'Read only. Safe account to hand an auditor.',
};

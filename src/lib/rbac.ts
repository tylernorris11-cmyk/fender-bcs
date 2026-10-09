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
  // Bar Counter — its own permission (not under stock.*) so it can be shown
  // or hidden independently of the rest of Stock; see MODULES below.
  | 'barCounter.view'
  // Production
  | 'production.view'
  | 'production.progress'
  | 'production.qc'
  | 'production.assign' // post an "other work" task for someone else — Master Admin/Admin only
  | 'production.editHistory' // correct a BCS tally job after the fact — job number, customer, rows; grantable to one person via extraPermissions
  // Compliance
  | 'compliance.view'
  | 'compliance.edit' // certificates, suppliers, returns
  | 'compliance.ncr' // raise and close non-conformances
  | 'compliance.fcpCosh' // upload/rename/archive on FCP Data & Cosh sheets only — a narrower slice of compliance.edit, grantable to one person via extraPermissions without handing them the rest of Compliance
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
  | 'fuel.history' // month-to-month usage trend — Master Admin/Admin only
  // Planning
  | 'planning.view'
  | 'planning.edit'
  // Timesheets — 'timesheets.view' isn't in any role's list: it's true only
  // for people ticked on timesheets (User.onTimesheets, chosen in Set Up >
  // Who fills timesheets), whatever their role, and worked out in can()
  // below. 'viewAll' is separate: the admin-side Team page under Set Up.
  | 'timesheets.view'
  | 'timesheets.viewAll' // see everyone's timesheets and who hasn't handed theirs in
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
  // Sales outreach — BCS Products / BS Supplies cold-email agent
  | 'outreach.view'
  | 'outreach.manage' // approve/reject drafts, trigger sends
  // Accounts — the nominal ledger being built to take over from Exchequer
  | 'accounts.view' // trial balance, journals, nominal enquiries
  | 'accounts.post' // post and reverse journals
  | 'accounts.setup' // chart of accounts, VAT codes, periods, document numbering
  // Commercially sensitive
  | 'finance.costs' // purchase costs and margin — CEO only
  | 'finance.debtors';

const ALL: Permission[] = [
  'orders.view', 'orders.create', 'orders.edit', 'orders.approve', 'orders.progress',
  'orders.archive', 'orders.markPaid', 'orders.export',
  'customers.view', 'customers.edit', 'customers.credit',
  'stock.view', 'stock.goodsIn', 'stock.pick', 'stock.adjust', 'barCounter.view',
  'production.view', 'production.progress', 'production.qc', 'production.assign', 'production.editHistory',
  'compliance.view', 'compliance.edit', 'compliance.ncr', 'compliance.fcpCosh',
  'assets.view', 'assets.edit',
  'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit',
  'checks.view', 'checks.create',
  'fuel.view', 'fuel.create', 'fuel.history',
  'planning.view', 'planning.edit',
  'holidays.view', 'timesheets.viewAll',
  'hs.view', 'hs.edit', 'hs.manageTraining',
  'setup.view', 'setup.pricing', 'setup.users', 'setup.lists', 'setup.backups', 'setup.bugs',
  'outreach.view', 'outreach.manage',
  'accounts.view', 'accounts.post', 'accounts.setup',
  'finance.costs', 'finance.debtors',
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  // Owns the whole system. Same permissions as Administrator — the
  // difference between the two is company access, enforced separately.
  MASTER_ADMIN: ALL,

  // The CEO and directors. Everything, including purchase cost and margin.
  // Locked to a single company (see setup/actions.ts) rather than both.
  ADMIN: ALL,
  // Runs the accounts: the ledger, journals, VAT and periods, credit control
  // and getting orders paid — with the purchase costs that takes. No user
  // management, stock or production.
  ACCOUNTS_ADMIN: [
    'accounts.view', 'accounts.post', 'accounts.setup',
    'finance.costs', 'finance.debtors',
    'orders.view', 'orders.markPaid', 'orders.export',
    'customers.view', 'customers.edit', 'customers.credit',
    'purchaseOrders.view',
    'holidays.view',
    'hs.view',
  ],

  // Runs the yard. Can do the whole job except set pay-grade pricing,
  // manage user accounts, or see what the steel cost to buy.
  MANAGER: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.approve', 'orders.progress',
    'orders.archive', 'orders.markPaid', 'orders.export',
    'customers.view', 'customers.edit',
    'stock.view', 'stock.goodsIn', 'stock.pick', 'stock.adjust', 'barCounter.view',
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
    'outreach.view', 'outreach.manage',
  ],

  // General office admin — same ground as Sales (orders, accounts, no
  // pricing or cost data) plus visibility on vehicles/machinery and checks.
  OFFICE: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.export',
    'customers.view', 'customers.edit',
    'stock.view', 'stock.goodsIn', 'stock.pick', 'stock.adjust',
    'production.view',
    'planning.view',
    'holidays.view',
    'compliance.view',
    'finance.debtors',
    'assets.view',
    'checks.view', 'checks.create',
    'fuel.view', 'fuel.create',
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
    'stock.view', 'stock.goodsIn', 'stock.pick', 'barCounter.view',
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

  // Drivers see the run and mark deliveries done. Also get Bar Counter —
  // they're often the ones unloading a bundle at goods-in or on site.
  DRIVER: [
    'orders.view', 'orders.progress', 'planning.view', 'holidays.view', 'assets.view',
    'checks.view', 'checks.create', 'fuel.view', 'fuel.create', 'hs.view', 'barCounter.view',
  ],

  // Read only — auditors, office cover, new starters.
  VIEWER: [
    'orders.view', 'customers.view', 'stock.view', 'production.view', 'compliance.view', 'planning.view', 'holidays.view', 'assets.view',
    'purchaseOrders.view', 'checks.view', 'fuel.view', 'hs.view',
  ],
};

export type SessionUser = {
  id: string; name: string; email: string; role: Role; jobTitle: string; initials: string; colour: string;
  companies: Company[]; hiddenModules: string[]; extraPermissions: string[]; onTimesheets: boolean;
  /** The role's permissions as they stand — its defaults below, or as changed in Set Up → Roles. */
  permissions?: Permission[];
};

/**
 * What a role can do: everything for a Master Administrator, always — there
 * has to be a way back in — otherwise what Set Up → Roles saved for it, or
 * its defaults above when it's never been changed. Anything saved that's no
 * longer a permission is dropped.
 */
export function rolePermissionsFrom(role: Role, saved?: string[] | null): Permission[] {
  if (role === 'MASTER_ADMIN') return ALL;
  if (!saved) return PERMISSIONS[role] ?? [];
  return ALL.filter((p) => saved.includes(p));
}

/**
 * A permission's own module ("orders" out of "orders.view") doubles as the
 * key a Master Administrator can hide for someone in Set Up — hiding it
 * blocks every permission under that prefix, not just view, so a hidden
 * module is gone from the page itself, not just the menu. Never applies to
 * a Master Administrator; there would be no way back in for the last one.
 */
export function can(user: Pick<SessionUser, 'role' | 'hiddenModules' | 'extraPermissions' | 'onTimesheets' | 'permissions'> | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role !== 'MASTER_ADMIN' && user.hiddenModules?.includes(perm.split('.')[0])) return false;
  if (perm === 'timesheets.view') return !!user.onTimesheets;
  const granted = user.role === 'MASTER_ADMIN' ? ALL : (user.permissions ?? PERMISSIONS[user.role] ?? []);
  return granted.includes(perm) || (user.extraPermissions?.includes(perm) ?? false);
}

/**
 * Everyone working on Fender's side can see Fender's stock and book coils
 * and bundles in and out, whatever their role or Set Up hiding says. Only
 * while Fender is the company they're looking at, so BCS stock access is
 * unchanged for people on both. Shared screens (like the delivery board)
 * aren't people and keep exactly what they were given.
 */
export const FENDER_EVERYONE_PERMISSIONS: Permission[] = ['stock.view', 'stock.goodsIn', 'stock.adjust'];

export function withCompanyGrants<T extends Pick<SessionUser, 'hiddenModules' | 'extraPermissions'>>(user: T, company: Company, sharedScreen: boolean): T {
  if (company !== 'FENDER' || sharedScreen) return user;
  return {
    ...user,
    hiddenModules: user.hiddenModules.filter((m) => m !== 'stock'),
    extraPermissions: [...new Set([...user.extraPermissions, ...FENDER_EVERYONE_PERMISSIONS])],
  };
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
  { key: 'timesheets', label: 'Timesheets', href: '/timesheets', perm: 'timesheets.view' as Permission, blurb: 'Fill in the hours you worked — start, finish and breaks — every Monday for the week before.' },
  { key: 'customers', label: 'Customers', href: '/customers', perm: 'customers.view' as Permission, blurb: 'Manage customer profiles, contacts and history.' },
  { key: 'compliance', label: 'Compliance', href: '/compliance', perm: 'compliance.view' as Permission, blurb: 'CARES approval, certificates and full steel traceability.', company: 'FENDER' as Company },
  { key: 'stock', label: 'Stock', href: '/stock', perm: 'stock.view' as Permission, blurb: 'Track inventory levels, materials and movements.' },
  { key: 'barCounter', label: 'Bar Counter', href: '/stock/bar-counter', perm: 'barCounter.view' as Permission, blurb: 'Photograph a bundle end and count the bars automatically.' },
  { key: 'assets', label: 'Assets', href: '/assets', perm: 'assets.view' as Permission, blurb: 'Manage company assets, equipment and maintenance.' },
  { key: 'checks', label: 'Checks', href: '/checks', perm: 'checks.view' as Permission, blurb: 'Morning checks on machines, lorries and pickups before use.' },
  { key: 'fuel', label: 'Fuel', href: '/fuel', perm: 'fuel.view' as Permission, blurb: 'Log fuel taken from the yard tank against each vehicle.' },
  { key: 'hs', label: 'Health & Safety', href: '/hs', perm: 'hs.view' as Permission, blurb: 'Risk assessments, incidents, actions and training.' },
  { key: 'outreach', label: 'Sales Outreach', href: '/outreach', perm: 'outreach.view' as Permission, blurb: 'Find new trade customers and review outreach emails before they send.', company: 'BS_SUPPLIES' as Company },
  { key: 'accounts', label: 'Accounts', href: '/accounts', perm: 'accounts.view' as Permission, blurb: 'Nominal ledger, journals and the trial balance. Being built to take over from Exchequer.' },
] as const;

/** Narrow one-off permissions a Master Administrator/Administrator can grant
 * to a specific person in Set Up, on top of whatever their role already
 * gives them — for when someone needs just one extra capability rather than
 * a whole different role. Grows as more narrow permissions like this get
 * added; nothing here should duplicate something a role already covers. */
export const GRANTABLE_EXTRA_PERMISSIONS = [
  { key: 'compliance.fcpCosh' as Permission, label: 'Upload FCP Data & Cosh sheets' },
  { key: 'planning.edit' as Permission, label: 'Add deliveries and assign drivers' },
  { key: 'production.editHistory' as Permission, label: 'Edit finished BCS production jobs' },
] as const;

/** Every module a Master Administrator can hide for someone in Set Up — everything except Set Up itself. */
export const TOGGLEABLE_MODULES = MODULES.map((m) => ({ key: m.key, label: m.label }));

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: 'Master Administrator',
  ADMIN: 'Administrator',
  ACCOUNTS_ADMIN: 'Accounts administrator',
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
  ACCOUNTS_ADMIN: 'The accounts — ledger, journals, VAT and periods — plus credit control and marking orders paid. No user management, stock or production.',
  MANAGER: 'Runs the yard. No purchase costs, pricing or user management.',
  SALES: 'Orders and customers. Cannot approve over a credit limit.',
  OFFICE: 'General office admin — orders, accounts, stock, vehicles, checks and fuel. No pricing or cost data.',
  QUALITY: 'Owns the audit file — certificates, NCRs, calibration, returns.',
  YARD: 'Goods in, picking, production and delivery progress.',
  DRIVER: 'Their runs and delivery sheets.',
  VIEWER: 'Read only. Safe account to hand an auditor.',
};

/**
 * Every permission a role can be given in Set Up → Roles, grouped the way
 * the app is, with what it lets someone do. Timesheets aren't here: who
 * fills one in is chosen per person, not by role.
 */
export const PERMISSION_GROUPS: { label: string; perms: { key: Permission; label: string }[] }[] = [
  { label: 'Sales orders', perms: [
    { key: 'orders.view', label: 'See orders' },
    { key: 'orders.create', label: 'Create orders' },
    { key: 'orders.edit', label: 'Edit orders' },
    { key: 'orders.approve', label: 'Approve orders and override credit limits' },
    { key: 'orders.progress', label: 'Move orders through production and delivery' },
    { key: 'orders.archive', label: 'Archive orders' },
    { key: 'orders.markPaid', label: 'Mark orders paid' },
    { key: 'orders.export', label: 'Export orders' },
  ] },
  { label: 'Customers', perms: [
    { key: 'customers.view', label: 'See customers' },
    { key: 'customers.edit', label: 'Add and edit customers' },
    { key: 'customers.credit', label: 'Set credit limits and payment terms' },
  ] },
  { label: 'Stock', perms: [
    { key: 'stock.view', label: 'See stock' },
    { key: 'stock.goodsIn', label: 'Book goods in' },
    { key: 'stock.pick', label: 'Pick stock for orders' },
    { key: 'stock.adjust', label: 'Write off and correct stock' },
    { key: 'barCounter.view', label: 'Use the Bar Counter' },
  ] },
  { label: 'Production', perms: [
    { key: 'production.view', label: 'See production' },
    { key: 'production.progress', label: 'Start jobs and log tally sheets' },
    { key: 'production.qc', label: 'Record dimensional checks' },
    { key: 'production.assign', label: 'Post other work for people to do' },
    { key: 'production.editHistory', label: 'Edit finished BCS production jobs' },
  ] },
  { label: 'Compliance', perms: [
    { key: 'compliance.view', label: 'See compliance' },
    { key: 'compliance.edit', label: 'Certificates, suppliers and returns' },
    { key: 'compliance.ncr', label: 'Raise and close NCRs' },
    { key: 'compliance.fcpCosh', label: 'Upload FCP data and COSHH sheets' },
  ] },
  { label: 'Purchase orders', perms: [
    { key: 'purchaseOrders.view', label: 'See purchase orders' },
    { key: 'purchaseOrders.create', label: 'Raise purchase orders' },
    { key: 'purchaseOrders.edit', label: 'Edit purchase orders' },
  ] },
  { label: 'Deliveries', perms: [
    { key: 'planning.view', label: 'See deliveries' },
    { key: 'planning.edit', label: 'Add deliveries and assign drivers' },
  ] },
  { label: 'Vehicles and machines', perms: [
    { key: 'assets.view', label: 'See assets' },
    { key: 'assets.edit', label: 'Add and edit assets' },
    { key: 'checks.view', label: 'See morning checks' },
    { key: 'checks.create', label: 'Do morning checks' },
    { key: 'fuel.view', label: 'See the fuel log' },
    { key: 'fuel.create', label: 'Log fuel' },
    { key: 'fuel.history', label: 'See fuel use month to month' },
  ] },
  { label: 'People', perms: [
    { key: 'holidays.view', label: 'Request and see holidays' },
    { key: 'timesheets.viewAll', label: "See everyone's timesheets" },
  ] },
  { label: 'Health & Safety', perms: [
    { key: 'hs.view', label: 'See H&S and do training' },
    { key: 'hs.edit', label: 'Upload and archive H&S documents' },
    { key: 'hs.manageTraining', label: 'Write training and assign machine training' },
  ] },
  { label: 'Accounts', perms: [
    { key: 'accounts.view', label: 'See the accounts — trial balance, journals, nominal' },
    { key: 'accounts.post', label: 'Post and reverse journals' },
    { key: 'accounts.setup', label: 'Chart of accounts, VAT codes, periods and numbering' },
    { key: 'finance.costs', label: 'See purchase costs and margins' },
    { key: 'finance.debtors', label: 'See debtors and credit used' },
  ] },
  { label: 'Sales outreach', perms: [
    { key: 'outreach.view', label: 'See sales outreach' },
    { key: 'outreach.manage', label: 'Approve outreach emails and send them' },
  ] },
  { label: 'Set Up', perms: [
    { key: 'setup.view', label: 'Open Set Up' },
    { key: 'setup.pricing', label: 'Set prices' },
    { key: 'setup.users', label: 'Manage people and their access' },
    { key: 'setup.lists', label: 'Edit lists — drivers, towns, locations, checklist' },
    { key: 'setup.backups', label: 'Backups and system' },
    { key: 'setup.bugs', label: 'Read bug reports' },
  ] },
];

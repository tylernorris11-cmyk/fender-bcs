'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import type { Company, Role } from '@prisma/client';
import { assertPermission, hashPassword, logActivity, notifyMasterAdmins, passwordProblem, requireUser } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { initialsOf, shortDate } from '@/lib/format';
import { sendEmail } from '@/lib/email';
import { GRANTABLE_EXTRA_PERMISSIONS, ROLE_LABELS, TOGGLEABLE_MODULES } from '@/lib/rbac';

/** MASTER_ADMIN and ADMIN both carry the full permission set (ALL) — company scope is the only difference. */
const isHighPrivilege = (role: Role) => role === 'MASTER_ADMIN' || role === 'ADMIN';

// ------------------------------------------------------------- pricing

export async function setPrice(formData: FormData) {
  const user = await assertPermission('setup.pricing');
  const productId = String(formData.get('productId'));
  const unitPrice = Number(formData.get('unitPrice'));
  const minQty = Number(formData.get('minQty') ?? 0);
  if (!(unitPrice >= 0)) throw new Error('Enter a price.');

  await db.price.create({
    data: { productId, unitPrice, minQty, effectiveFrom: new Date(), setByName: user.name },
  });
  await logActivity('Product', productId, 'Price set', `£${unitPrice.toFixed(2)}${minQty ? ` from ${minQty}` : ''}`, user.id);
  revalidatePath('/setup/pricing');
  revalidatePath('/setup');
}

// --------------------------------------------------------------- users

const ALL_COMPANIES: Company[] = ['FENDER', 'BS_SUPPLIES'];

/**
 * A company-scoped Administrator can only reach people who already share a
 * company with them — a BS Supplies admin has no business touching a
 * Fender-only account, even by guessing a userId in a form post.
 */
function assertCanManage(admin: { role: Role; companies: Company[] }, target: { role: Role; companies: Company[] }) {
  if (admin.role === 'MASTER_ADMIN') return;
  if (target.role === 'MASTER_ADMIN') throw new Error('Only a Master Administrator can manage that account.');
  if (!target.companies.some((c) => admin.companies.includes(c))) {
    throw new Error('You can only manage people within your own company.');
  }
}

/** Master Administrator always has every company; Administrator always has exactly one. */
function assertCompaniesForRole(role: Role, companies: Company[]) {
  if (role === 'MASTER_ADMIN' && companies.length !== ALL_COMPANIES.length) {
    throw new Error('Master Administrators always have access to every company.');
  }
  if (role === 'ADMIN' && companies.length > 1) {
    throw new Error('Administrators can only have access to one company. Promote them to Master Administrator for both.');
  }
}

export type CreateUserResult = { ok: true; message: string } | { ok: false; error: string };

/** Returns problems (weak password, email already used…) instead of throwing —
 * a thrown error reaches people in production as nothing but a reference
 * code, which is no use to someone just trying to add an account. */
export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const admin = await assertPermission('setup.users');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role')) as Role;

  if (!email || !name) return { ok: false, error: 'Name and email are both needed.' };
  if (!(role in ROLE_LABELS)) return { ok: false, error: 'Choose a role for them.' };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: `Starting password: ${problem}` };
  if (await db.user.findUnique({ where: { email } })) return { ok: false, error: 'There is already an account on that email.' };
  if (role === 'MASTER_ADMIN' && admin.role !== 'MASTER_ADMIN') {
    return { ok: false, error: 'Only a Master Administrator can grant that role.' };
  }

  const companies = role === 'MASTER_ADMIN' ? ALL_COMPANIES : [getActiveCompany(admin)];

  const created = await db.user.create({
    data: {
      email, name, role, companies,
      jobTitle: String(formData.get('jobTitle') ?? ''),
      passwordHash: hashPassword(password),
      initials: initialsOf(name),
      colour: String(formData.get('colour') ?? '#16A085'),
      mustReset: true,
    },
  });
  await logActivity('User', created.id, 'Account created', `${name} as ${role}`, admin.id);
  if (isHighPrivilege(role)) {
    await notifyMasterAdmins({
      subject: `New ${ROLE_LABELS[role]} account created`,
      text: `${admin.name} just created a new ${ROLE_LABELS[role]} account for ${name} (${email}). If that wasn't expected, check Set Up → Users.`,
      path: '/setup/users',
    });
  }
  revalidatePath('/setup/users');
  return { ok: true, message: `Account created for ${name}. They'll be asked to change the password when they first sign in.` };
}

export async function updateUserRole(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const role = String(formData.get('role')) as Role;
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);

  if (role === 'MASTER_ADMIN' && admin.role !== 'MASTER_ADMIN') {
    throw new Error('Only a Master Administrator can grant that role.');
  }
  // A Master Administrator always has every company, so promoting someone
  // grants both in the same step — checking their current single company
  // first would make promoting a company-scoped Administrator impossible.
  const companies = role === 'MASTER_ADMIN' ? ALL_COMPANIES : target.companies;
  assertCompaniesForRole(role, companies);

  // Never let the last Master Administrator demote themselves out of the system.
  if (target.role === 'MASTER_ADMIN' && role !== 'MASTER_ADMIN') {
    const masters = await db.user.count({ where: { role: 'MASTER_ADMIN', active: true } });
    if (masters <= 1) throw new Error('This is the last Master Administrator. Give someone else that role first.');
  }

  await db.user.update({ where: { id: userId }, data: { role, companies } });
  await logActivity('User', userId, 'Role changed', role, admin.id);
  if (isHighPrivilege(role) && target.role !== role) {
    const article = role === 'ADMIN' ? 'an' : 'a';
    await notifyMasterAdmins({
      subject: `${target.name} was made ${article} ${ROLE_LABELS[role]}`,
      text: `${admin.name} changed ${target.name}'s role from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[role]}. If that wasn't expected, check Set Up → Users.`,
      path: '/setup/users',
    });
  }
  revalidatePath('/setup/users');
}

export async function updateUserCompanies(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const companies = formData.getAll('companies').map(String) as Company[];
  if (companies.length === 0) throw new Error('Give them access to at least one company.');

  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);
  if (admin.role !== 'MASTER_ADMIN' && companies.some((c) => !admin.companies.includes(c))) {
    throw new Error('You can only grant access to companies you belong to yourself.');
  }
  assertCompaniesForRole(target.role, companies);

  await db.user.update({ where: { id: userId }, data: { companies } });
  await logActivity('User', userId, 'Company access changed', companies.join(', '), admin.id);
  revalidatePath('/setup/users');
}

export async function toggleUserActive(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);

  if (target.active && target.role === 'MASTER_ADMIN') {
    const masters = await db.user.count({ where: { role: 'MASTER_ADMIN', active: true } });
    if (masters <= 1) throw new Error('This is the last active Master Administrator. Promote someone else first.');
  }

  await db.user.update({ where: { id: userId }, data: { active: !target.active } });
  await logActivity('User', userId, target.active ? 'Account suspended' : 'Account reactivated', '', admin.id);
  revalidatePath('/setup/users');
}

export async function updateHolidayAllowance(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const days = Number(formData.get('holidayAllowanceDays'));
  if (!Number.isInteger(days) || days < 0) throw new Error('Enter a whole number of days.');
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);

  const bankHolidaysComeOff = formData.get('bankHolidaysComeOff') === 'on';

  await db.user.update({ where: { id: userId }, data: { holidayAllowanceDays: days, bankHolidaysComeOff } });
  await logActivity('User', userId, 'Holiday allowance changed', `${days} days a year${bankHolidaysComeOff ? '' : ', bank holidays not taken off'}`, admin.id);
  revalidatePath('/setup/users');
  revalidatePath('/holidays');
}

/**
 * The checkboxes on screen are "can see" (positive, easier to read at a
 * glance) — this inverts that into the "hiddenModules" blocklist can()
 * actually checks, so unchecking a box removes access everywhere at once:
 * the home screen, every menu, and the page itself if they type the URL in.
 *
 * One "Save all" button covers the whole table rather than a Save per row —
 * every row's checkboxes live in the same form, keyed by userId, and a
 * hidden "userIds" input per row (independent of any checkbox state) is
 * what tells this which people were on screen to save at all.
 */
export async function updateAllHiddenModules(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userIds = formData.getAll('userIds').map(String);
  const targets = await db.user.findMany({ where: { id: { in: userIds } } });

  const changes = targets.map((target) => {
    assertCanManage(admin, target);
    if (target.role === 'MASTER_ADMIN') throw new Error('A Master Administrator can always see everything — nothing to hide.');
    const visible = new Set(formData.getAll(`visible_${target.id}`).map(String));
    const hiddenModules = TOGGLEABLE_MODULES.map((m) => m.key).filter((key) => !visible.has(key));
    return { target, hiddenModules };
  });

  await db.$transaction(changes.map(({ target, hiddenModules }) =>
    db.user.update({ where: { id: target.id }, data: { hiddenModules } }),
  ));

  for (const { target, hiddenModules } of changes) {
    await logActivity('User', target.id, 'Visibility changed', hiddenModules.length ? `Hidden: ${hiddenModules.join(', ')}` : 'Everything visible', admin.id);
  }
  revalidatePath('/setup/users');
}

/** Same shape as updateAllHiddenModules, for the narrow extra permissions in
 * GRANTABLE_EXTRA_PERMISSIONS — grants a specific person one capability
 * their role doesn't already carry, without changing their role. */
export async function updateExtraPermissions(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userIds = formData.getAll('userIds').map(String);
  const targets = await db.user.findMany({ where: { id: { in: userIds } } });

  const changes = targets.map((target) => {
    assertCanManage(admin, target);
    const extraPermissions = GRANTABLE_EXTRA_PERMISSIONS
      .map((p) => p.key)
      .filter((key) => formData.getAll(`extra_${target.id}`).map(String).includes(key));
    return { target, extraPermissions };
  });

  await db.$transaction(changes.map(({ target, extraPermissions }) =>
    db.user.update({ where: { id: target.id }, data: { extraPermissions } }),
  ));

  for (const { target, extraPermissions } of changes) {
    await logActivity('User', target.id, 'Extra access changed', extraPermissions.length ? extraPermissions.join(', ') : 'None', admin.id);
  }
  revalidatePath('/setup/users');
}

export async function resetPassword(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const password = String(formData.get('password') ?? '');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);

  await db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password), mustReset: true } });
  await logActivity('User', userId, 'Password reset', 'Reset by an administrator', admin.id);
  revalidatePath('/setup/users');
}

/** Anyone can change their own password from Account. */
export async function changeOwnPassword(formData: FormData) {
  const { getCurrentUser, verifyPassword } = await import('@/lib/auth');
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in again.');

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!verifyPassword(String(formData.get('current') ?? ''), record.passwordHash)) {
    throw new Error('Your current password is not right.');
  }
  const next = String(formData.get('next') ?? '');
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);

  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next), mustReset: false } });
  revalidatePath('/account');
}

// --------------------------------------------------------------- lists

export async function addTown(formData: FormData) {
  await assertPermission('setup.lists');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await db.town.upsert({ where: { name }, update: { active: true }, create: { name, region: String(formData.get('region') ?? '') } });
  revalidatePath('/setup/towns');
}

export async function toggleTown(formData: FormData) {
  await assertPermission('setup.lists');
  const id = String(formData.get('townId'));
  const town = await db.town.findUniqueOrThrow({ where: { id } });
  await db.town.update({ where: { id }, data: { active: !town.active } });
  revalidatePath('/setup/towns');
}

/** Exchequer location codes: up to 3 letters and numbers, e.g. SCU. */
async function checkedLocationCode(raw: FormDataEntryValue | null, exceptId?: string) {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z0-9]{1,3}$/.test(code)) throw new Error('Location codes are up to 3 letters and numbers, like SCU.');
  const clash = await db.location.findFirst({ where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw new Error(`${code} is already the code for ${clash.name}.`);
  return code;
}

export async function addLocation(formData: FormData) {
  await assertPermission('setup.lists');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const existing = await db.location.findUnique({ where: { name } });
  const code = await checkedLocationCode(formData.get('code'), existing?.id);
  await db.location.upsert({
    where: { name },
    update: { active: true, ...(code ? { code } : {}) },
    create: { name, code },
  });
  revalidatePath('/setup/locations');
}

export async function setLocationCode(formData: FormData) {
  await assertPermission('setup.lists');
  const id = String(formData.get('locationId'));
  await db.location.update({ where: { id }, data: { code: await checkedLocationCode(formData.get('code'), id) } });
  revalidatePath('/setup/locations');
}

export async function toggleLocation(formData: FormData) {
  await assertPermission('setup.lists');
  const id = String(formData.get('locationId'));
  const location = await db.location.findUniqueOrThrow({ where: { id } });
  await db.location.update({ where: { id }, data: { active: !location.active } });
  revalidatePath('/setup/locations');
}

export async function addCostCentre(formData: FormData) {
  const user = await assertPermission('setup.lists');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const company = getActiveCompany(user);
  await db.costCentre.upsert({
    where: { company_name: { company, name } },
    update: { active: true },
    create: { company, name },
  });
  revalidatePath('/setup/cost-centres');
}

export async function toggleCostCentre(formData: FormData) {
  await assertPermission('setup.lists');
  const id = String(formData.get('costCentreId'));
  const costCentre = await db.costCentre.findUniqueOrThrow({ where: { id } });
  await db.costCentre.update({ where: { id }, data: { active: !costCentre.active } });
  revalidatePath('/setup/cost-centres');
}

export async function addDriver(formData: FormData) {
  await assertPermission('setup.lists');
  await db.driver.create({
    data: {
      name: String(formData.get('name') ?? '').trim(),
      licence: String(formData.get('licence') ?? ''),
      cpcExpiry: formData.get('cpcExpiry') ? new Date(String(formData.get('cpcExpiry'))) : null,
    },
  });
  revalidatePath('/setup/drivers');
}

/** Puts an existing person on the Drivers register, the same way
 * ensureDriverRecords does automatically for anyone given the Driver
 * role — for someone who occasionally runs a delivery without actually
 * being a driver by role. Licence/CPC expiry start blank, same as an
 * auto-created one, and show the same "not on file yet" prompt until
 * someone fills them in. */
export async function addUserAsDriver(formData: FormData) {
  await assertPermission('setup.lists');
  const userId = String(formData.get('userId') ?? '');
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, active: true, driver: true } });
  if (!user.active) throw new Error('That account is suspended.');
  if (user.driver) throw new Error(`${user.name} is already on the Drivers register.`);

  await db.driver.create({ data: { name: user.name, userId: user.id } });
  revalidatePath('/setup/drivers');
}

/** Removes a driver from the register entirely — not a suspend, since a
 * driver isn't a login. One tied to a User with the Driver role reappears
 * next visit (ensureDriverRecords syncs that automatically); this is for
 * a manually-added one, or a user-linked one no longer wanted on it. */
export async function removeDriver(formData: FormData) {
  await assertPermission('setup.lists');
  const id = String(formData.get('driverId') ?? '');
  await db.driver.delete({ where: { id } });
  revalidatePath('/setup/drivers');
}

function parseCpcExpiry(formData: FormData): Date {
  const raw = String(formData.get('cpcExpiry') ?? '').trim();
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error('Enter a valid date.');
  return date;
}

/** An admin setting or changing any driver's CPC expiry from the register itself. */
export async function updateDriverCpcExpiry(formData: FormData) {
  const admin = await assertPermission('setup.lists');
  const driverId = String(formData.get('driverId') ?? '');
  const cpcExpiry = parseCpcExpiry(formData);
  await db.driver.update({ where: { id: driverId }, data: { cpcExpiry } });
  await logActivity('Driver', driverId, 'CPC expiry set', shortDate(cpcExpiry), admin.id);
  revalidatePath('/setup/drivers');
}

/** A driver setting their own CPC expiry, from the pop-up prompt (see
 * DriverCpcReminder) rather than the admin register — needs no setup.lists
 * permission, just a driver record of their own to set it on. */
export async function setOwnDriverCpcExpiry(formData: FormData) {
  const user = await requireUser();
  const driver = await db.driver.findUnique({ where: { userId: user.id } });
  if (!driver) throw new Error('You are not on the Drivers register.');
  const cpcExpiry = parseCpcExpiry(formData);
  await db.driver.update({ where: { id: driver.id }, data: { cpcExpiry } });
  await logActivity('Driver', driver.id, 'CPC expiry set', `${shortDate(cpcExpiry)} — set by themselves`, user.id);
  revalidatePath('/setup/drivers');
}

export async function addChecklistTemplate(formData: FormData) {
  const user = await assertPermission('setup.lists');
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;
  const company = getActiveCompany(user);
  const count = await db.checklistTemplate.count({ where: { company } });
  await db.checklistTemplate.create({ data: { label, company, sortOrder: count } });
  revalidatePath('/setup/checklist');
}

export async function removeChecklistTemplate(formData: FormData) {
  const user = await assertPermission('setup.lists');
  const id = String(formData.get('templateId'));
  const existing = await db.checklistTemplate.findUniqueOrThrow({ where: { id }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  await db.checklistTemplate.delete({ where: { id } });
  revalidatePath('/setup/checklist');
}

// ------------------------------------------------------ access requests

export async function approveAccessRequest(formData: FormData) {
  const admin = await assertPermission('setup.users');
  if (admin.role !== 'MASTER_ADMIN') throw new Error('Only a Master Administrator can approve access requests.');

  const id = String(formData.get('requestId'));
  const role = String(formData.get('role')) as Role;
  const companies = formData.getAll('companies').map(String) as Company[];
  if (companies.length === 0) throw new Error('Give them access to at least one company.');
  assertCompaniesForRole(role, companies);

  const request = await db.accessRequest.findUniqueOrThrow({ where: { id } });
  if (request.status !== 'PENDING') throw new Error('This request has already been decided.');
  if (await db.user.findUnique({ where: { email: request.email } })) {
    throw new Error('An account with that email already exists.');
  }

  await db.user.create({
    data: {
      email: request.email, name: request.name, role, companies,
      jobTitle: request.jobTitle,
      passwordHash: request.passwordHash,
      initials: initialsOf(request.name),
      colour: '#16A085',
      mustReset: false, // they chose this password themselves when they asked for access
    },
  });
  await db.accessRequest.update({
    where: { id }, data: { status: 'APPROVED', decidedAt: new Date(), decidedById: admin.id },
  });
  await logActivity('AccessRequest', id, 'Approved', `${request.email} as ${role}`, admin.id);
  if (isHighPrivilege(role)) {
    await notifyMasterAdmins({
      subject: `New ${ROLE_LABELS[role]} account approved`,
      text: `${admin.name} approved an access request for ${request.name} (${request.email}) as ${ROLE_LABELS[role]}. If that wasn't expected, check Set Up → Users.`,
      path: '/setup/users',
    });
  }

  const h = headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  await sendEmail({
    to: request.email,
    subject: 'Your Fender BCS access has been approved',
    text: `Hi ${request.name},\n\nYou're in — sign in at ${origin}/login with the email and password you gave when you asked for access.\n\n— Fender BCS`,
  });

  revalidatePath('/setup/access-requests');
  revalidatePath('/setup/users');
}

export async function rejectAccessRequest(formData: FormData) {
  const admin = await assertPermission('setup.users');
  if (admin.role !== 'MASTER_ADMIN') throw new Error('Only a Master Administrator can decide access requests.');

  const id = String(formData.get('requestId'));
  const note = String(formData.get('note') ?? '').trim();

  const request = await db.accessRequest.findUniqueOrThrow({ where: { id } });
  if (request.status !== 'PENDING') throw new Error('This request has already been decided.');

  await db.accessRequest.update({
    where: { id }, data: { status: 'REJECTED', decidedAt: new Date(), decidedById: admin.id, note },
  });
  await logActivity('AccessRequest', id, 'Rejected', note.slice(0, 120), admin.id);

  await sendEmail({
    to: request.email,
    subject: 'Your Fender BCS access request',
    text: `Hi ${request.name},\n\nYour request for access wasn't approved${note ? `: ${note}` : '.'}\n\nIf you think this is a mistake, contact Lee or Tyler.\n\n— Fender BCS`,
  });

  revalidatePath('/setup/access-requests');
}

'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import type { Company, Role } from '@prisma/client';
import { assertPermission, hashPassword, logActivity, passwordProblem } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { initialsOf } from '@/lib/format';
import { sendEmail } from '@/lib/email';
import { TOGGLEABLE_MODULES } from '@/lib/rbac';

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

export async function createUser(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role')) as Role;

  if (!email || !name) throw new Error('Name and email are both needed.');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if (await db.user.findUnique({ where: { email } })) throw new Error('There is already an account on that email.');
  if (role === 'MASTER_ADMIN' && admin.role !== 'MASTER_ADMIN') {
    throw new Error('Only a Master Administrator can grant that role.');
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
  revalidatePath('/setup/users');
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
  assertCompaniesForRole(role, target.companies);

  // Never let the last Master Administrator demote themselves out of the system.
  if (target.role === 'MASTER_ADMIN' && role !== 'MASTER_ADMIN') {
    const masters = await db.user.count({ where: { role: 'MASTER_ADMIN', active: true } });
    if (masters <= 1) throw new Error('This is the last Master Administrator. Give someone else that role first.');
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await logActivity('User', userId, 'Role changed', role, admin.id);
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

  await db.user.update({ where: { id: userId }, data: { holidayAllowanceDays: days } });
  await logActivity('User', userId, 'Holiday allowance changed', `${days} days a year`, admin.id);
  revalidatePath('/setup/users');
  revalidatePath('/holidays');
}

/**
 * The checkboxes on screen are "can see" (positive, easier to read at a
 * glance) — this inverts that into the "hiddenModules" blocklist can()
 * actually checks, so unchecking a box removes access everywhere at once:
 * the home screen, every menu, and the page itself if they type the URL in.
 */
export async function updateHiddenModules(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assertCanManage(admin, target);
  if (target.role === 'MASTER_ADMIN') throw new Error('A Master Administrator can always see everything — nothing to hide.');

  const visible = new Set(formData.getAll('visible').map(String));
  const hiddenModules = TOGGLEABLE_MODULES.map((m) => m.key).filter((key) => !visible.has(key));

  await db.user.update({ where: { id: userId }, data: { hiddenModules } });
  await logActivity('User', userId, 'Visibility changed', hiddenModules.length ? `Hidden: ${hiddenModules.join(', ')}` : 'Everything visible', admin.id);
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

export async function addLocation(formData: FormData) {
  await assertPermission('setup.lists');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await db.location.upsert({ where: { name }, update: { active: true }, create: { name } });
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
      phone: String(formData.get('phone') ?? ''),
      licence: String(formData.get('licence') ?? ''),
      depot: String(formData.get('depot') ?? 'Scunthorpe'),
      cpcExpiry: formData.get('cpcExpiry') ? new Date(String(formData.get('cpcExpiry'))) : null,
    },
  });
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

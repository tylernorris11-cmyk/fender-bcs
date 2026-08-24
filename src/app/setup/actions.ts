'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import type { Company, Role } from '@prisma/client';
import { assertPermission, hashPassword, logActivity, passwordProblem } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { initialsOf } from '@/lib/format';

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

  const created = await db.user.create({
    data: {
      email, name, role,
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

  // Never let the last administrator demote themselves out of the system.
  if (role !== 'ADMIN') {
    const admins = await db.user.count({ where: { role: 'ADMIN', active: true } });
    const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role === 'ADMIN' && admins <= 1) {
      throw new Error('This is the last administrator. Give someone else admin first.');
    }
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

  await db.user.update({ where: { id: userId }, data: { companies } });
  await logActivity('User', userId, 'Company access changed', companies.join(', '), admin.id);
  revalidatePath('/setup/users');
}

export async function toggleUserActive(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });

  if (target.active && target.role === 'ADMIN') {
    const admins = await db.user.count({ where: { role: 'ADMIN', active: true } });
    if (admins <= 1) throw new Error('This is the last active administrator. Promote someone else first.');
  }

  await db.user.update({ where: { id: userId }, data: { active: !target.active } });
  await logActivity('User', userId, target.active ? 'Account suspended' : 'Account reactivated', '', admin.id);
  revalidatePath('/setup/users');
}

export async function resetPassword(formData: FormData) {
  const admin = await assertPermission('setup.users');
  const userId = String(formData.get('userId'));
  const password = String(formData.get('password') ?? '');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

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

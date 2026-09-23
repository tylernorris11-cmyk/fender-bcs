'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Company } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { can, type SessionUser } from '@/lib/rbac';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { readAccountCode, suggestAccountCode } from '@/lib/accountCodes';
import { checkedNominalCodeId, checkedVatCodeId } from '@/lib/ledger';

function readForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    contactName: String(formData.get('contactName') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim() || 'United Kingdom',
    notes: String(formData.get('notes') ?? ''),
  };
}

/** The code typed in, or Exchequer's usual suggestion from the name. Name and code each have to be unique within the company. */
async function checkedIdentity(formData: FormData, company: Company, name: string, exceptId?: string) {
  const others = exceptId ? { id: { not: exceptId } } : {};
  if (await db.supplier.findFirst({ where: { company, name: { equals: name, mode: 'insensitive' }, ...others }, select: { id: true } })) {
    throw new Error(`There's already a supplier called ${name}.`);
  }
  const isTaken = async (code: string) => !!(await db.supplier.findFirst({ where: { company, code, ...others }, select: { id: true } }));
  const typed = readAccountCode(formData.get('code'));
  if (!typed) return suggestAccountCode(name, isTaken);
  if (await isTaken(typed)) throw new Error(`Account code ${typed} is already used by another supplier.`);
  return typed;
}

/** Default VAT and purchases nominal codes — only an accounts admin sets these. */
async function ledgerDefaults(formData: FormData, user: SessionUser, company: Company) {
  if (!can(user, 'accounts.setup')) return {};
  return {
    vatCodeId: await checkedVatCodeId(formData.get('vatCodeId'), company),
    nominalCodeId: await checkedNominalCodeId(formData.get('nominalCodeId'), company),
  };
}

export async function createSupplier(formData: FormData) {
  const user = await assertPermission('purchaseOrders.edit');
  const company = getActiveCompany(user);
  const data = readForm(formData);
  if (!data.name) throw new Error('The supplier needs a name.');
  const code = await checkedIdentity(formData, company, data.name);

  const supplier = await db.supplier.create({
    data: { ...data, ...(await ledgerDefaults(formData, user, company)), code, company },
  });
  await logActivity('Supplier', supplier.id, 'Account opened', `${code} ${data.name}`, user.id);
  revalidatePath('/purchase-orders/suppliers');
  redirect('/purchase-orders/suppliers');
}

export async function updateSupplier(formData: FormData) {
  const user = await assertPermission('purchaseOrders.edit');
  const id = String(formData.get('supplierId'));
  const existing = await db.supplier.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, existing.company);
  const data = readForm(formData);
  if (!data.name) throw new Error('The supplier needs a name.');
  const code = await checkedIdentity(formData, existing.company, data.name, id);

  await db.supplier.update({
    where: { id },
    data: { ...data, ...(await ledgerDefaults(formData, user, existing.company)), code },
  });
  await logActivity('Supplier', id, 'Details updated', `${code} ${data.name}`, user.id);
  revalidatePath('/purchase-orders/suppliers');
  redirect('/purchase-orders/suppliers');
}

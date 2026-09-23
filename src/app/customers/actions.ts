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

/** The code typed in, or Exchequer's usual suggestion from the name — refused if another account in the company has it. */
async function accountCodeFor(formData: FormData, company: Company, name: string, exceptId?: string) {
  const isTaken = async (code: string) =>
    !!(await db.customer.findFirst({ where: { company, code, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }));
  const typed = readAccountCode(formData.get('code'));
  if (!typed) return suggestAccountCode(name, isTaken);
  if (await isTaken(typed)) throw new Error(`Account code ${typed} is already used by another customer.`);
  return typed;
}

/** Default VAT and sales nominal codes — only an accounts admin sets these. */
async function ledgerDefaults(formData: FormData, user: SessionUser, company: Company) {
  if (!can(user, 'accounts.setup')) return {};
  return {
    vatCodeId: await checkedVatCodeId(formData.get('vatCodeId'), company),
    nominalCodeId: await checkedNominalCodeId(formData.get('nominalCodeId'), company),
  };
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    contactName: String(formData.get('contactName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    town: String(formData.get('town') ?? ''),
    postcode: String(formData.get('postcode') ?? ''),
    paymentTerms: String(formData.get('paymentTerms') ?? '30 days end of month'),
    status: String(formData.get('status') ?? 'Active'),
    accountManagerId: String(formData.get('accountManagerId') ?? '') || null,
    notes: String(formData.get('notes') ?? ''),
  };
}

export async function createCustomer(formData: FormData) {
  const user = await assertPermission('customers.edit');
  const data = readForm(formData);
  if (!data.name) throw new Error('The account needs a name.');

  // Only someone with customers.credit sets the limit; everyone else opens the
  // account on nothing and a director sets the number.
  const creditLimit = can(user, 'customers.credit') ? Number(formData.get('creditLimit') ?? 0) : 0;
  const company = getActiveCompany(user);
  const code = await accountCodeFor(formData, company, data.name);

  const customer = await db.customer.create({
    data: { ...data, ...(await ledgerDefaults(formData, user, company)), code, creditLimit, company },
  });
  await logActivity('Customer', customer.id, 'Account opened', `${code} ${data.name}`, user.id);
  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(formData: FormData) {
  const user = await assertPermission('customers.edit');
  const id = String(formData.get('customerId'));
  const existing = await db.customer.findUniqueOrThrow({ where: { id }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  const data = readForm(formData);
  if (!data.name) throw new Error('The account needs a name.');

  const patch: Record<string, unknown> = {
    ...data,
    ...(await ledgerDefaults(formData, user, existing.company)),
    code: await accountCodeFor(formData, existing.company, data.name, id),
  };
  if (can(user, 'customers.credit')) {
    patch.creditLimit = Number(formData.get('creditLimit') ?? 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.customer.update({ where: { id }, data: patch as any });
  await logActivity('Customer', id, 'Details updated', '', user.id);
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

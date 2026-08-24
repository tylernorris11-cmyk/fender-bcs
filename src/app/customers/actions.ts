'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';

async function nextCustomerCode() {
  const last = await db.customer.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
  const seq = last ? Number(last.code.split('-')[1]) + 1 : 1;
  return `CUST-${String(seq).padStart(4, '0')}`;
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

  const customer = await db.customer.create({
    data: { ...data, code: await nextCustomerCode(), creditLimit, company: getActiveCompany(user) },
  });
  await logActivity('Customer', customer.id, 'Account opened', data.name, user.id);
  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(formData: FormData) {
  const user = await assertPermission('customers.edit');
  const id = String(formData.get('customerId'));
  const existing = await db.customer.findUniqueOrThrow({ where: { id }, select: { company: true } });
  assertCompanyAccess(user, existing.company);
  const data = readForm(formData);

  const patch: Record<string, unknown> = { ...data };
  if (can(user, 'customers.credit')) {
    patch.creditLimit = Number(formData.get('creditLimit') ?? 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.customer.update({ where: { id }, data: patch as any });
  await logActivity('Customer', id, 'Details updated', '', user.id);
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

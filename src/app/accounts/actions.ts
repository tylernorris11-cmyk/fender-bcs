'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { NominalType, TransactionType } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { formatRef, postTransaction, reverseTransaction } from '@/lib/ledger';

const NOMINAL_TYPES: NominalType[] = ['PROFIT_AND_LOSS', 'BALANCE_SHEET'];
const DOC_TYPES: TransactionType[] = ['NOM'];

function parseDate(raw: FormDataEntryValue | null): Date {
  const value = String(raw ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a date.');
  return new Date(value); // a bare yyyy-mm-dd parses as UTC midnight, which is how plain dates are stored
}

// ---------------------------------------------------------- chart of accounts

export async function addNominalCode(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const company = getActiveCompany(user);
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '') as NominalType;
  if (!code || !name) throw new Error('Give the nominal code a number and a name.');
  if (code.length > 20) throw new Error('Nominal codes are 20 characters at most.');
  if (!NOMINAL_TYPES.includes(type)) throw new Error('Choose profit and loss or balance sheet.');

  const clash = await db.nominalCode.findUnique({ where: { company_code: { company, code } } });
  if (clash) throw new Error(`${code} is already in the chart of accounts as ${clash.name}.`);

  const created = await db.nominalCode.create({ data: { company, code, name, type } });
  await logActivity('NominalCode', created.id, 'Added', `${code} ${name}`, user.id);
  revalidatePath('/accounts/nominal');
}

export async function toggleNominalCode(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const id = String(formData.get('nominalCodeId'));
  const code = await db.nominalCode.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, code.company);
  await db.nominalCode.update({ where: { id }, data: { active: !code.active } });
  await logActivity('NominalCode', id, code.active ? 'Retired' : 'Brought back into use', `${code.code} ${code.name}`, user.id);
  revalidatePath('/accounts/nominal');
}

// ---------------------------------------------------------------- VAT codes

export async function addVatCode(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const company = getActiveCompany(user);
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const rate = Number(formData.get('rate'));
  if (!code || !name) throw new Error('Give the VAT code a letter and a name.');
  if (code.length > 3) throw new Error('VAT codes are 3 characters at most. Exchequer uses a single letter or number.');
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Enter the rate as a percentage between 0 and 100.');

  const clash = await db.vatCode.findUnique({ where: { company_code: { company, code } } });
  if (clash) throw new Error(`VAT code ${code} already exists as ${clash.name}.`);

  const created = await db.vatCode.create({ data: { company, code, name, rate } });
  await logActivity('VatCode', created.id, 'Added', `${code} ${name} ${rate}%`, user.id);
  revalidatePath('/accounts/vat-codes');
}

export async function toggleVatCode(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const id = String(formData.get('vatCodeId'));
  const vat = await db.vatCode.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, vat.company);
  await db.vatCode.update({ where: { id }, data: { active: !vat.active } });
  await logActivity('VatCode', id, vat.active ? 'Retired' : 'Brought back into use', `${vat.code} ${vat.name}`, user.id);
  revalidatePath('/accounts/vat-codes');
}

// ------------------------------------------------------------------ settings

export async function saveYearStart(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const company = getActiveCompany(user);
  const yearStartMonth = Number(formData.get('yearStartMonth'));
  if (!Number.isInteger(yearStartMonth) || yearStartMonth < 1 || yearStartMonth > 12) throw new Error('Choose a month.');

  // Every posted transaction already has its year and period worked out from
  // the old start month — changing it underneath them would scramble every report.
  if (await db.transaction.count({ where: { company } })) {
    throw new Error("The financial year start can't change once anything has been posted.");
  }

  await db.accountsSettings.upsert({ where: { company }, create: { company, yearStartMonth }, update: { yearStartMonth } });
  await logActivity('AccountsSettings', company, 'Financial year start set', `Month ${yearStartMonth}`, user.id);
  revalidatePath('/accounts', 'layout');
}

export async function saveLock(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const company = getActiveCompany(user);
  const raw = String(formData.get('lock') ?? '');

  let lockedYear: number | null = null;
  let lockedPeriod: number | null = null;
  if (raw) {
    const [y, p] = raw.split('-').map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(p) || p < 1 || p > 12) throw new Error('Choose a period to lock up to.');
    lockedYear = y;
    lockedPeriod = p;
  }

  await db.accountsSettings.upsert({
    where: { company },
    create: { company, lockedYear, lockedPeriod },
    update: { lockedYear, lockedPeriod },
  });
  await logActivity('AccountsSettings', company, raw ? 'Periods locked' : 'Period lock removed', raw ? `Up to ${lockedYear} period ${lockedPeriod}` : '', user.id);
  revalidatePath('/accounts', 'layout');
}

export async function setNextNumber(formData: FormData) {
  const user = await assertPermission('accounts.setup');
  const company = getActiveCompany(user);
  const docType = String(formData.get('docType')) as TransactionType;
  const nextNumber = Number(formData.get('nextNumber'));
  if (!DOC_TYPES.includes(docType)) throw new Error('Unknown document type.');
  if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 999999) throw new Error('Enter a whole number between 1 and 999999.');

  const taken = await db.transaction.findFirst({
    where: { company, docType, ourRef: { gte: formatRef(docType, nextNumber) } },
    orderBy: { ourRef: 'desc' },
  });
  if (taken) throw new Error(`${taken.ourRef} already exists, so the next number has to be after it.`);

  await db.documentSequence.upsert({
    where: { company_docType: { company, docType } },
    create: { company, docType, nextNumber },
    update: { nextNumber },
  });
  await logActivity('DocumentSequence', `${company}-${docType}`, 'Next number set', formatRef(docType, nextNumber), user.id);
  revalidatePath('/accounts/settings');
}

// ------------------------------------------------------------------ journals

export async function postJournal(formData: FormData) {
  const user = await assertPermission('accounts.post');
  const company = getActiveCompany(user);

  const rows: Record<string, Record<string, string>> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^line\[(\d+)]\[(\w+)]$/);
    if (match) (rows[match[1]] ??= {})[match[2]] = String(value);
  }
  const lines = Object.values(rows).map((r) => ({
    nominalCode: r.nominalCode ?? '',
    description: r.description ?? '',
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
  }));
  if (lines.some((l) => !Number.isFinite(l.debit) || !Number.isFinite(l.credit))) throw new Error('One of the amounts isn\'t a number.');

  const transaction = await postTransaction({
    company,
    docType: 'NOM',
    transDate: parseDate(formData.get('transDate')),
    description: String(formData.get('description') ?? ''),
    postedById: user.id,
    lines,
  });

  await logActivity('Transaction', transaction.id, 'Journal posted', transaction.ourRef, user.id);
  revalidatePath('/accounts', 'layout');
  redirect(`/accounts/journals/${transaction.id}`);
}

export async function reverseJournal(formData: FormData) {
  const user = await assertPermission('accounts.post');
  const id = String(formData.get('transactionId'));
  const original = await db.transaction.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, original.company);

  const reversal = await reverseTransaction(id, { transDate: parseDate(formData.get('transDate')), postedById: user.id });

  await logActivity('Transaction', reversal.id, 'Journal posted', `${reversal.ourRef}, reversing ${original.ourRef}`, user.id);
  revalidatePath('/accounts', 'layout');
  redirect(`/accounts/journals/${reversal.id}`);
}

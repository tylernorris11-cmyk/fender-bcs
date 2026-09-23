import type { Company, Prisma, TransactionType } from '@prisma/client';
import { db } from './db';

// Deliberately no `import 'server-only'` — it pulls in nothing client-side
// anyway (it needs the database), and leaving it out lets scripts exercise
// the real posting rules directly.

type Client = Prisma.TransactionClient | typeof db;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type AccountsSettingsValues = {
  company: Company;
  yearStartMonth: number;
  lockedYear: number | null;
  lockedPeriod: number | null;
};

export async function getAccountsSettings(company: Company, client: Client = db): Promise<AccountsSettingsValues> {
  return (await client.accountsSettings.findUnique({ where: { company } }))
    ?? { company, yearStartMonth: 4, lockedYear: null, lockedPeriod: null };
}

/**
 * Which financial year and period a date falls in. Transaction dates are
 * plain dates stored at UTC midnight, so the UTC parts are the real ones.
 * A year is named by the calendar year it starts in.
 */
export function periodFor(date: Date, yearStartMonth: number) {
  const month = date.getUTCMonth() + 1;
  const calendarYear = date.getUTCFullYear();
  return {
    year: month >= yearStartMonth ? calendarYear : calendarYear - 1,
    period: ((month - yearStartMonth + 12) % 12) + 1,
  };
}

/** 2026/27 for a year that doesn't start in January, 2026 for one that does. */
export function yearLabel(year: number, yearStartMonth: number) {
  return yearStartMonth === 1 ? String(year) : `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** The month a period covers, e.g. "September 2026". */
export function periodMonthLabel(year: number, period: number, yearStartMonth: number) {
  const monthIndex = yearStartMonth - 1 + period - 1;
  return `${MONTH_NAMES[monthIndex % 12]} ${year + Math.floor(monthIndex / 12)}`;
}

export function isPeriodLocked(settings: AccountsSettingsValues, year: number, period: number) {
  if (settings.lockedYear == null || settings.lockedPeriod == null) return false;
  return year < settings.lockedYear || (year === settings.lockedYear && period <= settings.lockedPeriod);
}

/**
 * A VAT or nominal code picked on a form, checked to belong to the company
 * whose record it's going on. Blank means none; anything else that doesn't
 * match is refused rather than quietly saved against the other company's books.
 */
export async function checkedVatCodeId(raw: FormDataEntryValue | null, company: Company): Promise<string | null> {
  const id = String(raw ?? '');
  if (!id) return null;
  const vat = await db.vatCode.findUnique({ where: { id } });
  if (!vat || vat.company !== company) throw new Error("That VAT code doesn't belong to this company.");
  return id;
}

export async function checkedNominalCodeId(raw: FormDataEntryValue | null, company: Company): Promise<string | null> {
  const id = String(raw ?? '');
  if (!id) return null;
  const code = await db.nominalCode.findUnique({ where: { id } });
  if (!code || code.company !== company) throw new Error("That nominal code doesn't belong to this company.");
  return id;
}

export type CodeOption = { id: string; label: string };

/** Every VAT and nominal code for a company, ready for a dropdown. Retired ones stay listed (marked) so a record already using one isn't silently cleared on save. */
export async function codeOptions(company: Company): Promise<{ vatCodes: CodeOption[]; nominalCodes: CodeOption[] }> {
  const [vat, nominal] = await Promise.all([
    db.vatCode.findMany({ where: { company }, orderBy: { code: 'asc' } }),
    db.nominalCode.findMany({ where: { company }, orderBy: { code: 'asc' } }),
  ]);
  return {
    vatCodes: vat.map((v) => ({ id: v.id, label: `${v.code} ${v.name} (${Number(v.rate)}%)${v.active ? '' : ', retired'}` })),
    nominalCodes: nominal.map((n) => ({ id: n.id, label: `${n.code} ${n.name}${n.active ? '' : ' (retired)'}` })),
  };
}

/** Exchequer's own reference format: the document type, then six digits. */
export function formatRef(docType: TransactionType, n: number) {
  return `${docType}${String(n).padStart(6, '0')}`;
}

const toPennies = (n: number) => Math.round(n * 100);
const money = (pennies: number) =>
  (pennies / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export type PostingLine = { nominalCode: string; debit?: number; credit?: number; description?: string };

/**
 * The only way anything gets into the ledger. Refuses unless debits equal
 * credits to the penny, every nominal code exists for the company, and the
 * date falls in an open period — then claims the next document number and
 * writes the whole thing in one database step, so a failure part-way leaves
 * nothing behind.
 */
export async function postTransaction(input: {
  company: Company;
  docType: TransactionType;
  transDate: Date;
  description?: string;
  postedById?: string | null;
  lines: PostingLine[];
  reversesId?: string;
  allowInactiveCodes?: boolean;
}) {
  if (Number.isNaN(input.transDate.getTime())) throw new Error('Enter a valid date.');

  const lines = input.lines
    .map((l) => ({ ...l, nominalCode: l.nominalCode.trim(), debitP: toPennies(l.debit ?? 0), creditP: toPennies(l.credit ?? 0) }))
    .filter((l) => l.debitP !== 0 || l.creditP !== 0);

  for (const l of lines) {
    if (!l.nominalCode) throw new Error('Every line with an amount needs a nominal code.');
    if (l.debitP < 0 || l.creditP < 0) throw new Error(`Amounts can't be negative. Put ${l.nominalCode}'s amount in the other column instead.`);
    if (l.debitP > 0 && l.creditP > 0) throw new Error(`The line for ${l.nominalCode} has both a debit and a credit. Split it into two lines.`);
  }
  if (lines.length < 2) throw new Error('A journal needs at least two lines with amounts.');

  const totalDebit = lines.reduce((s, l) => s + l.debitP, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditP, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(
      `This doesn't balance: debits ${money(totalDebit)}, credits ${money(totalCredit)}, ${money(Math.abs(totalDebit - totalCredit))} out.`,
    );
  }

  return db.$transaction(async (tx) => {
    const settings = await getAccountsSettings(input.company, tx);
    const { year, period } = periodFor(input.transDate, settings.yearStartMonth);
    if (isPeriodLocked(settings, year, period)) {
      throw new Error(
        `${periodMonthLabel(year, period, settings.yearStartMonth)} (${yearLabel(year, settings.yearStartMonth)} period ${period}) is locked. Pick a date in an open period.`,
      );
    }

    const codes = await tx.nominalCode.findMany({
      where: { company: input.company, code: { in: [...new Set(lines.map((l) => l.nominalCode))] } },
    });
    const byCode = new Map(codes.map((c) => [c.code, c]));
    for (const l of lines) {
      const code = byCode.get(l.nominalCode);
      if (!code) throw new Error(`Nominal code ${l.nominalCode} doesn't exist. Add it to the chart of accounts first.`);
      if (!code.active && !input.allowInactiveCodes) throw new Error(`Nominal code ${code.code} (${code.name}) is no longer in use.`);
    }

    // Updating the sequence row locks it until this transaction ends, so two
    // postings at the same moment can never be handed the same number.
    const seq = await tx.documentSequence.upsert({
      where: { company_docType: { company: input.company, docType: input.docType } },
      create: { company: input.company, docType: input.docType, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });

    return tx.transaction.create({
      data: {
        company: input.company,
        docType: input.docType,
        ourRef: formatRef(input.docType, seq.nextNumber - 1),
        transDate: input.transDate,
        year,
        period,
        description: input.description?.trim() ?? '',
        postedById: input.postedById ?? null,
        reversesId: input.reversesId ?? null,
        postings: {
          create: lines.map((l) => ({
            nominalCodeId: byCode.get(l.nominalCode)!.id,
            debit: (l.debitP / 100).toFixed(2),
            credit: (l.creditP / 100).toFixed(2),
            description: l.description?.trim() ?? '',
          })),
        },
      },
    });
  });
}

/**
 * Puts a posted transaction right the way Exchequer does: a new entry with
 * every debit and credit swapped, linked back to the original. The original
 * is never touched. Codes that have since been retired can still be
 * reversed through, or an old mistake could never be undone.
 */
export async function reverseTransaction(id: string, opts: { transDate: Date; postedById?: string | null }) {
  const original = await db.transaction.findUniqueOrThrow({
    where: { id },
    include: { postings: { include: { nominalCode: true } }, reversedBy: true },
  });
  if (original.reversedBy) throw new Error(`${original.ourRef} has already been reversed by ${original.reversedBy.ourRef}.`);
  if (original.reversesId) throw new Error(`${original.ourRef} is itself a reversal. Post a new journal instead.`);

  return postTransaction({
    company: original.company,
    docType: original.docType,
    transDate: opts.transDate,
    description: `Reversal of ${original.ourRef}${original.description ? `: ${original.description}` : ''}`,
    postedById: opts.postedById,
    reversesId: original.id,
    allowInactiveCodes: true,
    lines: original.postings.map((p) => ({
      nominalCode: p.nominalCode.code,
      debit: Number(p.credit),
      credit: Number(p.debit),
      description: p.description,
    })),
  });
}

export type TrialBalanceRow = { id: string | null; code: string; name: string; debit: number; credit: number };

/**
 * Balances at the end of a period. Balance sheet codes carry everything
 * since the start; profit and loss codes only show this financial year, with
 * earlier years' net profit shown as one brought-forward line, the way it
 * sits until a year end moves it into reserves.
 */
export async function trialBalance(company: Company, year: number, period: number) {
  const upToPeriod = { OR: [{ year: { lt: year } }, { year, period: { lte: period } }] };
  const [codes, balanceSheet, profitAndLoss, broughtForward] = await Promise.all([
    db.nominalCode.findMany({ where: { company }, orderBy: { code: 'asc' } }),
    db.nominalPosting.groupBy({
      by: ['nominalCodeId'],
      where: { nominalCode: { type: 'BALANCE_SHEET' }, transaction: { company, ...upToPeriod } },
      _sum: { debit: true, credit: true },
    }),
    db.nominalPosting.groupBy({
      by: ['nominalCodeId'],
      where: { nominalCode: { type: 'PROFIT_AND_LOSS' }, transaction: { company, year, period: { lte: period } } },
      _sum: { debit: true, credit: true },
    }),
    db.nominalPosting.aggregate({
      where: { nominalCode: { type: 'PROFIT_AND_LOSS' }, transaction: { company, year: { lt: year } } },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const net = new Map<string, number>();
  for (const g of [...balanceSheet, ...profitAndLoss]) {
    net.set(g.nominalCodeId, toPennies(Number(g._sum.debit ?? 0)) - toPennies(Number(g._sum.credit ?? 0)));
  }

  const rows: TrialBalanceRow[] = codes
    .filter((c) => (net.get(c.id) ?? 0) !== 0)
    .map((c) => {
      const p = net.get(c.id)!;
      return { id: c.id, code: c.code, name: c.name, debit: p > 0 ? p / 100 : 0, credit: p < 0 ? -p / 100 : 0 };
    });

  const bf = toPennies(Number(broughtForward._sum.debit ?? 0)) - toPennies(Number(broughtForward._sum.credit ?? 0));
  if (bf !== 0) {
    rows.push({ id: null, code: '', name: 'Profit and loss brought forward', debit: bf > 0 ? bf / 100 : 0, credit: bf < 0 ? -bf / 100 : 0 });
  }

  const totalDebit = rows.reduce((s, r) => s + toPennies(r.debit), 0) / 100;
  const totalCredit = rows.reduce((s, r) => s + toPennies(r.credit), 0) / 100;
  return { rows, totalDebit, totalCredit };
}

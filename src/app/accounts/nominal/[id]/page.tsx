import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { money, shortDate } from '@/lib/format';
import { getAccountsSettings, periodFor, yearLabel } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Table } from '@/components/ui';

/** Exchequer's ledger card for a nominal code: an opening balance, every posting in the year, and the running balance. */
export default async function NominalLedgerPage({ params, searchParams }: { params: { id: string }; searchParams: { year?: string } }) {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);

  const code = await db.nominalCode.findUnique({ where: { id: params.id } });
  if (!code || !user.companies.includes(code.company)) notFound();
  const settings = await getAccountsSettings(code.company);
  const current = periodFor(new Date(), settings.yearStartMonth);
  const year = Number(searchParams.year) || current.year;

  // Profit and loss codes start each year at nothing; balance sheet codes carry everything before it.
  const [opening, postings, earliest] = await Promise.all([
    code.type === 'BALANCE_SHEET'
      ? db.nominalPosting.aggregate({ where: { nominalCodeId: code.id, transaction: { year: { lt: year } } }, _sum: { debit: true, credit: true } })
      : null,
    db.nominalPosting.findMany({
      where: { nominalCodeId: code.id, transaction: { year } },
      include: { transaction: true },
      orderBy: [{ transaction: { transDate: 'asc' } }, { transaction: { ourRef: 'asc' } }],
    }),
    db.transaction.findFirst({ where: { company: code.company }, orderBy: { year: 'asc' }, select: { year: true } }),
  ]);
  const firstYear = Math.min(earliest?.year ?? current.year, current.year);
  const years = Array.from({ length: current.year + 1 - firstYear + 1 }, (_, i) => firstYear + i);

  let balance = opening ? Math.round((Number(opening._sum.debit ?? 0) - Number(opening._sum.credit ?? 0)) * 100) : 0;
  const openingBalance = balance;
  const rows = postings.map((p) => {
    balance += Math.round(Number(p.debit) * 100) - Math.round(Number(p.credit) * 100);
    return { ...p, balance };
  });
  const show = (pennies: number) => `${money(Math.abs(pennies) / 100)} ${pennies < 0 ? 'Cr' : pennies > 0 ? 'Dr' : ''}`.trim();

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/nominal" alerts={alerts.length}>
      <Link href="/accounts/nominal" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to chart of accounts
      </Link>
      <PageHeader
        title={`${code.code} ${code.name}`}
        blurb={`${code.type === 'BALANCE_SHEET' ? 'Balance sheet' : 'Profit and loss'}${code.active ? '' : ' · retired'}`}
      />

      <form className="card card-pad mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="year">Financial year</label>
          <select id="year" name="year" defaultValue={year} className="input w-36">
            {years.map((y) => <option key={y} value={y}>{yearLabel(y, settings.yearStartMonth)}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Show</button>
      </form>

      <section className="card card-pad">
        {rows.length === 0 && openingBalance === 0 ? (
          <Empty title={`Nothing posted to ${code.code} in ${yearLabel(year, settings.yearStartMonth)}.`} />
        ) : (
          <Table head={<>
            <th className="th">Date</th><th className="th">Our ref</th><th className="th">Period</th><th className="th">Description</th>
            <th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th>
          </>}>
            <tr className="row">
              <td className="td text-ink-muted" colSpan={6}>Brought forward</td>
              <td className="td text-right tabular-nums font-semibold">{show(openingBalance)}</td>
            </tr>
            {rows.map((p) => (
              <tr key={p.id} className="row">
                <td className="td whitespace-nowrap">{shortDate(p.transaction.transDate)}</td>
                <td className="td font-mono">
                  <Link href={`/accounts/journals/${p.transactionId}`} className="text-brand-700 font-semibold hover:underline">{p.transaction.ourRef}</Link>
                </td>
                <td className="td text-ink-muted">P{p.transaction.period}</td>
                <td className="td">{p.description || p.transaction.description || '—'}</td>
                <td className="td text-right tabular-nums">{Number(p.debit) ? money(p.debit) : ''}</td>
                <td className="td text-right tabular-nums">{Number(p.credit) ? money(p.credit) : ''}</td>
                <td className="td text-right tabular-nums">{show(p.balance)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

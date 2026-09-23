import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { money } from '@/lib/format';
import { getAccountsSettings, periodFor, periodMonthLabel, trialBalance, yearLabel } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';

export default async function TrialBalancePage({ searchParams }: { searchParams: { year?: string; period?: string } }) {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const settings = await getAccountsSettings(company);

  const current = periodFor(new Date(), settings.yearStartMonth);
  const year = Number(searchParams.year) || current.year;
  const period = Math.min(12, Math.max(1, Number(searchParams.period) || (year === current.year ? current.period : 12)));

  const [tb, earliest] = await Promise.all([
    trialBalance(company, year, period),
    db.transaction.findFirst({ where: { company }, orderBy: { year: 'asc' }, select: { year: true } }),
  ]);
  const firstYear = Math.min(earliest?.year ?? current.year, current.year);
  const years = Array.from({ length: current.year + 1 - firstYear + 1 }, (_, i) => firstYear + i);
  const balanced = Math.round(tb.totalDebit * 100) === Math.round(tb.totalCredit * 100);

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts" alerts={alerts.length}>
      <PageHeader
        title="Trial balance"
        blurb={`${COMPANY_LABEL[company]}, at the end of ${periodMonthLabel(year, period, settings.yearStartMonth)} (${yearLabel(year, settings.yearStartMonth)} period ${period}).`}
      />

      <form className="card card-pad mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="year">Financial year</label>
          <select id="year" name="year" defaultValue={year} className="input w-36">
            {years.map((y) => <option key={y} value={y}>{yearLabel(y, settings.yearStartMonth)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="period">Up to period</label>
          <select id="period" name="period" defaultValue={period} className="input w-56">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>{p}: {periodMonthLabel(year, p, settings.yearStartMonth)}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">Show</button>
      </form>

      {!balanced && (
        <div className="banner-bad mb-6">
          Debits and credits don&apos;t agree. That should be impossible, so report it straight away.
        </div>
      )}

      <section className="card card-pad">
        {tb.rows.length === 0 ? (
          <Empty
            title="Nothing posted up to this period yet."
            action={
              <div className="flex gap-2">
                <Link href="/accounts/nominal" className="btn-secondary">Chart of accounts</Link>
                {can(user, 'accounts.post') && <Link href="/accounts/journals/new" className="btn-primary">Post a journal</Link>}
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">Code</th>
                  <th className="th">Name</th>
                  <th className="th text-right">Debit</th>
                  <th className="th text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.id ?? 'bf'} className="row">
                    <td className="td font-mono">
                      {r.id ? <Link href={`/accounts/nominal/${r.id}?year=${year}`} className="text-brand-700 font-semibold hover:underline">{r.code}</Link> : '—'}
                    </td>
                    <td className="td">{r.name}</td>
                    <td className="td text-right tabular-nums">{r.debit ? money(r.debit) : ''}</td>
                    <td className="td text-right tabular-nums">{r.credit ? money(r.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/20">
                  <td className="td" />
                  <td className="td font-bold">Totals</td>
                  <td className="td text-right tabular-nums font-bold">{money(tb.totalDebit)}</td>
                  <td className="td text-right tabular-nums font-bold">{money(tb.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}

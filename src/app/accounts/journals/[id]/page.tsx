import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, isoDateUk, money, shortDate } from '@/lib/format';
import { getAccountsSettings, periodMonthLabel, yearLabel } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { reverseJournal } from '../../actions';

export default async function JournalPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);

  const j = await db.transaction.findUnique({
    where: { id: params.id },
    include: {
      postings: { include: { nominalCode: true }, orderBy: { id: 'asc' } },
      postedBy: { select: { name: true } },
      reverses: { select: { id: true, ourRef: true } },
      reversedBy: { select: { id: true, ourRef: true } },
    },
  });
  if (!j || !user.companies.includes(j.company)) notFound();
  const settings = await getAccountsSettings(j.company);

  const totalDebit = j.postings.reduce((s, p) => s + Number(p.debit), 0);
  const totalCredit = j.postings.reduce((s, p) => s + Number(p.credit), 0);
  const canReverse = can(user, 'accounts.post') && !j.reversedBy && !j.reverses;

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/journals" alerts={alerts.length}>
      <Link href="/accounts/journals" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to journals
      </Link>

      <PageHeader
        title={j.ourRef}
        blurb={`${shortDate(j.transDate)} · ${periodMonthLabel(j.year, j.period, settings.yearStartMonth)} (${yearLabel(j.year, settings.yearStartMonth)} period ${j.period}) · posted ${shortDate(j.postedAt)} at ${clock(j.postedAt)}${j.postedBy ? ` by ${j.postedBy.name}` : ''}`}
      />

      {j.reversedBy && (
        <div className="banner-warn mb-6">
          Reversed by <Link href={`/accounts/journals/${j.reversedBy.id}`} className="font-semibold underline">{j.reversedBy.ourRef}</Link>.
          Together they net to nothing.
        </div>
      )}
      {j.reverses && (
        <div className="banner-warn mb-6">
          This reverses <Link href={`/accounts/journals/${j.reverses.id}`} className="font-semibold underline">{j.reverses.ourRef}</Link>.
        </div>
      )}

      <section className="card card-pad mb-6">
        {j.description && <p className="mb-4">{j.description}</p>}
        <Table head={<>
          <th className="th">Code</th><th className="th">Name</th><th className="th">Line description</th>
          <th className="th text-right">Debit</th><th className="th text-right">Credit</th>
        </>}>
          {j.postings.map((p) => (
            <tr key={p.id} className="row">
              <td className="td font-mono">
                <Link href={`/accounts/nominal/${p.nominalCodeId}?year=${j.year}`} className="text-brand-700 font-semibold hover:underline">{p.nominalCode.code}</Link>
              </td>
              <td className="td">{p.nominalCode.name}</td>
              <td className="td text-ink-muted">{p.description || '—'}</td>
              <td className="td text-right tabular-nums">{Number(p.debit) ? money(p.debit) : ''}</td>
              <td className="td text-right tabular-nums">{Number(p.credit) ? money(p.credit) : ''}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-ink/20">
            <td className="td" colSpan={3}><span className="font-bold">Totals</span></td>
            <td className="td text-right tabular-nums font-bold">{money(totalDebit)}</td>
            <td className="td text-right tabular-nums font-bold">{money(totalCredit)}</td>
          </tr>
        </Table>
      </section>

      {canReverse && (
        <section className="card card-pad max-w-xl">
          <h2 className="text-lg font-bold mb-1">Reverse this journal</h2>
          <p className="text-sm text-ink-muted mb-4">
            Posts a new journal with every debit and credit swapped. This one stays exactly as it is, so the history shows both.
          </p>
          <form action={reverseJournal} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="transactionId" value={j.id} />
            <div>
              <label className="label" htmlFor="transDate">Date of the reversal</label>
              <input id="transDate" name="transDate" type="date" required defaultValue={isoDateUk()} className="input" />
            </div>
            <SubmitButton className="btn-secondary" pendingLabel="Reversing…">Post reversal</SubmitButton>
          </form>
        </section>
      )}
    </Shell>
  );
}

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { money, shortDate } from '@/lib/format';
import { getAccountsSettings, yearLabel } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';

export default async function JournalsPage() {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const settings = await getAccountsSettings(company);

  const journals = await db.transaction.findMany({
    where: { company, docType: 'NOM' },
    include: { postings: { select: { debit: true } }, postedBy: { select: { name: true } }, reverses: { select: { ourRef: true } }, reversedBy: { select: { ourRef: true } } },
    orderBy: { ourRef: 'desc' },
    take: 200,
  });

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/journals" alerts={alerts.length}>
      <PageHeader
        title="Journals"
        blurb="Every nominal journal posted, newest first. A posted journal can't be edited. It's put right by reversing it."
        actions={can(user, 'accounts.post') && <Link href="/accounts/journals/new" className="btn-primary"><Plus size={16} /> New journal</Link>}
      />
      <section className="card card-pad">
        {journals.length === 0 ? (
          <Empty title="No journals posted yet." />
        ) : (
          <Table head={<>
            <th className="th">Our ref</th><th className="th">Date</th><th className="th">Period</th>
            <th className="th">Description</th><th className="th text-right">Amount</th><th className="th">Posted by</th>
          </>}>
            {journals.map((j) => (
              <tr key={j.id} className="row">
                <td className="td font-mono">
                  <Link href={`/accounts/journals/${j.id}`} className="text-brand-700 font-semibold hover:underline">{j.ourRef}</Link>
                </td>
                <td className="td whitespace-nowrap">{shortDate(j.transDate)}</td>
                <td className="td whitespace-nowrap text-ink-muted">{yearLabel(j.year, settings.yearStartMonth)} P{j.period}</td>
                <td className="td">
                  {j.description || <span className="text-ink-faint">—</span>}
                  {j.reversedBy && <span className="ml-2"><Pill tone="warn">Reversed by {j.reversedBy.ourRef}</Pill></span>}
                  {j.reverses && <span className="ml-2"><Pill tone="info">Reverses {j.reverses.ourRef}</Pill></span>}
                </td>
                <td className="td text-right tabular-nums">{money(j.postings.reduce((s, p) => s + Number(p.debit), 0))}</td>
                <td className="td text-ink-muted">{j.postedBy?.name ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

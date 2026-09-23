import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addNominalCode, toggleNominalCode } from '../actions';

const TYPE_LABEL = { PROFIT_AND_LOSS: 'Profit and loss', BALANCE_SHEET: 'Balance sheet' } as const;

export default async function ChartOfAccountsPage() {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canSetUp = can(user, 'accounts.setup');

  const codes = await db.nominalCode.findMany({
    where: { company },
    orderBy: { code: 'asc' },
    include: { _count: { select: { postings: true } } },
  });

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/nominal" alerts={alerts.length}>
      <PageHeader
        title="Chart of accounts"
        blurb={`${COMPANY_LABEL[company]}'s nominal codes. These come across from Exchequer in the import, and can be added here by hand too.`}
      />

      {canSetUp && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Add a nominal code</h2>
          <form action={addNominalCode} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="code">Code</label>
              <input id="code" name="code" required maxLength={20} className="input w-28 font-mono" placeholder="4000" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" required className="input" placeholder="Sales: reinforcing bar" />
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" required defaultValue="" className="input w-44">
                <option value="" disabled>Choose…</option>
                <option value="PROFIT_AND_LOSS">Profit and loss</option>
                <option value="BALANCE_SHEET">Balance sheet</option>
              </select>
            </div>
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {codes.length === 0 ? (
          <Empty title="No nominal codes yet." />
        ) : (
          <Table head={<>
            <th className="th">Code</th><th className="th">Name</th><th className="th">Type</th>
            <th className="th text-right">Postings</th><th className="th">Status</th>
          </>}>
            {codes.map((c) => (
              <tr key={c.id} className="row">
                <td className="td font-mono">
                  <Link href={`/accounts/nominal/${c.id}`} className="text-brand-700 font-semibold hover:underline">{c.code}</Link>
                </td>
                <td className="td">{c.name}</td>
                <td className="td text-ink-muted">{TYPE_LABEL[c.type]}</td>
                <td className="td text-right tabular-nums text-ink-muted">{c._count.postings}</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Pill tone={c.active ? 'good' : 'neutral'}>{c.active ? 'In use' : 'Retired'}</Pill>
                    {canSetUp && (
                      <form action={toggleNominalCode}>
                        <input type="hidden" name="nominalCodeId" value={c.id} />
                        <button className="text-xs text-ink-faint hover:text-ink underline">{c.active ? 'retire' : 'bring back'}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

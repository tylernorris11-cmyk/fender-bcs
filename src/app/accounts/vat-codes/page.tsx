import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addVatCode, toggleVatCode } from '../actions';

export default async function VatCodesPage() {
  const user = await requirePermission('accounts.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canSetUp = can(user, 'accounts.setup');

  const codes = await db.vatCode.findMany({ where: { company }, orderBy: { code: 'asc' } });

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/vat-codes" alerts={alerts.length}>
      <PageHeader
        title="VAT codes"
        blurb={`${COMPANY_LABEL[company]}'s VAT codes, using the same letters as Exchequer. Customers, suppliers, stock and every invoice line will carry one.`}
      />

      {canSetUp && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Add a VAT code</h2>
          <form action={addVatCode} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="code">Code</label>
              <input id="code" name="code" required maxLength={3} className="input w-20 font-mono uppercase" placeholder="S" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" required className="input" placeholder="Standard rate" />
            </div>
            <div>
              <label className="label" htmlFor="rate">Rate (%)</label>
              <input id="rate" name="rate" type="number" step="0.01" min="0" max="100" required className="input w-28" placeholder="20" />
            </div>
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {codes.length === 0 ? (
          <Empty title="No VAT codes yet." />
        ) : (
          <Table head={<><th className="th">Code</th><th className="th">Name</th><th className="th text-right">Rate</th><th className="th">Status</th></>}>
            {codes.map((c) => (
              <tr key={c.id} className="row">
                <td className="td font-mono font-semibold">{c.code}</td>
                <td className="td">{c.name}</td>
                <td className="td text-right tabular-nums">{Number(c.rate)}%</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Pill tone={c.active ? 'good' : 'neutral'}>{c.active ? 'In use' : 'Retired'}</Pill>
                    {canSetUp && (
                      <form action={toggleVatCode}>
                        <input type="hidden" name="vatCodeId" value={c.id} />
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

import type { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortSelect, Table } from '@/components/ui';
import { closeAuditAction, submitReturn } from '../actions';

function quarterOf(d: Date) {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

const ACTION_SORTS: Record<string, Prisma.AuditActionOrderByWithRelationInput[]> = {
  due: [{ closedAt: 'asc' }, { dueOn: 'asc' }],
  newest: [{ dueOn: 'desc' }],
  ref: [{ ref: 'asc' }],
};

export default async function ReturnsPage({ searchParams }: { searchParams: { sort?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [returns, actions, delivered] = await Promise.all([
    db.quarterlyReturn.findMany({ where: { company }, orderBy: { period: 'desc' } }),
    db.auditAction.findMany({ where: { company }, orderBy: ACTION_SORTS[searchParams.sort ?? 'due'] ?? ACTION_SORTS.due }),
    db.order.findMany({
      where: { company, stage: { in: ['DELIVERED', 'COMPLETED'] } },
      select: { deliveredAt: true, completedAt: true, createdAt: true, lines: { select: { weightKg: true } }, barMarks: { select: { weightKg: true } } },
    }),
  ]);

  // Tonnage actually despatched, grouped by quarter — the number the return wants.
  const byQuarter = new Map<string, number>();
  for (const o of delivered) {
    const when = o.deliveredAt ?? o.completedAt ?? o.createdAt;
    const kg =
      o.lines.reduce((s, l) => s + Number(l.weightKg), 0) +
      o.barMarks.reduce((s, b) => s + Number(b.weightKg), 0);
    const key = quarterOf(when);
    byQuarter.set(key, (byQuarter.get(key) ?? 0) + kg / 1000);
  }

  const periods = [...new Set([...byQuarter.keys(), ...returns.map((r) => r.period)])].sort().reverse();
  const openActions = actions.filter((a) => !a.closedAt);

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/returns" alerts={alerts.length}>
      <PageHeader title="Returns & actions" blurb="Quarterly tonnage returns, and every action left over from an audit or a management review." />

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-1">Quarterly tonnage</h2>
        <p className="text-sm text-ink-muted mb-4">
          Worked out from what actually left the yard. Check it against your despatch records before you send it.
        </p>
        <Table head={<>
          <th className="th">Quarter</th><th className="th text-right">Tonnage despatched</th>
          <th className="th">Submitted</th><th className="th">Prepared by</th><th className="th sr-only">Action</th>
        </>}>
          {periods.map((period) => {
            const record = returns.find((r) => r.period === period);
            const calculated = byQuarter.get(period) ?? 0;
            return (
              <tr key={period} className="row">
                <td className="td font-semibold">{period}</td>
                <td className="td text-right tabular-nums">{calculated.toFixed(3)} t</td>
                <td className="td">
                  {record?.submittedAt ? <Pill tone="good">{shortDate(record.submittedAt)}</Pill> : <Pill tone="warn">Not submitted</Pill>}
                </td>
                <td className="td text-ink-muted">{record?.preparedBy ?? '—'}</td>
                <td className="td text-right">
                  {can(user, 'compliance.edit') && !record?.submittedAt && (
                    <form action={submitReturn} className="flex justify-end gap-2">
                      <input type="hidden" name="period" value={period} />
                      <input type="hidden" name="tonnage" value={calculated.toFixed(3)} />
                      <input name="reference" placeholder="Ref" className="input w-28 py-1.5" aria-label={`Reference for ${period}`} />
                      <button className="btn-secondary btn-sm">Mark submitted</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </section>

      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold">Audit actions</h2>
          <form className="flex gap-2">
            <SortSelect
              value={searchParams.sort}
              label="Sort"
              options={[
                { value: 'due', label: 'Due soonest' },
                { value: 'newest', label: 'Newest' },
                { value: 'ref', label: 'Ref A-Z' },
              ]}
            />
            <button className="btn-secondary btn-sm">Apply</button>
          </form>
        </div>
        <p className="text-sm text-ink-muted mb-4">{openActions.length} open. Close each one with the evidence, not just a tick.</p>

        <ul className="space-y-2">
          {actions.map((a) => {
            const days = a.dueOn ? daysUntil(a.dueOn) : null;
            return (
              <li key={a.id} className="border border-hairline rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-semibold">{a.ref}</span>
                  <Pill>{a.source}</Pill>
                  {a.closedAt
                    ? <Pill tone="good">Closed {shortDate(a.closedAt)}</Pill>
                    : days !== null && days < 0
                      ? <Pill tone="bad">Overdue by {-days} days</Pill>
                      : <Pill tone="warn">Due {shortDate(a.dueOn)}</Pill>}
                  {a.owner && <span className="text-sm text-ink-faint ml-auto">{a.owner}</span>}
                </div>
                <p className="text-sm">{a.description}</p>
                {a.evidence && <p className="text-sm text-ink-muted mt-2"><strong>Evidence:</strong> {a.evidence}</p>}

                {!a.closedAt && can(user, 'compliance.edit') && (
                  <form action={closeAuditAction} className="flex flex-col sm:flex-row gap-2 mt-3">
                    <input type="hidden" name="actionId" value={a.id} />
                    <input name="evidence" required className="input flex-1" placeholder="What changed, and where it is recorded" />
                    <button className="btn-secondary btn-sm">Close action</button>
                  </form>
                )}
              </li>
            );
          })}
          {actions.length === 0 && <li className="text-ink-muted py-4">Nothing outstanding.</li>}
        </ul>
      </section>
    </Shell>
  );
}

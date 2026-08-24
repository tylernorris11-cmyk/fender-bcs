import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { toleranceFor } from '@/lib/bs8666';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';
import { recordCheck } from '../actions';

const DIMENSIONS = ['Total length', 'A', 'B', 'C', 'D', 'E/F'];

export default async function ChecksPage({ searchParams }: { searchParams: { order?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [orders, recent] = await Promise.all([
    db.order.findMany({
      where: {
        company, archived: false, barMarks: { some: {} }, stage: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
        ...(searchParams.order ? { id: searchParams.order } : {}),
      },
      include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' }, include: { qcChecks: { include: { checkedBy: true }, orderBy: { at: 'desc' } } } } },
      orderBy: { deliveryDate: 'asc' },
    }),
    db.qcCheck.findMany({ where: { barMark: { order: { company } } }, include: { checkedBy: true, barMark: { include: { order: true } } }, orderBy: { at: 'desc' }, take: 25 }),
  ]);

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production/checks" alerts={alerts.length}>
      <PageHeader
        title="Dimensional checks"
        blurb="Measure it, record it. A check that fails should be followed by a non-conformance before the bars move."
        actions={searchParams.order && <Link href="/production/checks" className="btn-secondary">Show all orders</Link>}
      />

      {orders.length === 0 ? <Empty title="No schedules waiting to be checked." /> : orders.map((o) => (
        <section key={o.id} className="card card-pad mb-6">
          <header className="mb-4">
            <Link href={`/orders/${o.id}`} className="text-lg font-bold text-brand-700 hover:underline">{o.number}</Link>
            <p className="text-sm text-ink-muted">{o.customer.name} · delivery {shortDate(o.deliveryDate)}</p>
          </header>

          <div className="space-y-3">
            {o.barMarks.map((b) => {
              const t = toleranceFor(b.lengthMm);
              const failed = b.qcChecks.some((c) => !c.pass);
              return (
                <div key={b.id} className="border border-hairline rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="font-bold">{b.mark}</span>
                    <span className="text-sm text-ink-muted">
                      {b.diaMm} mm · shape {b.shapeCode} · {b.bars} bars · scheduled {b.lengthMm} mm
                    </span>
                    <Pill tone={failed ? 'bad' : b.qcChecks.length ? 'good' : 'neutral'}>
                      {failed ? 'Out of tolerance' : b.qcChecks.length ? `${b.qcChecks.length} checks` : 'Not checked'}
                    </Pill>
                    <span className="text-sm text-ink-faint ml-auto">Tolerance +{t.plusMm} / −{t.minusMm} mm</span>
                  </div>

                  {b.qcChecks.length > 0 && (
                    <ul className="text-sm space-y-1 mb-3">
                      {b.qcChecks.map((c) => (
                        <li key={c.id} className="flex flex-wrap gap-3 items-center">
                          <Pill tone={c.pass ? 'good' : 'bad'}>{c.pass ? 'Pass' : 'Fail'}</Pill>
                          <span>{c.dimension}: scheduled {c.nominalMm} mm, measured <strong>{c.measuredMm} mm</strong></span>
                          <span className="text-ink-faint ml-auto">{c.checkedBy?.name} · {shortDate(c.at)} {clock(c.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {can(user, 'production.qc') && (
                    <form action={recordCheck} className="flex flex-wrap gap-2 items-end">
                      <input type="hidden" name="barMarkId" value={b.id} />
                      <div>
                        <label className="label text-xs" htmlFor={`dim-${b.id}`}>Dimension</label>
                        <select id={`dim-${b.id}`} name="dimension" className="input w-40 py-2">
                          {DIMENSIONS.map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs" htmlFor={`m-${b.id}`}>Measured (mm)</label>
                        <input id={`m-${b.id}`} name="measuredMm" type="number" required className="input w-32 py-2" />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="label text-xs" htmlFor={`n-${b.id}`}>Note</label>
                        <input id={`n-${b.id}`} name="note" className="input py-2" placeholder="Machine, sample size…" />
                      </div>
                      <button className="btn-secondary">Record check</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">Recent checks across all orders</h2>
        <Table head={<>
          <th className="th">When</th><th className="th">Order</th><th className="th">Mark</th>
          <th className="th">Dimension</th><th className="th text-right">Scheduled</th>
          <th className="th text-right">Measured</th><th className="th">Result</th><th className="th">By</th>
        </>}>
          {recent.map((c) => (
            <tr key={c.id} className="row">
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(c.at)} {clock(c.at)}</td>
              <td className="td"><Link href={`/orders/${c.barMark.order.id}`} className="text-brand-700 hover:underline">{c.barMark.order.number}</Link></td>
              <td className="td font-semibold">{c.barMark.mark}</td>
              <td className="td">{c.dimension}</td>
              <td className="td text-right tabular-nums">{c.nominalMm} mm</td>
              <td className="td text-right tabular-nums">{c.measuredMm} mm</td>
              <td className="td"><Pill tone={c.pass ? 'good' : 'bad'}>{c.pass ? 'Pass' : `Fail (${c.toleranceMm})`}</Pill></td>
              <td className="td text-ink-muted">{c.checkedBy?.name}</td>
            </tr>
          ))}
          {recent.length === 0 && <tr><td colSpan={8} className="td text-ink-muted">No checks recorded yet.</td></tr>}
        </Table>
      </section>
    </Shell>
  );
}

import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { minRadiusMm, minStraightBetweenBends, toleranceFor } from '@/lib/bs8666';
import { getActiveCompany } from '@/lib/company';
import { shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';

export default async function SchedulesPage() {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);

  const orders = await db.order.findMany({
    where: { company: getActiveCompany(user), archived: false, barMarks: { some: {} }, stage: { notIn: ['COMPLETED', 'CANCELLED'] } },
    include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' }, include: { qcChecks: true } } },
    orderBy: { deliveryDate: 'asc' },
  });

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production/schedules" alerts={alerts.length}>
      <PageHeader title="Bending schedules" blurb="Every live schedule, with the tolerance and minimum radius each mark must be worked to." />

      {orders.length === 0 ? <Empty title="No live bending schedules." /> : orders.map((o) => (
        <section key={o.id} className="card card-pad mb-6">
          <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <Link href={`/orders/${o.id}`} className="text-lg font-bold text-brand-700 hover:underline">{o.number}</Link>
              <p className="text-sm text-ink-muted">{o.customer.name} · delivery {shortDate(o.deliveryDate)}</p>
            </div>
            <a href={`/orders/${o.id}/bending-ticket`} className="btn-secondary btn-sm">Print bending ticket</a>
          </header>

          <Table head={<>
            <th className="th">Mark</th><th className="th">Dia</th><th className="th">Shape</th>
            <th className="th text-right">Length</th><th className="th text-right">Bars</th>
            <th className="th">A / B / C / D / E-F</th><th className="th">Min radius</th>
            <th className="th">Min straight</th><th className="th">Tolerance</th>
            <th className="th text-right">Weight</th><th className="th">Status</th>
          </>}>
            {o.barMarks.map((b) => {
              const t = toleranceFor(b.lengthMm);
              const failed = b.qcChecks.some((c) => !c.pass);
              return (
                <tr key={b.id} className="row">
                  <td className="td font-semibold">{b.mark}</td>
                  <td className="td">{b.diaMm} mm</td>
                  <td className="td">{b.shapeCode} — {b.shapeName}</td>
                  <td className="td text-right tabular-nums">{b.lengthMm} mm</td>
                  <td className="td text-right tabular-nums">{b.bars}</td>
                  <td className="td tabular-nums text-ink-muted">{[b.a, b.b, b.c, b.d, b.ef].map((v) => v ?? 0).join(' / ')}</td>
                  <td className="td tabular-nums">{b.radiusMm ?? minRadiusMm(b.diaMm)} mm</td>
                  <td className="td tabular-nums text-ink-muted">{minStraightBetweenBends(b.diaMm)} mm</td>
                  <td className="td tabular-nums">+{t.plusMm} / −{t.minusMm}</td>
                  <td className="td text-right tabular-nums">{tonnes(b.weightKg)}</td>
                  <td className="td">
                    {failed ? <Pill tone="bad">Out of tolerance</Pill>
                      : b.qcChecks.length ? <Pill tone="good">Checked</Pill>
                      : <Pill>{b.status}</Pill>}
                  </td>
                </tr>
              );
            })}
          </Table>
        </section>
      ))}
    </Shell>
  );
}

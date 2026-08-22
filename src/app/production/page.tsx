import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, StagePill, Stat, StatRow } from '@/components/ui';

export default async function ProductionPage() {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);

  const orders = await db.order.findMany({
    where: { archived: false, stage: { in: ['APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'] } },
    include: { customer: true, barMarks: { include: { qcChecks: true } }, lines: true, production: { include: { user: true }, orderBy: { at: 'desc' }, take: 1 } },
    orderBy: [{ deliveryDate: 'asc' }],
  });

  const cutBent = orders.filter((o) => o.barMarks.length > 0);
  const barsOutstanding = cutBent.reduce(
    (s, o) => s + o.barMarks.filter((b) => b.status === 'Scheduled').reduce((n, b) => n + b.bars, 0), 0);
  const failed = cutBent.reduce((s, o) => s + o.barMarks.filter((b) => b.qcChecks.some((c) => !c.pass)).length, 0);
  const tonnesOut = cutBent.reduce((s, o) => s + o.barMarks.reduce((n, b) => n + Number(b.weightKg), 0), 0);

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production" alerts={alerts.length}>
      <PageHeader title="Production" blurb="What is on the shear line and the benders, and what still needs checking." />

      <StatRow>
        <Stat value={cutBent.length} label="Cut & bent orders in the yard" />
        <Stat value={barsOutstanding.toLocaleString('en-GB')} label="Bars still to cut" />
        <Stat value={tonnes(tonnesOut)} label="Tonnage in progress" />
        <Stat value={failed} label="Marks out of tolerance" tone={failed ? 'bad' : 'default'} href="/production/checks" />
      </StatRow>

      {orders.length === 0 ? <Empty title="Nothing in production. Approve an order to start it." /> : (
        <div className="space-y-4">
          {orders.map((o) => {
            const scheduled = o.barMarks.filter((b) => b.status === 'Scheduled').length;
            const checked = o.barMarks.filter((b) => b.qcChecks.length > 0).length;
            return (
              <article key={o.id} className="card card-pad flex flex-wrap items-center gap-5">
                <div className="min-w-[200px]">
                  <Link href={`/orders/${o.id}`} className="font-bold text-brand-700 hover:underline">{o.number}</Link>
                  <p className="text-sm text-ink-muted">{o.customer.name} · {o.town}</p>
                </div>
                <StagePill stage={o.stage} />
                <div className="text-sm">
                  {o.barMarks.length > 0
                    ? <>{o.barMarks.length} bar marks · {scheduled} still to run · {checked} checked</>
                    : <span className="text-ink-muted">Standard products only — no bending</span>}
                </div>
                <div className="text-sm text-ink-muted">Delivery {shortDate(o.deliveryDate)}</div>
                {o.production[0] && (
                  <Pill tone="info">{o.production[0].action} · {o.production[0].station} · {o.production[0].user?.name}</Pill>
                )}
                <div className="ml-auto flex gap-2">
                  {o.barMarks.length > 0 && (
                    <>
                      <a href={`/orders/${o.id}/bending-ticket`} className="btn-secondary btn-sm">Bending ticket</a>
                      <Link href={`/production/checks?order=${o.id}`} className="btn-primary btn-sm">Record checks</Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

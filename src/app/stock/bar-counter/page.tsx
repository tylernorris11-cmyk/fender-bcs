import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { blobFileHref } from '@/lib/blob';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { BarCounterClient } from './BarCounterClient';

export default async function BarCounterPage() {
  const user = await requirePermission('stock.goodsIn');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [orders, recent] = await Promise.all([
    db.order.findMany({
      where: { company, archived: false },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { id: true, number: true },
    }),
    db.barCount.findMany({
      where: { company },
      include: { createdBy: true, order: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/bar-counter" alerts={alerts.length}>
      <PageHeader
        title="Bar counter"
        blurb="Photograph a bundle end, let the circle detector count it, and correct it before confirming."
      />

      <BarCounterClient orders={orders} />

      <section className="card card-pad mt-6">
        <h2 className="text-lg font-bold mb-4">Recent counts</h2>
        {recent.length === 0 ? <Empty title="No counts confirmed yet." /> : (
          <ul className="divide-y divide-hairline">
            {recent.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-4">
                <a href={blobFileHref(c.photoUrl)} target="_blank" rel="noreferrer">
                  <img src={blobFileHref(c.photoUrl)} alt="" className="w-16 h-16 object-cover rounded-lg border border-hairline" />
                </a>
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold">{c.confirmedCount} bars{c.order && <> · {c.order.number}</>}</p>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {c.mode === 'CIRCLE_DETECTOR' && 'Circle detector'}
                    {c.mode === 'AI_ESTIMATE' && 'AI estimate'}
                    {c.mode === 'BOTH' && `Circle detector${c.detectedCount != null ? `: ${c.detectedCount}` : ''}${c.aiEstimateCount != null ? ` · AI estimate: ${c.aiEstimateCount}` : ''}`}
                    {' · '}{c.createdBy.name} · {shortDate(c.createdAt)} {clock(c.createdAt)}
                  </p>
                  {c.notes && <p className="text-sm text-ink-muted mt-0.5 whitespace-pre-line">{c.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

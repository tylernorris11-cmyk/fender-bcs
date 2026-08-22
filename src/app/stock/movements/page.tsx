import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, Table } from '@/components/ui';

export default async function MovementsPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);

  const movements = await db.stockMovement.findMany({
    include: { product: true, batch: true, user: true },
    orderBy: { at: 'desc' },
    take: 300,
  });

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/movements" alerts={alerts.length}>
      <PageHeader title="Stock movements" blurb="Every tonne in and out, with the cast it came from and who moved it." />
      <section className="card card-pad">
        <Table head={<>
          <th className="th">When</th><th className="th">Type</th><th className="th">Product</th>
          <th className="th">Cast</th><th className="th text-right">Qty</th><th className="th">Reference</th><th className="th">By</th>
        </>}>
          {movements.map((m) => (
            <tr key={m.id} className="row">
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(m.at)} {clock(m.at)}</td>
              <td className="td"><Pill tone={m.type === 'GOODS_IN' ? 'good' : m.type === 'PICKED' ? 'info' : 'warn'}>{m.type.replace('_', ' ').toLowerCase()}</Pill></td>
              <td className="td">{m.product.name}</td>
              <td className="td text-ink-muted">{m.batch?.heatNumber ?? '—'}</td>
              <td className="td text-right tabular-nums">{Number(m.qty).toFixed(3)}</td>
              <td className="td text-ink-muted">{m.reference || m.reason || '—'}</td>
              <td className="td text-ink-muted">{m.user?.name ?? '—'}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Shell>
  );
}

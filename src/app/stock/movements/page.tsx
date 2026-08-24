import type { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortTh, Table } from '@/components/ui';

export default async function MovementsPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';

  const orderBy: Prisma.StockMovementOrderByWithRelationInput =
    searchParams.sort === 'type' ? { type: dir }
    : searchParams.sort === 'product' ? { product: { name: dir } }
    : searchParams.sort === 'qty' ? { qty: dir }
    : { at: dir === 'asc' ? 'asc' : 'desc' };

  const movements = await db.stockMovement.findMany({
    include: { product: true, batch: true, user: true },
    orderBy,
    take: 300,
  });

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/movements" alerts={alerts.length}>
      <PageHeader title="Stock movements" blurb="Every tonne in and out, with the cast it came from and who moved it." />
      <section className="card card-pad">
        <Table head={<>
          <SortTh label="When" field="at" basePath="/stock/movements" searchParams={searchParams} />
          <SortTh label="Type" field="type" basePath="/stock/movements" searchParams={searchParams} />
          <SortTh label="Product" field="product" basePath="/stock/movements" searchParams={searchParams} />
          <th className="th">Cast</th>
          <SortTh label="Qty" field="qty" basePath="/stock/movements" searchParams={searchParams} align="right" />
          <th className="th">Reference</th><th className="th">By</th>
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

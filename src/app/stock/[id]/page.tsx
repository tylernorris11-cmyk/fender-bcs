import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { money, clock, qty as fmtQty, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, Table } from '@/components/ui';
import { setBatchStatus } from '../actions';

export default async function StockItemPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const showCosts = can(user, 'finance.costs');

  const product = await db.product.findUnique({
    where: { id: params.id },
    include: {
      batches: { include: { supplier: true }, orderBy: { receivedAt: 'asc' } },
      movements: { include: { user: true, batch: true }, orderBy: { at: 'desc' }, take: 40 },
    },
  });
  if (!product) notFound();
  if (!user.companies.includes(product.company)) notFound();

  const available = product.batches.filter((b) => b.status === 'Available').reduce((s, b) => s + Number(b.qtyRemaining), 0);
  const nextOut = product.batches.find((b) => b.status === 'Available' && Number(b.qtyRemaining) > 0);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock" alerts={alerts.length}>
      <Link href="/stock" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to stock
      </Link>

      <PageHeader
        title={product.name}
        blurb={`${product.code} · ${product.category}${product.standard ? ` · ${product.standard}` : ''}`}
        actions={can(user, 'stock.goodsIn') && (
          <Link href={`/stock/goods-in?product=${product.id}`} className="btn-primary"><Plus size={16} /> Goods in</Link>
        )}
      />

      <section className="card card-pad mb-6">
        <header className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold">Batches — oldest used first</h2>
            <p className="text-sm text-ink-muted mt-1">
              Deliveries out pick the oldest available batch, so the certificate that prints on the note is the one
              covering the steel actually loaded.
            </p>
          </div>
          <Pill tone="good">{fmtQty(available, product.unit)} available</Pill>
        </header>

        <Table head={<>
          <th className="th">Batch / heat</th><th className="th">Certificate</th><th className="th">Supplier</th>
          <th className="th">Depot</th>
          <th className="th">Received</th><th className="th text-right">Remaining</th>
          {showCosts && <th className="th text-right">Cost</th>}
          {showCosts && <th className="th text-right">Total paid</th>}
          <th className="th">Mill cert</th>
          <th className="th sr-only">Actions</th>
        </>}>
          {product.batches.map((b) => (
            <tr key={b.id} className="row">
              <td className="td">
                <span className="font-semibold">{b.heatNumber}</span>
                <span className="ml-2 inline-flex gap-1.5">
                  {b.id === nextOut?.id && <Pill tone="good">Next out</Pill>}
                  {b.status === 'Quarantined' && <Pill tone="bad">Quarantined</Pill>}
                  {b.status === 'Consumed' && <Pill>Used up</Pill>}
                </span>
                {b.quarantineRef && <span className="block text-xs text-signal mt-0.5">{b.quarantineRef}</span>}
              </td>
              <td className="td text-ink-muted">{b.certNumber || '—'}</td>
              <td className="td">{b.supplier.name}</td>
              <td className="td text-ink-muted">{b.depot}</td>
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(b.receivedAt)}</td>
              <td className="td text-right tabular-nums">{Number(b.qtyRemaining).toFixed(3)} / {Number(b.qtyReceived).toFixed(0)}</td>
              {showCosts && <td className="td text-right tabular-nums">{b.unitCost != null ? money(b.unitCost) : '—'}</td>}
              {showCosts && <td className="td text-right tabular-nums font-semibold">{b.unitCost != null ? money(Number(b.unitCost) * Number(b.qtyReceived)) : '—'}</td>}
              <td className="td">
                {b.millCertUrl
                  ? <a href={b.millCertUrl} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><FileText size={15} /> Open</a>
                  : <Pill tone="bad">Not on file</Pill>}
              </td>
              <td className="td text-right">
                {can(user, 'stock.adjust') && b.status !== 'Consumed' && (
                  <form action={setBatchStatus}>
                    <input type="hidden" name="batchId" value={b.id} />
                    <input type="hidden" name="status" value={b.status === 'Quarantined' ? 'Available' : 'Quarantined'} />
                    <input type="hidden" name="reason" value={b.status === 'Quarantined' ? 'Released after check' : 'Quarantined by hand'} />
                    <button className="btn-secondary btn-sm">{b.status === 'Quarantined' ? 'Release' : 'Quarantine'}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {product.batches.length === 0 && <tr><td colSpan={showCosts ? 9 : 7} className="td text-ink-muted">Nothing booked in against this product yet.</td></tr>}
        </Table>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">Recent movements</h2>
        <ul className="divide-y divide-hairline text-sm">
          {product.movements.map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="text-ink-muted w-32">{shortDate(m.at)} {clock(m.at)}</span>
              <Pill tone={m.type === 'GOODS_IN' ? 'good' : m.type === 'PICKED' ? 'info' : 'warn'}>
                {m.type.replace('_', ' ').toLowerCase()}
              </Pill>
              <span className="font-semibold tabular-nums">{Number(m.qty).toFixed(3)}</span>
              {m.batch && <span className="text-ink-muted">heat {m.batch.heatNumber}</span>}
              {m.reference && <span className="text-ink-muted">{m.reference}</span>}
              {m.reason && <span className="text-ink-muted italic">{m.reason}</span>}
              <span className="text-ink-faint ml-auto">{m.user?.name}</span>
            </li>
          ))}
          {product.movements.length === 0 && <li className="py-3 text-ink-muted">No movements recorded.</li>}
        </ul>
      </section>
    </Shell>
  );
}

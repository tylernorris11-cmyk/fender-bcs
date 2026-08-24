import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { poTotal, PO_NEXT_STATUS, PO_STATUS_LABEL } from '@/lib/purchaseOrders';
import { can } from '@/lib/rbac';
import { clock, money, qty, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill, Table } from '@/components/ui';
import { advancePurchaseOrderStatus, cancelPurchaseOrder } from '../actions';

const STATUS_TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  DRAFT: 'neutral', SENT: 'info', CONFIRMED: 'warn', RECEIVED: 'good', CANCELLED: 'bad',
};

export default async function PurchaseOrderPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('purchaseOrders.view');
  const alerts = await getAlerts(user);
  const showCosts = can(user, 'finance.costs');

  const po = await db.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { supplier: true, raisedBy: true, costCentre: true, lines: { orderBy: { sortOrder: 'asc' }, include: { product: true } } },
  });
  if (!po) notFound();
  if (!user.companies.includes(po.company)) notFound();

  const history = await db.activityLog.findMany({
    where: { entity: 'PurchaseOrder', entityId: po.id }, include: { user: true }, orderBy: { at: 'desc' }, take: 40,
  });

  const step = PO_NEXT_STATUS[po.status];
  const canAdvance = step && can(user, 'purchaseOrders.edit');
  const canCancel = can(user, 'purchaseOrders.edit') && po.status !== 'RECEIVED' && po.status !== 'CANCELLED';

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders" alerts={alerts.length}>
      <Link href="/purchase-orders" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to purchase orders
      </Link>

      <PageHeader
        title={po.number}
        blurb={`Raised ${shortDate(po.createdAt)}${po.raisedBy ? ` by ${po.raisedBy.name}` : ''} · ${po.supplier.name}`}
      />

      <section className="card card-pad mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Pill tone={STATUS_TONE[po.status]}>{PO_STATUS_LABEL[po.status]}</Pill>
          <div className="flex flex-wrap items-center gap-2">
            {canCancel && (
              <form action={cancelPurchaseOrder}>
                <input type="hidden" name="purchaseOrderId" value={po.id} />
                <button className="btn-danger"><Ban size={16} /> Cancel</button>
              </form>
            )}
            {canAdvance && (
              <form action={advancePurchaseOrderStatus}>
                <input type="hidden" name="purchaseOrderId" value={po.id} />
                <button className="btn-primary">{step!.label}</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Lines</h2>
        <Table
          head={
            <>
              <th className="th">Description</th>
              <th className="th text-right">Qty</th>
              {showCosts && <th className="th text-right">Cost</th>}
              {showCosts && <th className="th text-right">Total</th>}
            </>
          }
        >
          {po.lines.map((l) => (
            <tr key={l.id} className="row">
              <td className="td font-semibold">{l.description}</td>
              <td className="td text-right tabular-nums">{qty(l.qty, l.unit)}</td>
              {showCosts && <td className="td text-right tabular-nums">{money(l.unitCost)}</td>}
              {showCosts && <td className="td text-right font-semibold tabular-nums">{money(l.lineTotal)}</td>}
            </tr>
          ))}
          {po.lines.length === 0 && (
            <tr><td colSpan={showCosts ? 4 : 2} className="td text-ink-muted">No lines on this purchase order.</td></tr>
          )}
        </Table>
        {showCosts && (
          <div className="flex justify-end pt-5 mt-5 border-t border-hairline text-sm">
            <span>Total <strong className="text-base">{money(poTotal(po))}</strong></span>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Supplier</h2>
          <p className="font-semibold">{po.supplier.name}</p>
          <p className="text-sm text-ink-muted mt-1">{po.supplier.contactName} {po.supplier.phone && `· ${po.supplier.phone}`}</p>
        </section>
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Delivery</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Expected</dt><dd className="font-semibold">{shortDate(po.expectedDate)}</dd></div>
            {po.costCentre && <div className="flex justify-between gap-4"><dt className="text-ink-muted">Cost centre</dt><dd className="font-semibold">{po.costCentre.name}</dd></div>}
            {po.notes && <div><dt className="text-ink-muted">Notes</dt><dd className="mt-0.5">{po.notes}</dd></div>}
          </dl>
        </section>
      </div>

      <details className="card card-pad">
        <summary className="text-lg font-bold cursor-pointer">History</summary>
        <ul className="mt-4 space-y-3 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex items-start gap-3">
              {h.user && <Avatar name={h.user.name} colour={h.user.colour} size={26} />}
              <div>
                <p><strong>{h.action}</strong>{h.detail && <span className="text-ink-muted"> — {h.detail}</span>}</p>
                <p className="text-xs text-ink-faint">{h.user?.name ?? 'System'} · {shortDate(h.at)} {clock(h.at)}</p>
              </div>
            </li>
          ))}
          {history.length === 0 && <li className="text-ink-muted">Nothing recorded yet.</li>}
        </ul>
      </details>
    </Shell>
  );
}

import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortSelect } from '@/components/ui';
import { closeNcr, raiseNcr } from '../actions';

const TYPE_LABEL = {
  CUSTOMER_COMPLAINT: 'Customer complaint',
  INTERNAL: 'Internal',
  SUPPLIER_ISSUE: 'Supplier issue',
} as const;

const NCR_SORTS: Record<string, Prisma.NcrOrderByWithRelationInput[]> = {
  open: [{ status: 'asc' }, { raisedAt: 'desc' }],
  newest: [{ raisedAt: 'desc' }],
  oldest: [{ raisedAt: 'asc' }],
  ref: [{ ref: 'asc' }],
};

export default async function NcrPage({ searchParams }: { searchParams: { raise?: string; sort?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);

  const [ncrs, orders, customers, suppliers, batches] = await Promise.all([
    db.ncr.findMany({
      include: { order: true, customer: true, batch: true, supplier: true, raisedBy: true },
      orderBy: NCR_SORTS[searchParams.sort ?? 'open'] ?? NCR_SORTS.open,
    }),
    db.order.findMany({ where: { archived: false }, orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, number: true } }),
    db.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.batch.findMany({ where: { status: { in: ['Available', 'Quarantined'] } }, select: { id: true, heatNumber: true }, orderBy: { receivedAt: 'desc' } }),
  ]);

  const open = ncrs.filter((n) => n.status === 'OPEN');
  const showForm = searchParams.raise === '1';

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/ncr" alerts={alerts.length}>
      <PageHeader
        title="Non-conformance"
        actions={can(user, 'compliance.ncr') && !showForm && (
          <Link href="/compliance/ncr?raise=1" className="btn-primary"><Plus size={16} /> Raise a record</Link>
        )}
      />

      <p className="text-ink-muted max-w-2xl mb-5">
        The CARES scheme requires a record of <strong className="text-ink">non-conforming steel and complaints</strong> —
        customer complaints, internal catches, and problems with suppliers — each with the corrective action taken.
        Auditors read this register first.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          <Pill tone={open.length ? 'warn' : 'good'}>{open.length} open</Pill>
          <Pill>{ncrs.length - open.length} closed</Pill>
        </div>
        <form className="flex gap-2">
          <SortSelect
            value={searchParams.sort}
            label="Sort"
            options={[
              { value: 'open', label: 'Open first' },
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
              { value: 'ref', label: 'Ref A-Z' },
            ]}
          />
          <button className="btn-secondary btn-sm">Apply</button>
        </form>
      </div>

      {showForm && can(user, 'compliance.ncr') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">Raise a non-conformance</h2>
          <form action={raiseNcr} className="grid gap-4 sm:grid-cols-2 max-w-3xl">
            <div>
              <label className="label" htmlFor="type">What kind</label>
              <select id="type" name="type" className="input">
                <option value="CUSTOMER_COMPLAINT">Customer complaint</option>
                <option value="INTERNAL">Internal — caught here</option>
                <option value="SUPPLIER_ISSUE">Supplier issue</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="orderId">Order (if it relates to one)</label>
              <select id="orderId" name="orderId" className="input">
                <option value="">Not order-related</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="customerId">Customer</label>
              <select id="customerId" name="customerId" className="input">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="supplierId">Supplier</label>
              <select id="supplierId" name="supplierId" className="input">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="batchId">Cast / batch</label>
              <select id="batchId" name="batchId" className="input">
                <option value="">—</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.heatNumber}</option>)}
              </select>
              <p className="hint">A supplier issue with a cast named here quarantines that steel straight away.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">What went wrong</label>
              <textarea id="description" name="description" rows={3} required className="input"
                        placeholder="Six bars in bundle B02 bent to 480mm 'B' dimension instead of 420mm." />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="rootCause">Root cause, if known yet</label>
              <input id="rootCause" name="rootCause" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="correctiveAction">Corrective action so far</label>
              <textarea id="correctiveAction" name="correctiveAction" rows={2} className="input"
                        placeholder="You can leave this now and fill it in when you close the record." />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button className="btn-primary">Raise it</button>
              <Link href="/compliance/ncr" className="btn-secondary">Cancel</Link>
            </div>
          </form>
        </section>
      )}

      <div className="space-y-3">
        {ncrs.map((n) => (
          <article key={n.id} className="card p-4 sm:p-5">
            <header className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{n.ref}</h2>
                  <Pill tone={n.type === 'CUSTOMER_COMPLAINT' ? 'bad' : n.type === 'SUPPLIER_ISSUE' ? 'warn' : 'info'}>
                    {TYPE_LABEL[n.type]}
                  </Pill>
                  {n.status === 'OPEN'
                    ? <Pill tone="warn">Open</Pill>
                    : <Pill tone="good">Closed {shortDate(n.closedAt)}</Pill>}
                </div>
                <p className="text-sm text-ink-faint mt-1">
                  Raised {shortDate(n.raisedAt)} by {n.raisedBy?.name ?? 'unknown'}
                  {n.customer && ` · ${n.customer.name}`}
                  {n.order && <> · <Link href={`/orders/${n.order.id}`} className="hover:underline">{n.order.number}</Link></>}
                  {n.batch && ` · cast ${n.batch.heatNumber}`}
                  {n.supplier && ` · ${n.supplier.name}`}
                </p>
              </div>
            </header>

            <p>{n.description}</p>
            {n.rootCause && <p className="text-sm text-ink-muted mt-2"><strong>Root cause:</strong> {n.rootCause}</p>}

            {n.correctiveAction && (
              <p className="bg-brand-50 border border-brand/20 rounded-xl px-4 py-3 mt-3 text-sm">
                <strong className="text-forest">Corrective action:</strong> {n.correctiveAction}
              </p>
            )}

            {n.status === 'OPEN' && can(user, 'compliance.ncr') && (
              <form action={closeNcr} className="mt-4 flex flex-col sm:flex-row gap-3">
                <input type="hidden" name="ncrId" value={n.id} />
                <input name="correctiveAction" defaultValue={n.correctiveAction} required className="input flex-1"
                       placeholder="What was done to put it right and stop it happening again" />
                <button className="btn-secondary">Close it off</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </Shell>
  );
}

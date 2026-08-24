import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, StagePill } from '@/components/ui';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const q = (searchParams.q ?? '').trim();
  const like = { contains: q, mode: 'insensitive' as const };
  const company = getActiveCompany(user);

  const [orders, customers, batches, assets, suppliers, certificates, ncrs, products, purchaseOrders] = q
    ? await Promise.all([
        can(user, 'orders.view')
          ? db.order.findMany({ where: { company, OR: [{ number: like }, { poNumber: like }, { customer: { name: like } }] }, include: { customer: true }, take: 15 })
          : [],
        can(user, 'customers.view')
          ? db.customer.findMany({ where: { company, OR: [{ name: like }, { contactName: like }, { town: like }, { code: like }] }, take: 15 })
          : [],
        can(user, 'stock.view')
          ? db.batch.findMany({ where: { company, OR: [{ heatNumber: like }, { certNumber: like }] }, include: { product: true, supplier: true }, take: 15 })
          : [],
        can(user, 'assets.view')
          ? db.asset.findMany({ where: { OR: [{ ref: like }, { name: like }, { category: like }] }, take: 15 })
          : [],
        can(user, 'compliance.view')
          ? db.supplier.findMany({ where: { company, name: like }, take: 15 })
          : [],
        can(user, 'compliance.view')
          ? db.certificate.findMany({ where: { company, OR: [{ title: like }, { reference: like }] }, include: { supplier: true }, take: 15 })
          : [],
        can(user, 'compliance.view')
          ? db.ncr.findMany({ where: { company, OR: [{ ref: like }, { description: like }] }, take: 15 })
          : [],
        can(user, 'stock.view')
          ? db.product.findMany({ where: { company, OR: [{ code: like }, { name: like }] }, take: 15 })
          : [],
        can(user, 'purchaseOrders.view')
          ? db.purchaseOrder.findMany({ where: { company, number: like }, include: { supplier: true }, take: 15 })
          : [],
      ])
    : [[], [], [], [], [], [], [], [], []];

  const nothing =
    orders.length + customers.length + batches.length + assets.length + suppliers.length +
    certificates.length + ncrs.length + products.length + purchaseOrders.length === 0;

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders" alerts={alerts.length}>
      <PageHeader title={q ? `Results for “${q}”` : 'Search'} />

      {!q && (
        <Empty title="Type into the search box at the top to look across orders, purchase orders, customers, stock, assets, suppliers, certificates and NCRs." />
      )}
      {q && nothing && <Empty title="Nothing found. Try an order number, customer name, cast number, asset ref, supplier or certificate." />}

      {orders.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Orders</h2>
          <ul className="divide-y divide-hairline">
            {orders.map((o) => (
              <li key={o.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link>
                <span className="text-ink-muted">{o.customer.name}</span>
                <StagePill stage={o.stage} />
                <span className="text-ink-faint ml-auto">{shortDate(o.deliveryDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customers.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Customers</h2>
          <ul className="divide-y divide-hairline">
            {customers.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/customers/${c.id}`} className="font-semibold text-brand-700 hover:underline">{c.name}</Link>
                <span className="text-ink-muted">{c.contactName} · {c.town}</span>
                <Pill tone={c.status === 'Active' ? 'good' : 'warn'}>{c.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      {batches.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Casts and batches</h2>
          <ul className="divide-y divide-hairline">
            {batches.map((b) => (
              <li key={b.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/compliance/trace?q=${b.heatNumber}`} className="font-semibold text-brand-700 hover:underline">{b.heatNumber}</Link>
                <span className="text-ink-muted">{b.product.name} · {b.supplier.name}</span>
                <Pill tone={b.status === 'Available' ? 'good' : b.status === 'Quarantined' ? 'bad' : 'neutral'}>{b.status}</Pill>
                <span className="text-ink-faint ml-auto">received {shortDate(b.receivedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {purchaseOrders.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Purchase orders</h2>
          <ul className="divide-y divide-hairline">
            {purchaseOrders.map((po) => (
              <li key={po.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/purchase-orders/${po.id}`} className="font-semibold text-brand-700 hover:underline">{po.number}</Link>
                <span className="text-ink-muted">{po.supplier.name}</span>
                <Pill>{po.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Products</h2>
          <ul className="divide-y divide-hairline">
            {products.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/stock/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.code}</Link>
                <span className="text-ink-muted">{p.name}</span>
                <span className="text-ink-faint ml-auto">{p.category}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assets.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Assets</h2>
          <ul className="divide-y divide-hairline">
            {assets.map((a) => (
              <li key={a.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href={`/assets/${a.id}`} className="font-semibold text-brand-700 hover:underline">{a.ref}</Link>
                <span className="text-ink-muted">{a.name} · {a.category}</span>
                {a.retired && <Pill>Retired</Pill>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {suppliers.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Suppliers</h2>
          <ul className="divide-y divide-hairline">
            {suppliers.map((s) => (
              <li key={s.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href="/compliance/suppliers" className="font-semibold text-brand-700 hover:underline">{s.name}</Link>
                <span className="text-ink-muted">{s.approvedFor || '—'}</span>
                {s.blocked && <Pill tone="bad">Blocked</Pill>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {certificates.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Certificates</h2>
          <ul className="divide-y divide-hairline">
            {certificates.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href="/compliance/certificates" className="font-semibold text-brand-700 hover:underline">{c.title}</Link>
                <span className="text-ink-muted">{c.scheme} · {c.holder}</span>
                <span className="text-ink-faint ml-auto">expires {shortDate(c.expiresOn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ncrs.length > 0 && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Non-conformances</h2>
          <ul className="divide-y divide-hairline">
            {ncrs.map((n) => (
              <li key={n.id} className="py-3 flex flex-wrap items-center gap-3">
                <Link href="/compliance/ncr" className="font-semibold text-brand-700 hover:underline">{n.ref}</Link>
                <span className="text-ink-muted">{n.description.slice(0, 80)}</span>
                <Pill tone={n.status === 'OPEN' ? 'warn' : 'good'}>{n.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

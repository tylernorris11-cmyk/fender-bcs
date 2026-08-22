import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, StagePill } from '@/components/ui';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const q = (searchParams.q ?? '').trim();
  const like = { contains: q, mode: 'insensitive' as const };

  const [orders, customers, batches] = q
    ? await Promise.all([
        can(user, 'orders.view')
          ? db.order.findMany({ where: { OR: [{ number: like }, { poNumber: like }, { customer: { name: like } }] }, include: { customer: true }, take: 15 })
          : [],
        can(user, 'customers.view')
          ? db.customer.findMany({ where: { OR: [{ name: like }, { contactName: like }, { town: like }, { code: like }] }, take: 15 })
          : [],
        can(user, 'stock.view')
          ? db.batch.findMany({ where: { OR: [{ heatNumber: like }, { certNumber: like }] }, include: { product: true, supplier: true }, take: 15 })
          : [],
      ])
    : [[], [], []];

  const nothing = orders.length + customers.length + batches.length === 0;

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders" alerts={alerts.length}>
      <PageHeader title={q ? `Results for “${q}”` : 'Search'} />

      {!q && <Empty title="Type into the search box at the top to look across orders, customers and casts." />}
      {q && nothing && <Empty title="Nothing found. Try an order number, a customer name or a cast number." />}

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
        <section className="card card-pad">
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
    </Shell>
  );
}

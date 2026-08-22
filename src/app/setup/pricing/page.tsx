import { Info } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { money, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Table } from '@/components/ui';
import { setPrice } from '../actions';

export default async function PricingPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requirePermission('setup.pricing');
  const alerts = await getAlerts(user);
  const q = (searchParams.q ?? '').trim();

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { prices: { orderBy: [{ minQty: 'asc' }, { effectiveFrom: 'desc' }] } },
  });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/pricing" alerts={alerts.length}>
      <PageHeader title="Set Up" blurb="Pricing, people and the lists the rest of the system runs on." />

      <p className="banner-ok mb-6">
        <Info size={18} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          These selling prices feed every new order line — one price, or quantity bands.{' '}
          <strong>Purchase costs are never stored here.</strong> They live on a separate table only an administrator can read,
          so nobody working an order can see what the steel cost to buy.
        </span>
      </p>

      <form className="mb-5">
        <input name="q" defaultValue={q} className="input max-w-md" placeholder="Search product or code…" aria-label="Search products" />
      </form>

      <section className="card card-pad">
        <Table head={<>
          <th className="th">Product</th><th className="th">Category</th><th className="th">Pricing</th>
          <th className="th">Effective</th><th className="th">Set by</th><th className="th sr-only">Change</th>
        </>}>
          {products.map((p) => {
            const base = p.prices.find((x) => Number(x.minQty) === 0);
            const bands = p.prices.filter((x) => Number(x.minQty) > 0);
            return (
              <tr key={p.id} className="row">
                <td className="td">
                  <span className="font-semibold">{p.name}</span>
                  <span className="block text-xs text-ink-faint">{p.code}</span>
                </td>
                <td className="td text-ink-muted">{p.category}</td>
                <td className="td">
                  <span className="font-semibold">{base ? `${money(base.unitPrice)} / ${p.unit}` : 'No price set'}</span>
                  {bands.map((b) => (
                    <span key={b.id} className="block text-xs text-ink-muted">
                      {money(b.unitPrice)} from {Number(b.minQty)} {p.unit}
                    </span>
                  ))}
                </td>
                <td className="td text-ink-muted whitespace-nowrap">{shortDate(base?.effectiveFrom)}</td>
                <td className="td text-ink-muted">{base?.setByName ?? '—'}</td>
                <td className="td">
                  {can(user, 'setup.pricing') && (
                    <form action={setPrice} className="flex gap-2 justify-end">
                      <input type="hidden" name="productId" value={p.id} />
                      <input name="unitPrice" type="number" step="0.01" min="0" required
                             className="input w-28 py-1.5" placeholder="New £" aria-label={`New price for ${p.name}`} />
                      <input name="minQty" type="number" step="0.001" min="0" defaultValue="0"
                             className="input w-24 py-1.5" aria-label={`Quantity band start for ${p.name}`} />
                      <button className="btn-secondary btn-sm">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        <p className="hint mt-4">
          Leave the quantity box at 0 for the standard price. Put a number in to add a band — that price applies once the
          order line reaches that quantity. Old prices are kept so an old order still shows what was charged at the time.
        </p>
      </section>
    </Shell>
  );
}

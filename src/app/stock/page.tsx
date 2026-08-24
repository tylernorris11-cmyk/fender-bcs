import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { qty as fmtQty } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortSelect, Stat, StatRow } from '@/components/ui';

export default async function StockPage({ searchParams }: { searchParams: { category?: string; sort?: string; depot?: string } }) {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const caresApplies = company === 'FENDER';
  const depot = searchParams.depot;

  const [products, locations] = await Promise.all([
    db.product.findMany({
      where: { company, active: true, ...(searchParams.category ? { category: searchParams.category } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { batches: { where: { status: { in: ['Available', 'Quarantined'] }, ...(depot ? { depot } : {}) } } },
    }),
    db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  const availableOf = (p: (typeof products)[number]) =>
    p.batches.filter((b) => b.status === 'Available').reduce((s, b) => s + Number(b.qtyRemaining), 0);

  const liveBatches = products.reduce((s, p) => s + p.batches.length, 0);
  const missingCerts = products.reduce((s, p) => s + p.batches.filter((b) => !b.millCertUrl).length, 0);
  const quarantinedCount = products.reduce((s, p) => s + p.batches.filter((b) => b.status === 'Quarantined').length, 0);
  const lowStock = products.filter((p) => {
    const available = p.batches.filter((b) => b.status === 'Available').reduce((s, b) => s + Number(b.qtyRemaining), 0);
    return Number(p.reorderAt) > 0 && available <= Number(p.reorderAt);
  }).length;

  const byCategory = products.reduce<Record<string, typeof products>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  if (searchParams.sort === 'qty') {
    for (const items of Object.values(byCategory)) items.sort((a, b) => availableOf(a) - availableOf(b));
  }

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock" alerts={alerts.length}>
      <PageHeader
        title="Stock"
        blurb={caresApplies ? 'Tap a product to see its batches and certificates.' : 'Tap a product to see its batches.'}
        actions={can(user, 'stock.goodsIn') && (
          <Link href="/stock/goods-in" className="btn-primary"><Plus size={16} /> {caresApplies ? 'Book steel in' : 'Book stock in'}</Link>
        )}
      />

      <StatRow>
        <Stat value={products.length} label="Stock items" />
        <Stat value={liveBatches} label="Live batches" />
        <Stat value={lowStock} label="Low stock" tone={lowStock ? 'warn' : 'default'} />
        {caresApplies ? (
          <Stat value={missingCerts} label="Missing certificates" tone={missingCerts ? 'bad' : 'default'} />
        ) : (
          <Stat value={quarantinedCount} label="Quarantined" tone={quarantinedCount ? 'warn' : 'default'} />
        )}
      </StatRow>

      <nav className="flex flex-wrap gap-2 mb-4" aria-label="Filter by depot">
        <Link href="/stock" className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${!depot ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'}`}>
          Both depots
        </Link>
        {locations.map((l) => (
          <Link key={l.id} href={`/stock?depot=${encodeURIComponent(l.name)}`}
            className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${depot === l.name ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'}`}>
            {l.name}
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex justify-end gap-2">
        {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
        {depot && <input type="hidden" name="depot" value={depot} />}
        <SortSelect
          value={searchParams.sort}
          label="Sort within category"
          options={[{ value: 'name', label: 'Name A-Z' }, { value: 'qty', label: 'Available qty, low first' }]}
        />
        <button className="btn-secondary">Apply</button>
      </form>

      <section className="card overflow-hidden">
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category}>
            <h2 className="bg-canvas px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{category}</h2>
            {items.map((p) => {
              const available = availableOf(p);
              const quarantined = p.batches.filter((b) => b.status === 'Quarantined').length;
              const low = Number(p.reorderAt) > 0 && available <= Number(p.reorderAt);
              return (
                <Link key={p.id} href={`/stock/${p.id}`} className="flex items-center gap-4 px-4 py-2.5 border-t border-hairline hover:bg-canvas transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-ink-faint">{p.code}{p.standard && ` · ${p.standard}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {quarantined > 0 && <Pill tone="warn">{quarantined} quarantined</Pill>}
                    {low && <Pill tone="bad">Low</Pill>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmtQty(available, p.unit)}</p>
                    <p className="text-xs text-ink-faint">{p.batches.length} {p.batches.length === 1 ? 'batch' : 'batches'}</p>
                  </div>
                  <ChevronRight size={18} className="text-ink-faint" aria-hidden />
                </Link>
              );
            })}
          </div>
        ))}
      </section>
    </Shell>
  );
}

import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, feetInches, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { StockLengthChip, type StockLengthChipData } from './StockLengthChip';

export default async function StockLengthsPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="stock" nav={NAV.stock} current="/stock/lengths" alerts={alerts.length}>
        <PageHeader title="Stock Lengths" />
        <div className="banner-warn">Stock lengths are a BCS Products thing — Fender doesn&apos;t use this.</div>
      </Shell>
    );
  }

  const bundles = await db.stockLength.findMany({
    where: { company },
    orderBy: [{ lengthFt: 'asc' }, { lengthIn: 'asc' }, { thicknessMm: 'asc' }, { tag: 'asc' }],
    include: { producedBy: { select: { name: true } } },
  });

  const canAdjust = can(user, 'stock.adjust');
  const chipData: Record<string, StockLengthChipData> = Object.fromEntries(
    bundles.map((b) => [
      b.id,
      {
        id: b.id,
        tag: b.tag,
        lengthLabel: feetInches(b.lengthFt, b.lengthIn),
        thicknessMm: Number(b.thicknessMm),
        weightKg: Number(b.weightKg),
        note: b.note,
        producedLabel: `${shortDate(b.producedAt)} at ${clock(b.producedAt)}`,
        producedByName: b.producedBy?.name ?? null,
      },
    ]),
  );

  const totalWeightKg = bundles.reduce((s, b) => s + Number(b.weightKg ?? 0), 0);

  // One section per length/thickness spec, same idea as Coil Stock grouping
  // by diameter — a spec is whatever's actually in stock, not a fixed list.
  const specKey = (b: { lengthFt: number; lengthIn: number; thicknessMm: unknown }) =>
    `${b.lengthFt}-${b.lengthIn}-${Number(b.thicknessMm)}`;
  const specs = [...new Map(bundles.map((b) => [specKey(b), { lengthFt: b.lengthFt, lengthIn: b.lengthIn, thicknessMm: Number(b.thicknessMm) }])).values()];
  const bundlesFor = (spec: { lengthFt: number; lengthIn: number; thicknessMm: number }) =>
    bundles.filter((b) => b.lengthFt === spec.lengthFt && b.lengthIn === spec.lengthIn && Number(b.thicknessMm) === spec.thicknessMm);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/lengths" alerts={alerts.length}>
      <PageHeader
        title="Stock Lengths"
        blurb="Steel rod cut ahead of any specific order and held ready in the yard, one tag per bundle. Add to it from Production — Produce stock lengths."
      />

      <StatRow>
        <Stat value={bundles.length} label="Bundles in stock" />
        <Stat value={tonnes(totalWeightKg)} label="Total weight" />
        <Stat value={specs.length} label="Specs in stock" />
      </StatRow>

      {bundles.length === 0 ? (
        <div className="card card-pad text-center text-ink-muted py-12">
          Nothing in stock yet — produce some from Production.
        </div>
      ) : (
        <div className="space-y-6">
          {specs.map((spec) => {
            const inSpec = bundlesFor(spec);
            const specWeightKg = inSpec.reduce((s, b) => s + Number(b.weightKg ?? 0), 0);
            return (
              <section key={specKey(spec)} className="card card-pad">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-bold">{feetInches(spec.lengthFt, spec.lengthIn)} × {spec.thicknessMm}mm</h2>
                  <span className="text-sm text-ink-muted">{inSpec.length} · {tonnes(specWeightKg)}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {inSpec.map((b) => (
                    <StockLengthChip key={b.id} bundle={chipData[b.id]} canAdjust={canAdjust} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-faint mt-4">
        <Link href="/stock" className="hover:underline">← Back to stock</Link>
      </p>
    </Shell>
  );
}

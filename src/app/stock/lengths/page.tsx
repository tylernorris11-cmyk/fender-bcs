import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, feetInches, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addExistingStockLength } from './actions';
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
        identityNumber: b.identityNumber,
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
        blurb="Steel rod cut ahead of any specific order and held ready in the yard, one tag per bundle. Add fresh cuts from Production — Produce stock lengths — or a bundle already in stock below."
      />

      <StatRow>
        <Stat value={bundles.length} label="Bundles in stock" />
        <Stat value={tonnes(totalWeightKg)} label="Total weight" />
        <Stat value={specs.length} label="Specs in stock" />
      </StatRow>

      {canAdjust && (
        <div className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Add a bundle already in stock</h2>
          <p className="text-sm text-ink-muted mb-3">
            For a bundle that&apos;s already cut and counted rather than fresh from Production — a stocktake catch-up, or one already carrying its own identity number.
          </p>
          <form action={addExistingStockLength} className="flex flex-wrap items-end gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="existingLengthFt">Length (ft)</label>
                <input id="existingLengthFt" name="lengthFt" type="number" min="1" step="1" required className="input w-24" />
              </div>
              <div>
                <label className="label" htmlFor="existingLengthIn">+ inches</label>
                <input id="existingLengthIn" name="lengthIn" type="number" min="0" max="11" step="1" defaultValue={0} className="input w-20" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="existingThicknessMm">Thickness (mm)</label>
              <input id="existingThicknessMm" name="thicknessMm" type="number" min="0" step="0.1" required className="input w-28" />
            </div>
            <div>
              <label className="label" htmlFor="existingWeightKg">Weight (kg)</label>
              <input id="existingWeightKg" name="weightKg" type="number" min="0.1" step="0.1" required className="input w-28" />
            </div>
            <div>
              <label className="label" htmlFor="existingIdentityNumber">Identity number (optional)</label>
              <input id="existingIdentityNumber" name="identityNumber" className="input w-36" placeholder="FS-26-05301" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="label" htmlFor="existingNote">Note (optional)</label>
              <input id="existingNote" name="note" className="input" />
            </div>
            <SubmitButton className="btn-secondary" pendingLabel="Adding…">Add to stock</SubmitButton>
          </form>
        </div>
      )}

      {bundles.length === 0 ? (
        <div className="card card-pad text-center text-ink-muted py-12">
          Nothing in stock yet — produce some from Production, or add a bundle already in stock above.
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

import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { CoilChip, type CoilChipData } from './CoilChip';

const GRADES = ['SOFT', 'MEDIUM', 'HIGH_CARBON'] as const;
const GRADE_LABEL = { SOFT: 'Soft', MEDIUM: 'Medium', HIGH_CARBON: 'High carbon' } as const;

export default async function CoilStockPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="stock" nav={NAV.stock} current="/stock/coils/stock" alerts={alerts.length}>
        <PageHeader title="Coil Stock" />
        <div className="banner-warn">Coil stock is a BCS Products thing — Fender doesn&apos;t use this.</div>
      </Shell>
    );
  }

  const inStock = await db.coil.findMany({
    where: { company, receivedAt: { not: null } },
    orderBy: { ref: 'asc' },
    include: { allocatedBy: { select: { name: true } }, receivedBy: { select: { name: true } } },
  });

  const canAdjust = can(user, 'stock.adjust');
  const chipData: Record<string, CoilChipData> = Object.fromEntries(
    inStock.map((c) => [
      c.id,
      {
        id: c.id,
        ref: c.ref,
        grade: c.grade,
        diameterMm: Number(c.diameterMm),
        weightKg: Number(c.weightKg),
        note: c.note,
        receivedLabel: c.receivedAt ? `${shortDate(c.receivedAt)} at ${clock(c.receivedAt)}` : '—',
        receivedByName: c.receivedBy?.name ?? null,
        allocatedLabel: `${shortDate(c.allocatedAt)} at ${clock(c.allocatedAt)}`,
        allocatedByName: c.allocatedBy?.name ?? null,
      },
    ]),
  );

  const totalWeightKg = inStock.reduce((s, c) => s + Number(c.weightKg ?? 0), 0);

  // Grouped the same way the yard's own whiteboard tally is laid out —
  // one section per diameter, a column per grade within it. Diameters are
  // whatever's actually in stock, not a fixed list, so a new size just
  // shows up as its own section the first time one's received.
  const diameters = [...new Set(inStock.map((c) => Number(c.diameterMm)))].sort((a, b) => a - b);
  const cellFor = (dia: number, grade: (typeof GRADES)[number]) =>
    inStock.filter((c) => Number(c.diameterMm) === dia && c.grade === grade);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/coils/stock" alerts={alerts.length}>
      <PageHeader
        title="Coil Stock"
        blurb="What's actually on hand, by diameter and grade — same layout as the board. Add new coils from Add Coils."
      />

      <StatRow>
        <Stat value={inStock.length} label="Coils in stock" />
        <Stat value={tonnes(totalWeightKg)} label="Total weight" />
        <Stat value={diameters.length} label="Diameters in stock" />
      </StatRow>

      {inStock.length === 0 ? (
        <div className="card card-pad text-center text-ink-muted py-12">
          Nothing in stock yet. <Link href="/stock/coils" className="text-brand-700 font-semibold hover:underline">Add Coils</Link> to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {diameters.map((dia) => {
            const diaWeightKg = inStock.filter((c) => Number(c.diameterMm) === dia).reduce((s, c) => s + Number(c.weightKg ?? 0), 0);
            return (
              <section key={dia} className="card card-pad">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-bold">{dia} mm</h2>
                  <span className="text-sm text-ink-muted">{tonnes(diaWeightKg)}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {GRADES.map((grade) => {
                    const coils = cellFor(dia, grade);
                    return (
                      <div key={grade} className="rounded-xl border border-hairline p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
                          {GRADE_LABEL[grade]} · {coils.length}
                        </p>
                        {coils.length === 0 ? (
                          <p className="text-sm text-ink-faint">None in stock</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {coils.map((c) => (
                              <CoilChip key={c.id} coil={chipData[c.id]} canAdjust={canAdjust} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

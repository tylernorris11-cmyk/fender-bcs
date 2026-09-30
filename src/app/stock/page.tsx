import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { SteelGauge } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { tonnes } from '@/lib/format';
import { GAUGE_ITEM, GAUGE_LABEL, GAUGE_PATH, HEAVY_GAUGE_DIAMETERS, LIGHT_GAUGE_DIAMETERS } from '@/lib/steelStock';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';

export default async function StockPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  // Coils are BCS's day-to-day stock — the Stock tile leads straight there
  // rather than an overview, same reasoning as trimming it off their Stock menu.
  if (getActiveCompany(user) === 'BS_SUPPLIES') redirect('/stock/coils/stock');

  // Fender's stock is two sections: light gauge coils and heavy gauge
  // bundles. This is the at-a-glance total of each, per size.
  const totals = await db.steelStockItem.groupBy({
    by: ['gauge', 'diameterMm'],
    where: { company: 'FENDER' },
    _count: { _all: true },
    _sum: { weightKg: true },
  });
  const countOf = (gauge: SteelGauge, dia?: number) =>
    totals.filter((t) => t.gauge === gauge && (dia === undefined || t.diameterMm === dia)).reduce((s, t) => s + t._count._all, 0);
  const weightOf = (gauge: SteelGauge, dia?: number) =>
    totals.filter((t) => t.gauge === gauge && (dia === undefined || t.diameterMm === dia)).reduce((s, t) => s + Number(t._sum.weightKg ?? 0), 0);

  const sections: { gauge: SteelGauge; diameters: number[] }[] = [
    { gauge: 'LIGHT', diameters: LIGHT_GAUGE_DIAMETERS },
    { gauge: 'HEAVY', diameters: HEAVY_GAUGE_DIAMETERS },
  ];

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock" alerts={alerts.length}>
      <PageHeader title="Stock" blurb="Light gauge coils and heavy gauge bundles. Open a section to see every coil or bundle by cast number, or to add more." />

      <StatRow>
        <Stat value={countOf('LIGHT')} label="Light gauge coils" />
        <Stat value={tonnes(weightOf('LIGHT'))} label="Light gauge weight" />
        <Stat value={countOf('HEAVY')} label="Heavy gauge bundles" />
        <Stat value={tonnes(weightOf('HEAVY'))} label="Heavy gauge weight" />
      </StatRow>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ gauge, diameters }) => (
          <Link key={gauge} href={GAUGE_PATH[gauge]} className="card overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h2 className="text-lg font-bold">{GAUGE_LABEL[gauge]}</h2>
              <ChevronRight size={18} className="text-ink-faint" aria-hidden />
            </div>
            {diameters.map((dia) => {
              const n = countOf(gauge, dia);
              return (
                <div key={dia} className="flex items-center justify-between px-4 py-2.5 border-t border-hairline first:border-t-0">
                  <span className="font-semibold">{dia}mm</span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {n} {n === 1 ? GAUGE_ITEM[gauge] : `${GAUGE_ITEM[gauge]}s`} · {tonnes(weightOf(gauge, dia))}
                  </span>
                </div>
              );
            })}
          </Link>
        ))}
      </div>
    </Shell>
  );
}

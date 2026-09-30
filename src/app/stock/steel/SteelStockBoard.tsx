import type { SteelGauge } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { clock, shortDate, tonnes } from '@/lib/format';
import {
  GAUGE_ITEM, GAUGE_LABEL, GAUGE_PATH, HEAVY_GAUGE_DIAMETERS, HEAVY_GAUGE_LENGTHS, LIGHT_GAUGE_DIAMETERS, steelSizeLabel,
} from '@/lib/steelStock';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addSteelStock } from './actions';
import { SteelChip, type SteelChipData } from './SteelChip';

/**
 * The light or heavy gauge stock board: one section per diameter, every coil
 * or bundle as its own chip under its cast number, and a form to book more
 * in. Light gauge is coils; heavy gauge is bundles of straight bar, split
 * into a column per length.
 */
export async function SteelStockBoard({ gauge }: { gauge: SteelGauge }) {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const current = GAUGE_PATH[gauge];
  const title = GAUGE_LABEL[gauge];
  const item = GAUGE_ITEM[gauge];

  if (getActiveCompany(user) !== 'FENDER') {
    return (
      <Shell user={user} module="stock" nav={NAV.stock} current={current} alerts={alerts.length}>
        <PageHeader title={title} />
        <div className="banner-warn">Light and heavy gauge stock is a Fender Steel thing. Switch to Fender Steel at the top to see it.</div>
      </Shell>
    );
  }

  const items = await db.steelStockItem.findMany({
    where: { company: 'FENDER', gauge },
    orderBy: [{ diameterMm: 'asc' }, { addedAt: 'asc' }],
    include: { addedBy: { select: { name: true } } },
  });

  // A confirmed cast number on an uploaded test certificate is what puts
  // the certificate "on file" for a coil or bundle of that cast.
  const certs = items.length
    ? await db.extractedCastNumber.findMany({
        where: { confirmed: true, certificate: { company: 'FENDER' }, OR: items.map((i) => ({ castNumber: { equals: i.castNumber, mode: 'insensitive' as const } })) },
        include: { certificate: { select: { fileUrl: true } } },
      })
    : [];
  const certFor = new Map(certs.map((c) => [c.castNumber.toUpperCase(), blobFileHref(c.certificate.fileUrl)]));

  const chip = (i: (typeof items)[number]): SteelChipData => ({
    id: i.id,
    castNumber: i.castNumber,
    sizeLabel: steelSizeLabel(i),
    weightKg: Number(i.weightKg),
    note: i.note,
    addedLabel: `${shortDate(i.addedAt)} at ${clock(i.addedAt)}`,
    addedByName: i.addedBy?.name ?? null,
    certHref: certFor.get(i.castNumber.toUpperCase()) ?? null,
  });

  const canAdd = can(user, 'stock.goodsIn');
  const canAdjust = can(user, 'stock.adjust');
  const diameters = gauge === 'LIGHT' ? LIGHT_GAUGE_DIAMETERS : HEAVY_GAUGE_DIAMETERS;
  const weight = (list: typeof items) => list.reduce((s, i) => s + Number(i.weightKg), 0);
  const noCert = items.filter((i) => !certFor.has(i.castNumber.toUpperCase())).length;

  const chipGrid = (list: typeof items) =>
    list.length === 0 ? (
      <p className="text-sm text-ink-faint">None in stock</p>
    ) : (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {list.map((i) => <SteelChip key={i.id} item={chip(i)} canAdjust={canAdjust} />)}
      </div>
    );

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current={current} alerts={alerts.length}>
      <PageHeader
        title={title}
        blurb={gauge === 'LIGHT'
          ? 'Every coil on hand, by size and cast number. Tap one for its details and certificate.'
          : 'Every bundle of straight bar on hand, by size, length and cast number. Tap one for its details and certificate.'}
      />

      <StatRow>
        <Stat value={items.length} label={`${item[0].toUpperCase()}${item.slice(1)}s in stock`} />
        <Stat value={tonnes(weight(items))} label="Total weight" />
        <Stat value={noCert} label="Without a certificate on file" tone={noCert ? 'warn' : 'default'} />
      </StatRow>

      {canAdd && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Add a {item}</h2>
          <p className="text-sm text-ink-muted mb-3">Enter the cast number exactly as it is on the tag, so it matches the mill certificate.</p>
          <form action={addSteelStock} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="gauge" value={gauge} />
            <div>
              <label className="label text-xs" htmlFor="castNumber">Cast number</label>
              <input id="castNumber" name="castNumber" required className="input w-40 py-2 uppercase" placeholder="CM167338" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="diameterMm">Size</label>
              <select id="diameterMm" name="diameterMm" required defaultValue="" className="input w-28 py-2">
                <option value="" disabled>Choose…</option>
                {diameters.map((d) => <option key={d} value={d}>{d}mm</option>)}
              </select>
            </div>
            {gauge === 'HEAVY' && (
              <div>
                <label className="label text-xs" htmlFor="lengthM">Length</label>
                <select id="lengthM" name="lengthM" required defaultValue="" className="input w-28 py-2">
                  <option value="" disabled>Choose…</option>
                  {HEAVY_GAUGE_LENGTHS.map((l) => <option key={l} value={l}>{l}m</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label text-xs" htmlFor="weightKg">Weight (kg)</label>
              <input id="weightKg" name="weightKg" type="number" step="0.1" min="0.1" required className="input w-28 py-2" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="label text-xs" htmlFor="note">Note (optional)</label>
              <input id="note" name="note" className="input py-2" />
            </div>
            <SubmitButton pendingLabel="Adding…">Add to stock</SubmitButton>
          </form>
        </section>
      )}

      <div className="space-y-6">
        {diameters.map((dia) => {
          const ofSize = items.filter((i) => i.diameterMm === dia);
          return (
            <section key={dia} className="card card-pad">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-bold">{dia} mm</h2>
                <span className="text-sm text-ink-muted">{ofSize.length} · {tonnes(weight(ofSize))}</span>
              </div>
              {gauge === 'LIGHT' ? chipGrid(ofSize) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {HEAVY_GAUGE_LENGTHS.map((len) => {
                    const ofLength = ofSize.filter((i) => i.lengthM === len);
                    return (
                      <div key={len} className="rounded-xl border border-hairline p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
                          {len} m · {ofLength.length}{ofLength.length > 0 && <> · {tonnes(weight(ofLength))}</>}
                        </p>
                        {chipGrid(ofLength)}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-ink-faint mt-4">An amber dot on a {item} means there&apos;s no certificate on file for its cast yet. Upload it under Compliance → Upload certificate.</p>
    </Shell>
  );
}

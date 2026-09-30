import type { SteelGauge } from '@prisma/client';

/** The sizes Fender stocks. Add a size here and the forms and stock boards pick it up. */
export const LIGHT_GAUGE_DIAMETERS = [10, 12];
export const HEAVY_GAUGE_DIAMETERS = [16, 20, 25, 32];
export const HEAVY_GAUGE_LENGTHS = [12, 6];

export const GAUGE_LABEL: Record<SteelGauge, string> = { LIGHT: 'Light gauge', HEAVY: 'Heavy gauge' };
export const GAUGE_ITEM: Record<SteelGauge, string> = { LIGHT: 'coil', HEAVY: 'bundle' };
export const GAUGE_PATH: Record<SteelGauge, string> = { LIGHT: '/stock/light-gauge', HEAVY: '/stock/heavy-gauge' };

/** "12mm coil" or "16mm × 12m bundle". */
export function steelSizeLabel(item: { gauge: SteelGauge; diameterMm: number; lengthM: number | null }) {
  return item.gauge === 'HEAVY' ? `${item.diameterMm}mm × ${item.lengthM}m bundle` : `${item.diameterMm}mm coil`;
}

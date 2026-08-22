/**
 * BS 8666:2020 — scheduling, dimensioning, bending and cutting of steel
 * reinforcement for concrete.
 *
 * IMPORTANT, PLEASE READ BEFORE GOING LIVE
 * ----------------------------------------
 * This file holds the shape-code catalogue and the tolerance defaults the
 * production screens work from. The catalogue is a working reference, not a
 * substitute for the standard. BS 8666:2020 is a purchased document and the
 * cutting-length equations, minimum radii and end projections must be checked
 * against your own copy before the first schedule is cut against them.
 *
 * The system is deliberately built so the scheduler enters the total cutting
 * length from the customer's schedule rather than the software deriving it.
 * That matches how a fabricator actually works: the customer issues the
 * schedule, and our job is to cut to it accurately and prove we did.
 * `estimateCuttingLength` below is a cross-check to catch typing errors on the
 * commonest shapes — it is not a scheduling tool.
 */

export type ShapeCode = {
  code: string;
  name: string;
  dims: string[]; // dimension letters used, in schedule order
  bends: number;
  /** Cross-check formula for the commonest shapes. null = enter length from the schedule. */
  formula?: (d: Record<string, number>, dia: number, r: number) => number;
};

/**
 * The shapes that cover the overwhelming majority of UK schedules.
 * Anything not listed is scheduled as 99 with a dimensioned sketch, which is
 * exactly what the standard expects for non-standard shapes.
 */
export const SHAPE_CODES: ShapeCode[] = [
  { code: '00', name: 'Straight bar', dims: ['A'], bends: 0, formula: (v) => v.A },
  { code: '01', name: 'Straight — stock length', dims: ['A'], bends: 0, formula: (v) => v.A },
  { code: '11', name: 'L — one 90° bend', dims: ['A', 'B'], bends: 1, formula: (v, d, r) => v.A + v.B - 0.5 * r - d },
  { code: '12', name: 'L with radius', dims: ['A', 'B', 'R'], bends: 1 },
  { code: '13', name: 'U with semicircular end', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '14', name: 'Sloping L', dims: ['A', 'C'], bends: 1 },
  { code: '15', name: 'Sloping L, alternative', dims: ['A', 'C'], bends: 1 },
  { code: '21', name: 'U — two 90° bends', dims: ['A', 'B', 'C'], bends: 2, formula: (v, d, r) => v.A + v.B + v.C - r - 2 * d },
  { code: '22', name: 'Double bend with bob', dims: ['A', 'B', 'C', 'D'], bends: 3 },
  { code: '23', name: 'Z — opposite bends', dims: ['A', 'B', 'C'], bends: 2, formula: (v, d, r) => v.A + v.B + v.C - r - 2 * d },
  { code: '24', name: 'Cranked bar', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '25', name: 'Cranked bar with offset', dims: ['A', 'B', 'E'], bends: 2 },
  { code: '26', name: 'Cranked, both ends', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '27', name: 'Bent bar, acute', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '28', name: 'Bent bar, obtuse', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '29', name: 'Offset bar', dims: ['A', 'B', 'C'], bends: 2 },
  { code: '31', name: 'Three bends', dims: ['A', 'B', 'C', 'D'], bends: 3, formula: (v, d, r) => v.A + v.B + v.C + v.D - 1.5 * r - 3 * d },
  { code: '32', name: 'Three bends, alternative', dims: ['A', 'B', 'C', 'D'], bends: 3 },
  { code: '33', name: 'Helical / spiral', dims: ['A', 'B', 'C'], bends: 0 },
  { code: '34', name: 'Cranked with two ends', dims: ['A', 'B', 'C', 'E'], bends: 3 },
  { code: '35', name: 'Cranked with two ends, alt', dims: ['A', 'B', 'C', 'E'], bends: 3 },
  { code: '36', name: 'Trombone', dims: ['A', 'B', 'C', 'D'], bends: 3 },
  { code: '41', name: 'Four bends', dims: ['A', 'B', 'C', 'D', 'E'], bends: 4 },
  { code: '44', name: 'Four bends, alternative', dims: ['A', 'B', 'C', 'D', 'E'], bends: 4 },
  { code: '46', name: 'Open link', dims: ['A', 'B', 'C', 'E'], bends: 3 },
  { code: '47', name: 'Closed link with radius', dims: ['A', 'B', 'C', 'D'], bends: 4 },
  { code: '51', name: 'Closed link / stirrup', dims: ['A', 'B', 'C', 'D'], bends: 4 },
  { code: '56', name: 'Closed link, sloping', dims: ['A', 'B', 'C', 'D', 'E'], bends: 4 },
  { code: '63', name: 'Circular link', dims: ['A'], bends: 0 },
  { code: '64', name: 'Spiral', dims: ['A', 'B', 'C'], bends: 0 },
  { code: '67', name: 'Circle', dims: ['A'], bends: 0 },
  { code: '75', name: 'Helix', dims: ['A', 'B', 'C'], bends: 0 },
  { code: '77', name: 'Helix, tapered', dims: ['A', 'B', 'C'], bends: 0 },
  { code: '98', name: 'Isometric / two-plane shape', dims: ['A', 'B', 'C', 'D'], bends: 0 },
  { code: '99', name: 'Non-standard — dimensioned sketch required', dims: ['A', 'B', 'C', 'D', 'E'], bends: 0 },
];

export const shapeName = (code: string) =>
  SHAPE_CODES.find((s) => s.code === code)?.name ?? 'Non-standard';

/** Nominal mass per metre, kg. Derived from 7850 kg/m³ at the nominal size. */
export const MASS_PER_M: Record<number, number> = {
  6: 0.222, 8: 0.395, 10: 0.616, 12: 0.888, 16: 1.579,
  20: 2.466, 25: 3.854, 32: 6.313, 40: 9.864, 50: 15.413,
};

export const BAR_SIZES = Object.keys(MASS_PER_M).map(Number);

export function barWeightKg(diaMm: number, lengthMm: number, bars: number): number {
  const perM = MASS_PER_M[diaMm] ?? 0.006165 * diaMm * diaMm;
  return +(perM * (lengthMm / 1000) * bars).toFixed(3);
}

/**
 * Minimum scheduling radius and end projection, from BS 8666:2020 Table 2.
 * Mandrel is 4d for sizes up to and including 16 mm and 7d for 20 mm and over,
 * so the minimum bend radius is half that. VERIFY AGAINST YOUR COPY.
 */
export function minRadiusMm(diaMm: number): number {
  return diaMm <= 16 ? 2 * diaMm : 3.5 * diaMm;
}

export function minEndProjectionMm(diaMm: number, bendAtLeast150deg: boolean): number {
  // Links where the bend is >= 150°: straight length min 5d or 90 mm.
  // Links where the end bend is < 150°: min 10d or 90 mm.
  const factor = bendAtLeast150deg ? 5 : 10;
  return Math.max(factor * diaMm, 90);
}

/**
 * Cutting and bending tolerance bands, BS 8666:2020 Table 7.
 * Held here as defaults; editable in Set Up → Tolerances so you can tighten
 * them for a contract that specifies something stricter.
 * VERIFY AGAINST YOUR COPY OF THE STANDARD BEFORE RELYING ON THEM.
 */
export type ToleranceBand = { upToMm: number | null; plusMm: number; minusMm: number; label: string };

export const DEFAULT_TOLERANCES: ToleranceBand[] = [
  { upToMm: 1000, plusMm: 5, minusMm: 5, label: 'Cut length up to 1000 mm' },
  { upToMm: 2000, plusMm: 5, minusMm: 10, label: 'Cut length over 1000 mm up to 2000 mm' },
  { upToMm: null, plusMm: 5, minusMm: 25, label: 'Cut length over 2000 mm' },
];

export function toleranceFor(lengthMm: number, bands: ToleranceBand[] = DEFAULT_TOLERANCES): ToleranceBand {
  return bands.find((b) => b.upToMm === null || lengthMm <= b.upToMm) ?? bands[bands.length - 1];
}

export function withinTolerance(nominalMm: number, measuredMm: number, bands?: ToleranceBand[]) {
  const t = toleranceFor(nominalMm, bands);
  const diff = measuredMm - nominalMm;
  return { pass: diff <= t.plusMm && diff >= -t.minusMm, diff, tolerance: `+${t.plusMm} / −${t.minusMm} mm`, band: t };
}

/**
 * Cross-check only. Returns null where the shape needs the schedule's own
 * stated length. Never use this to overwrite what the customer scheduled.
 */
export function estimateCuttingLength(
  shapeCode: string,
  dims: Record<string, number>,
  diaMm: number,
  radiusMm?: number,
): number | null {
  const shape = SHAPE_CODES.find((s) => s.code === shapeCode);
  if (!shape?.formula) return null;
  const r = radiusMm ?? minRadiusMm(diaMm);
  const value = shape.formula(dims, diaMm, r);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** Minimum straight between bends: 10d up to 16 mm (min 75 mm), 13d above. */
export function minStraightBetweenBends(diaMm: number): number {
  return diaMm <= 16 ? Math.max(10 * diaMm, 75) : 13 * diaMm;
}

import type { AssetType } from '@prisma/client';

/**
 * Default morning pre-use checklists. Best-effort starting points, same
 * spirit as bs8666.ts — not a substitute for Fender Steel's own written
 * LOLER/PUWER daily-check sheet if one already exists.
 */
export const VEHICLE_CHECK_ITEMS = [
  'Tyres — condition and pressure',
  'Lights, indicators and beacon',
  'Mirrors and windscreen',
  'Brakes',
  'Fluid levels (oil, water, screenwash)',
  'Load securing equipment (straps, chains, headboard)',
  'Wheel nuts',
  'Reversing alarm / camera',
  'No visible damage, leaks or corrosion',
  'Documents in cab (licence, insurance, tacho)',
];

export const MACHINE_CHECK_ITEMS = [
  'Guards in place and secure',
  'Emergency stop tested',
  'No visible damage to blades, dies or rollers',
  'Hydraulic and air lines — no leaks',
  'Work area clear and clean',
  'Lifting equipment inspected (if fitted)',
  'Noise and vibration normal on start-up',
];

export function defaultCheckItems(assetType: AssetType): string[] {
  return assetType === 'VEHICLE' ? VEHICLE_CHECK_ITEMS : MACHINE_CHECK_ITEMS;
}

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

// Matches the site's own FLT Check and Defect Report pad (items 1–17 —
// the numbered pre-use checks; the sign-off declaration isn't a check item).
export const FORKLIFT_CHECK_ITEMS = [
  'Rating plate visible',
  'Safety frame / body / cab',
  'Emergency stop / foot and park brakes',
  'Forks / load guard / overhead guard',
  'Oil level / transmission and brake fluid',
  'Lamps / brake lights / indicators / beacon',
  'Windscreen wipers / washers and mirrors',
  'Seat and restraints / seat pressure switch',
  'Tyres / pressure / axles / wheel nuts',
  'Mast / chains / pivot pins / hydraulic lines',
  'Hydraulic controls and lift',
  'Steering / gauges / instruments',
  'Horn and audible warning',
  'Battery level / electrical lines',
  'Fork attachments and locking pins',
  'Fuel level / fuel tank and restraints',
  'Coolant and water level',
];

// Matches the site's own Overhead Crane Daily Inspection Checklist log book.
export const OVERHEAD_CRANE_CHECK_ITEMS = [
  'Lifting gear is within the 6 months testing period',
  'Pendant support wire secure and in good condition',
  'Emergency stops and stop button are operational',
  'Control labels are readable, clear and in good condition',
  'All guards are correctly fitted',
  'Travel path and runway beams are clear of obstacles',
  'All D shackles are in good working condition',
  'All D shackles are fitted correctly',
  'Hoist operation is stable with control button pressed',
  'All pins are in good working condition',
  'All pins are fitted correctly',
  'Hook is not damaged',
  'Safety latch is operational',
  'Electrical isolation points are accessible and operational',
  'Electrical isolation points are free, clear and visible',
  'Warning signs are clear and visible',
];

export function defaultCheckItems(assetType: AssetType, category?: string): string[] {
  const c = category?.trim().toLowerCase();
  if (c === 'forklift') return FORKLIFT_CHECK_ITEMS;
  if (c === 'overhead crane') return OVERHEAD_CRANE_CHECK_ITEMS;
  return assetType === 'VEHICLE' ? VEHICLE_CHECK_ITEMS : MACHINE_CHECK_ITEMS;
}

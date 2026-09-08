import 'server-only';
import { db } from './db';

export type FuelDiscrepancy = {
  id: string;
  gapLitres: number; // positive: litres the meter shows went out with no fill-up on file for them. negative: this entry's own start reading doesn't match the last one — a data-entry slip, not necessarily lost fuel
  previous: { id: string; vehicleLabel: string; litresAfter: number; loggedAt: Date };
  next: { id: string; vehicleLabel: string; litresBefore: number; loggedAt: Date };
};

// Rounding, or someone eyeballing the dial rather than reading it exactly —
// not worth flagging as a discrepancy below this.
const TOLERANCE_LITRES = 1;

/**
 * The yard's diesel meter is one shared, monotonically increasing counter
 * (see the comment on /fuel's own query) — every fill-up should start
 * exactly where the last one left it. Sorting by the reading itself,
 * rather than by when someone happened to log it, reconstructs the true
 * order fuel actually left the tank regardless of logging delay. A gap
 * between consecutive readings is litres the meter shows were dispensed
 * with no logged fill-up to account for them.
 */
export async function findFuelDiscrepancies(): Promise<FuelDiscrepancy[]> {
  const entries = await db.fuelEntry.findMany({
    include: { asset: true },
    orderBy: { litresBefore: 'asc' },
  });

  const discrepancies: FuelDiscrepancy[] = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const gapLitres = Number(curr.litresBefore) - Number(prev.litresAfter);
    if (Math.abs(gapLitres) <= TOLERANCE_LITRES) continue;
    discrepancies.push({
      id: curr.id,
      gapLitres,
      previous: {
        id: prev.id,
        vehicleLabel: prev.asset?.name ?? prev.otherVehicle,
        litresAfter: Number(prev.litresAfter),
        loggedAt: prev.loggedAt,
      },
      next: {
        id: curr.id,
        vehicleLabel: curr.asset?.name ?? curr.otherVehicle,
        litresBefore: Number(curr.litresBefore),
        loggedAt: curr.loggedAt,
      },
    });
  }
  return discrepancies;
}

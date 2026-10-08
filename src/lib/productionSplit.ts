import type { ProductionProcess } from '@prisma/client';

/**
 * How an approved order's bending schedule is split across Fender's machines.
 * 10mm and 12mm run on the Stema straight off the coil. 16mm and above are
 * cut to length on the shear (the Cutter) and then bent, unless they're
 * straights, which are finished once they're cut. The Cutter and the Stema
 * record the cast number and mill; bending carries the cast on from cutting.
 */

/** The biggest bar the Stema takes. */
export const STEMA_MAX_DIA = 12;

export const MACHINES: ProductionProcess[] = ['CUTTING', 'BENDING', 'STEMA'];

export const MACHINE: Record<ProductionProcess, { name: string; start: string; sizes: string; does: string; verb: string; done: string }> = {
  CUTTING: { name: 'Cutter', start: 'Start on the Cutter', sizes: '16mm and above', does: 'Cut to length — straights finish here, the rest go on to bending.', verb: 'Cut', done: 'cut' },
  BENDING: { name: 'Bending', start: 'Start bending', sizes: '16mm and above', does: 'Bend the cut bars. The cast number comes from cutting.', verb: 'Bent', done: 'bent' },
  STEMA: { name: 'Stema', start: 'Start on the Stema', sizes: '10mm and 12mm', does: 'Straight off the coil, cut and bent in one.', verb: 'Done', done: 'done on the Stema' },
};

type Mark = { diaMm: number; shapeCode: string };

/** Shape 00 (and 01, stock-length straights) needs no bending. */
export const isStraight = (b: Mark) => ['00', '01', ''].includes(b.shapeCode.trim());

/** The machines a bar mark goes through, in order. */
export function machinesFor(b: Mark): ProductionProcess[] {
  if (b.diaMm <= STEMA_MAX_DIA) return ['STEMA'];
  return isStraight(b) ? ['CUTTING'] : ['CUTTING', 'BENDING'];
}

/** "BMK 131" — how the yard writes a bar mark. Left alone if it was typed with the BMK already on. */
export function bmk(mark: string) {
  const m = mark.trim();
  return !m ? '' : /^bmk/i.test(m) ? m : `BMK ${m}`;
}

/** The Cutter and the Stema start from new steel, so they record its cast number and mill. */
export const recordsCast = (p: ProductionProcess) => p !== 'BENDING';

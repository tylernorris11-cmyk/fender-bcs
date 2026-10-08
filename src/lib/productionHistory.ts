import 'server-only';
import type { ProductionProcess, Prisma } from '@prisma/client';
import { db } from './db';
import { ukTimeToUtc } from './format';

export type MarkStep = { by: string; at: Date; castNumber: string; mill: string };
export type MarkHistory = {
  key: string;
  jobNumber: string;
  customerName: string;
  mark: string;
  diaMm: number | null;
  steps: Partial<Record<ProductionProcess, MarkStep>>;
  lastAt: Date;
};

/**
 * Who cut, bent or ran each bar mark on the Stema, and when — from Fender's
 * tally rows, on open sheets as well as finished ones. A mark ticked off an
 * approved order's schedule has one line with every machine it's been
 * through; a row typed in by hand is its own line. Newest first. The search
 * matches the job number, customer or bar mark ("BMK 131" or just "131");
 * the dates are UK days, and match whenever a step happened in them.
 */
export async function barMarkHistory({ q = '', from, to }: { q?: string; from?: string; to?: string }) {
  const term = q.trim().replace(/^bmk\s*/i, '');
  const at: Prisma.DateTimeFilter = {};
  if (from) at.gte = ukTimeToUtc(from, '00:00');
  if (to) at.lt = new Date(ukTimeToUtc(to, '00:00').getTime() + 24 * 3600 * 1000);

  const rows = await db.productionJobRow.findMany({
    where: {
      job: { company: 'FENDER' },
      ...(from || to ? { at } : {}),
      ...(term ? {
        OR: [
          { job: { jobNumber: { contains: term, mode: 'insensitive' } } },
          { job: { customerName: { contains: term, mode: 'insensitive' } } },
          { barMark: { equals: term, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: { job: { select: { jobNumber: true, customerName: true, process: true, user: { select: { name: true } } } } },
    orderBy: { at: 'desc' },
    take: 1500,
  });

  const marks = new Map<string, MarkHistory>();
  for (const r of rows) {
    const key = r.barMarkId ?? `row:${r.id}`;
    const entry = marks.get(key) ?? {
      key, jobNumber: r.job.jobNumber, customerName: r.job.customerName, mark: r.barMark,
      diaMm: r.diaMm == null ? null : Number(r.diaMm), steps: {}, lastAt: r.at,
    };
    const process = r.process ?? r.job.process;
    entry.steps[process] ??= { by: r.job.user.name, at: r.at, castNumber: r.castNumber, mill: r.mill };
    if (r.at > entry.lastAt) entry.lastAt = r.at;
    marks.set(key, entry);
  }
  return { marks: [...marks.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime()), capped: rows.length === 1500 };
}

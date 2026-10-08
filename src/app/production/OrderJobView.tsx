import { db } from '@/lib/db';
import { BAR_MARK_ORDER } from '@/lib/orders';
import { clock, shortDate, tonnes } from '@/lib/format';
import { MACHINE, machinesFor, recordsCast } from '@/lib/productionSplit';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addProductionJobRow } from './actions';
import { FenderRowFields, FenderRowsTable, JobActions, PartFinishedBanner } from './CurrentJobView';
import { firstName } from './FenderHome';
import { ScheduleWorkList, type WorkGroup } from './ScheduleWorkList';

/**
 * A Fender tally sheet started on an approved order: instead of typing rows
 * in, the machine's share of the order's schedule is listed to tick off (see
 * ScheduleWorkList). Each tick is a tally row at the mark's scheduled weight,
 * so the sheet prints and counts towards the day's tally like any other.
 */
export async function OrderJobView({ job, viewerId }: { job: any; viewerId: string }) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: job.orderId },
    include: {
      customer: { select: { name: true } },
      barMarks: {
        orderBy: BAR_MARK_ORDER,
        include: { productionRows: { include: { job: { select: { userId: true, user: { select: { name: true } } } } } } },
      },
    },
  });
  const machine = MACHINE[job.process as keyof typeof MACHINE];
  const canWork = job.userId === viewerId && !job.finishedAt;
  const marks = order.barMarks.filter((b) => machinesFor(b).includes(job.process));

  const groups: WorkGroup[] = [];
  for (const b of marks) {
    let group = groups.find((g) => g.dia === b.diaMm);
    if (!group) {
      // The cast and mill last used for this size on this sheet, carried on to the next mark.
      const last = [...job.rows].reverse().find((r: any) => Number(r.diaMm) === b.diaMm && r.castNumber);
      group = { dia: b.diaMm, marks: [], lastCast: last?.castNumber ?? '', lastMill: last?.mill ?? '' };
      groups.push(group);
    }
    const own = b.productionRows.find((r) => r.process === job.process);
    const cut = b.productionRows.find((r) => r.process === 'CUTTING');
    group.marks.push({
      id: b.id, mark: b.mark, shapeCode: b.shapeCode, bars: b.bars, lengthMm: b.lengthMm, kg: Number(b.weightKg),
      done: own ? {
        rowId: own.id, by: firstName(own.job.user.name), at: `${shortDate(own.at)} ${clock(own.at)}`, castNumber: own.castNumber,
        undoable: canWork && own.jobId === job.id,
      } : null,
      cut: job.process === 'BENDING' && cut ? { castNumber: cut.castNumber, by: firstName(cut.job.user.name) } : null,
    });
  }

  const doneKg = marks.filter((b) => b.productionRows.some((r) => r.process === job.process)).reduce((s, b) => s + Number(b.weightKg), 0);
  const totalKg = marks.reduce((s, b) => s + Number(b.weightKg), 0);
  const handRows = job.rows.filter((r: any) => !r.barMarkId);

  return (
    <>
      <PageHeader
        title={`${machine.name} · ${order.number}`}
        blurb={`${order.customer.name} · ${machine.sizes}${job.userId !== viewerId ? ` · ${job.user?.name ?? 'someone else'}'s sheet` : ''}`}
        actions={job.userId === viewerId && !job.finishedAt ? <JobActions job={job} /> : undefined}
      />
      <PartFinishedBanner job={job} />

      <StatRow>
        <Stat value={`${groups.reduce((s, g) => s + g.marks.filter((m) => m.done).length, 0)} / ${marks.length}`} label={`Bar marks ${machine.done}`} />
        <Stat value={`${tonnes(doneKg)} / ${tonnes(totalKg)}`} label="Weight" />
      </StatRow>

      {marks.length === 0 ? (
        <p className="card card-pad text-ink-muted">Nothing on {order.number} goes on the {machine.name}.</p>
      ) : (
        <ScheduleWorkList jobId={job.id} process={job.process} canWork={canWork} groups={groups} />
      )}

      {(handRows.length > 0 || canWork) && (
        <details className="card card-pad mt-6" open={handRows.length > 0}>
          <summary className="cursor-pointer font-bold">Something not on the schedule?</summary>
          {canWork && (
            <form action={addProductionJobRow} className="flex flex-wrap items-end gap-3 mt-4">
              <input type="hidden" name="jobId" value={job.id} />
              <FenderRowFields asksForCast={recordsCast(job.process)} lastCastNumber="" />
              <SubmitButton pendingLabel="Adding…">Add row</SubmitButton>
            </form>
          )}
          {handRows.length > 0 && (
            <div className="mt-4">
              <FenderRowsTable rows={handRows} showCastColumns={recordsCast(job.process) || handRows.some((r: any) => r.castNumber || r.mill)} />
            </div>
          )}
        </details>
      )}
    </>
  );
}

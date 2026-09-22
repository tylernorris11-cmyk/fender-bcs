import { isOutOfService } from '@/lib/assets';
import { BAR_SIZES } from '@/lib/bs8666';
import { db } from '@/lib/db';
import { clock, shortDate, tonnes } from '@/lib/format';
import { Empty, PageHeader, Stat, StatRow, Table } from '@/components/ui';
import { addProductionJobRow, finishProductionJob, partFinishProductionJob } from './actions';
import { CastNumberField } from './CastNumberField';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

// The full add-rows/finish view for one job — used both inline on the
// Fender home page (each user's own open job or jobs) and as the whole
// body of a BCS job's own page, since BCS jobs are shared and there can be
// too many open at once to show every one of them in full on one page.
export async function CurrentJobView({ job, viewerId }: { job: any; viewerId: string }) {
  const isFenderJob = job.company === 'FENDER';
  const startedByOther = !isFenderJob && job.userId !== viewerId;
  const totalWeight = job.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
  const lastRow = job.rows.length > 0 ? job.rows[job.rows.length - 1] : null;
  const lastCastNumber = lastRow?.castNumber ?? '';
  const lastSteelGrade = lastRow?.steelGrade ?? '';
  // diaMm is stored as a fixed-scale Decimal (always one decimal place, e.g.
  // "16.0"), which would mismatch Fender's plain-number <option value>s and
  // show an unwanted ".0" everywhere a whole diameter was entered — strip it
  // back to a plain number for display, keeping any real decimal (e.g. 8.5).
  const lastDiaMm = lastRow?.diaMm != null ? Number(lastRow.diaMm) : '';

  const machines = isFenderJob ? [] : await db.asset.findMany({
    where: { type: 'MACHINE', retired: false, OR: [{ company: null }, { company: job.company }] },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true,
      checks: { orderBy: { performedAt: 'desc' }, take: 1, select: { result: true, items: { select: { critical: true, ok: true, resolved: true } } } },
    },
  });

  return (
    <>
      <PageHeader
        title={`Job ${job.jobNumber}`}
        blurb={
          isFenderJob
            ? `${PROCESS_LABEL[job.process]}${job.order ? ` · linked to order ${job.order.number}` : ''}`
            : `${job.customerName ? `${job.customerName} · ` : ''}Fence post cutting${job.order ? ` · linked to order ${job.order.number}` : ''}${startedByOther ? ` · started by ${job.user?.name ?? 'someone else'} — anyone can add to it` : ''}`
        }
        actions={(
          <>
            <a href={`/production/jobs/${job.id}/print`} className="btn-secondary btn-sm">Print</a>
            <form action={partFinishProductionJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-secondary btn-sm" title="Not done yet — just counts today's tally and keeps the job open for next time">Finish for today</button>
            </form>
            <form action={finishProductionJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-primary btn-sm">Finish job</button>
            </form>
          </>
        )}
      />

      {job.lastPartFinishedAt && (
        <p className="banner-warn mb-6">
          Marked finished for the day at {clock(job.lastPartFinishedAt)} on {shortDate(job.lastPartFinishedAt)} — today&apos;s tally is counted and visible to everyone on the &ldquo;In progress&rdquo; list, but the job&apos;s still open, ready to carry on.
        </p>
      )}

      <StatRow>
        <Stat value={job.rows.length} label="Rows logged" />
        <Stat value={tonnes(totalWeight)} label={isFenderJob ? 'Tally weight so far' : 'Bundle weight so far'} />
      </StatRow>

      <div className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-3">Add a row</h2>
        <form action={addProductionJobRow} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jobId" value={job.id} />
          {isFenderJob ? (
            <>
              <div>
                <label className="label text-xs" htmlFor="diaMm">Diameter</label>
                <select id="diaMm" name="diaMm" className="input w-24">
                  <option value="">—</option>
                  {BAR_SIZES.map((s) => <option key={s} value={s}>{s} mm</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs" htmlFor="barMark">Bar mark</label>
                <input id="barMark" name="barMark" className="input w-24" placeholder="B01" />
              </div>
              <div className="w-40">
                <CastNumberField defaultValue={lastCastNumber} />
              </div>
              <div>
                <label className="label text-xs" htmlFor="mill">Mill</label>
                <input id="mill" name="mill" className="input w-32" />
              </div>
              <div>
                <label className="label text-xs" htmlFor="tallyWeightKg">Tally weight (kg)</label>
                <input id="tallyWeightKg" name="tallyWeightKg" type="number" step="0.1" min="0" className="input w-28" />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="label text-xs" htmlFor="comments">Comments</label>
                <input id="comments" name="comments" className="input" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label text-xs" htmlFor="machine">Machine used</label>
                <select id="machine" name="machine" className="input w-40">
                  <option value="">—</option>
                  {machines.map((m) => {
                    const outOfService = isOutOfService(m.checks[0]);
                    return (
                      <option key={m.id} value={m.name} disabled={outOfService}>
                        {m.name}{outOfService ? ' — OUT OF SERVICE' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="label text-xs" htmlFor="steelGrade">Carbon / Soft</label>
                <input id="steelGrade" name="steelGrade" className="input w-32" defaultValue={lastSteelGrade} />
              </div>
              <div>
                <label className="label text-xs" htmlFor="diaMm">Diameter (mm)</label>
                <input id="diaMm" name="diaMm" type="number" min="0" step="0.1" className="input w-24" defaultValue={lastDiaMm} />
              </div>
              <div>
                <label className="label text-xs" htmlFor="tallyWeightKg">Weight of bundle (kg)</label>
                <input id="tallyWeightKg" name="tallyWeightKg" type="number" step="0.1" min="0" className="input w-32" />
              </div>
            </>
          )}
          <button className="btn-primary">Add row</button>
        </form>
      </div>

      {job.rows.length === 0 ? <Empty title="No rows logged yet." /> : isFenderJob ? (
        <Table head={<>
          <th className="th">Dia</th><th className="th">Bar mark</th><th className="th">Cast number</th>
          <th className="th">Mill</th><th className="th">Weight</th><th className="th">Comments</th>
        </>}>
          {job.rows.map((r: any) => (
            <tr key={r.id} className="row">
              <td className="td">{r.diaMm ? `${Number(r.diaMm)} mm` : '—'}</td>
              <td className="td">{r.barMark || '—'}</td>
              <td className="td">{r.castNumber || '—'}</td>
              <td className="td">{r.mill || '—'}</td>
              <td className="td">{Number(r.tallyWeightKg).toLocaleString('en-GB')} kg</td>
              <td className="td text-ink-muted">{r.comments || '—'}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table head={<>
          <th className="th">Machine used</th><th className="th">Carbon / Soft</th>
          <th className="th">Diameter</th><th className="th">Weight of bundle</th>
        </>}>
          {job.rows.map((r: any) => (
            <tr key={r.id} className="row">
              <td className="td">{r.machine || '—'}</td>
              <td className="td">{r.steelGrade || '—'}</td>
              <td className="td">{r.diaMm ? `${Number(r.diaMm)} mm` : '—'}</td>
              <td className="td">{Number(r.tallyWeightKg).toLocaleString('en-GB')} kg</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { SubmitButton } from '@/components/SubmitButton';
import { ConfirmDeleteForm } from '@/components/ConfirmDeleteForm';
import { addJobRow, deleteJobRow, updateJobDetails, updateJobRow } from '../../../history/actions';

const GRADES = [{ value: 'C', label: 'Carbon' }, { value: 'HC', label: 'High carbon' }, { value: 'S', label: 'Soft' }];

/** Machine, carbon/soft, diameter and weight — the same fields as logging a bundle. The suggestion lists are on the page once. */
function RowFields({ id, row }: { id: string; row?: { machine: string; steelGrade: string; diaMm: unknown; tallyWeightKg: unknown } }) {
  return (
    <>
      <div>
        <label className="label text-xs" htmlFor={`machine-${id}`}>Machine used</label>
        <input id={`machine-${id}`} name="machine" list="bcs-machines" defaultValue={row?.machine} className="input py-2 w-28" />
      </div>
      <div>
        <label className="label text-xs" htmlFor={`grade-${id}`}>Carbon / Soft</label>
        <input id={`grade-${id}`} name="steelGrade" list="bcs-grades" defaultValue={row?.steelGrade} className="input py-2 w-24" />
      </div>
      <div>
        <label className="label text-xs" htmlFor={`dia-${id}`}>Diameter (mm)</label>
        <input id={`dia-${id}`} name="diaMm" type="number" min="0" step="0.1" defaultValue={row?.diaMm != null ? Number(row.diaMm) : ''} className="input py-2 w-24" />
      </div>
      <div>
        <label className="label text-xs" htmlFor={`weight-${id}`}>Weight of bundle (kg)</label>
        <input id={`weight-${id}`} name="tallyWeightKg" type="number" min="0" step="0.1" required defaultValue={row ? Number(row.tallyWeightKg) : ''} className="input py-2 w-32" />
      </div>
    </>
  );
}

/**
 * Correct a BCS tally job after the fact: its job number and customer, and
 * any bundle logged wrong, logged twice, or never logged. For people given
 * "Edit finished BCS production jobs" in People, and admins.
 */
export default async function EditProductionJobPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('production.view');
  if (!can(user, 'production.editHistory')) redirect('/no-access?needed=production.editHistory');
  const alerts = await getAlerts(user);

  const job = await db.productionJob.findUnique({
    where: { id: params.id },
    include: { rows: { orderBy: { sortOrder: 'asc' } }, user: { select: { name: true } } },
  });
  if (!job || job.company !== 'BS_SUPPLIES' || !user.companies.includes(job.company)) notFound();

  const assets = await db.asset.findMany({
    where: { type: 'MACHINE', retired: false, OR: [{ company: null }, { company: job.company }] },
    select: { name: true }, orderBy: { name: 'asc' },
  });
  const machines = [...new Set([...assets.map((a) => a.name), ...job.rows.map((r) => r.machine).filter(Boolean)])];
  const total = job.rows.reduce((s, r) => s + Number(r.tallyWeightKg), 0);

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production/history" alerts={alerts.length}>
      <Link href="/production/history" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
        <ArrowLeft size={15} /> Back to production history
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit job {job.jobNumber}</h1>
          <p className="text-ink-muted mt-1.5">
            {job.customerName ? `${job.customerName} · ` : ''}Started {shortDate(job.startedAt)} by {job.user.name}
            {job.finishedAt ? ` · finished ${shortDate(job.finishedAt)} ${clock(job.finishedAt)}` : ' · still open'}
          </p>
        </div>
        <a href={`/production/jobs/${job.id}/print`} className="btn-secondary"><Printer size={16} /> Print</a>
      </div>

      <datalist id="bcs-machines">{machines.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="bcs-grades">{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</datalist>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-3">Job details</h2>
        <form key={`${job.jobNumber}|${job.customerName}`} action={updateJobDetails} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jobId" value={job.id} />
          <div>
            <label className="label text-xs" htmlFor="jobNumber">Job number</label>
            <input id="jobNumber" name="jobNumber" required defaultValue={job.jobNumber} className="input py-2 w-40" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label text-xs" htmlFor="customerName">Customer</label>
            <input id="customerName" name="customerName" defaultValue={job.customerName} className="input py-2" />
          </div>
          <SubmitButton className="btn-primary py-2" pendingLabel="Saving…">Save</SubmitButton>
        </form>
      </section>

      <section className="card card-pad mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold">Bundles</h2>
          <p className="text-sm text-ink-muted">{job.rows.length} {job.rows.length === 1 ? 'row' : 'rows'} · {tonnes(total)}</p>
        </div>
        {job.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No rows on this job.</p>
        ) : (
          <ol className="divide-y divide-hairline">
            {job.rows.map((r, i) => (
              <li key={r.id} className="py-3 flex flex-wrap items-end gap-3">
                <span className="text-sm font-semibold text-ink-faint w-6 pb-2.5 tabular-nums">{i + 1}</span>
                <form key={`${r.machine}|${r.steelGrade}|${r.diaMm}|${r.tallyWeightKg}`} action={updateJobRow} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="rowId" value={r.id} />
                  <RowFields id={r.id} row={r} />
                  <SubmitButton className="btn-secondary py-2" pendingLabel="Saving…">Save</SubmitButton>
                </form>
                <div className="pb-1">
                  <ConfirmDeleteForm action={deleteJobRow} id={r.id} label="Delete" question="Delete this row?" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-1">Add a missing row</h2>
        <p className="text-sm text-ink-muted mb-3">A bundle that was cut but never logged on this job.</p>
        <form key={job.rows.length} action={addJobRow} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jobId" value={job.id} />
          <RowFields id="new" />
          <SubmitButton className="btn-primary py-2" pendingLabel="Adding…">Add row</SubmitButton>
        </form>
      </section>
    </Shell>
  );
}

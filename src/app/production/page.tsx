import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate, tonnes } from '@/lib/format';
import { isOutOfService } from '@/lib/assets';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, SortSelect, StagePill, Stat, StatRow, Table } from '@/components/ui';
import { logProduction, startProductionJob } from './actions';
import { CurrentJobView } from './CurrentJobView';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

export default async function ProductionPage({ searchParams }: { searchParams: { sort?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';

  // A worker can have more than one job open at once — several machines
  // running in parallel — so on Fender this is every open job of theirs,
  // not just one. On BCS a job is shared once started (anyone can add to
  // or finish one another person opened, see actions.ts), so every open
  // BCS job is "active" for everyone, not just whoever started it.
  const activeJobs = await db.productionJob.findMany({
    where: isFender ? { userId: user.id, company, finishedAt: null } : { company, finishedAt: null },
    include: { rows: { orderBy: { sortOrder: 'asc' } }, order: true, user: true },
    orderBy: { startedAt: 'asc' },
  });

  const openOtherWork = await db.otherWorkTask.count({ where: { company, status: 'Open' } });

  const finishedJobs = await db.productionJob.findMany({
    where: { company, finishedAt: { not: null } },
    include: { user: true, rows: true },
    orderBy: { finishedAt: 'desc' },
    take: 20,
  });

  const activeJobIds = activeJobs.map((j) => j.id);
  const inProgressJobs = await db.productionJob.findMany({
    where: {
      company, finishedAt: null,
      ...(activeJobIds.length > 0 ? { id: { notIn: activeJobIds } } : {}),
    },
    include: { user: true, rows: true },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  const orders = await db.order.findMany({
    where: { company, archived: false, stage: { in: ['APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'] } },
    include: {
      customer: true,
      barMarks: isFender ? { include: { qcChecks: true } } : false,
      lines: true,
      production: { include: { user: true }, orderBy: { at: 'desc' }, take: 1 },
    },
    orderBy:
      searchParams.sort === 'number' ? [{ number: 'asc' }]
      : searchParams.sort === 'customer' ? [{ customer: { name: 'asc' } }]
      : [{ deliveryDate: 'asc' }],
  });

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production" alerts={alerts.length}>
      <OtherWorkCallout openCount={openOtherWork} />
      {isFender ? (
        <>
          {activeJobs.map((job) => <CurrentJobView key={job.id} job={job} viewerId={user.id} />)}
          <FenderView orders={orders} sort={searchParams.sort} user={user} />
        </>
      ) : (
        <>
          <OpenBcsJobs jobs={activeJobs} />
          <BcsView orders={orders} sort={searchParams.sort} user={user} company={company} />
        </>
      )}

      <InProgressJobs jobs={inProgressJobs} isFender={isFender} />
      <RecentJobs jobs={finishedJobs} isFender={isFender} />
    </Shell>
  );
}

function InProgressJobs({ jobs, isFender }: { jobs: any[]; isFender: boolean }) {
  if (jobs.length === 0) return null;
  return (
    <section className="card card-pad mt-6">
      <h2 className="text-lg font-bold mb-1">In progress</h2>
      <p className="text-sm text-ink-muted mb-4">Still open — being worked on right now or finished for the day, not the whole job. Visible to everyone, not just whoever's on it.</p>
      <Table head={<>
        <th className="th">Job</th><th className="th">{isFender ? 'Process' : 'Rows'}</th>
        <th className="th">Weight so far</th><th className="th">Last worked</th><th className="th">By</th><th className="th sr-only">Print</th>
      </>}>
        {jobs.map((j) => {
          const weight = j.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
          const lastActivity = j.lastPartFinishedAt ?? (j.rows.length > 0
            ? new Date(Math.max(...j.rows.map((r: any) => new Date(r.at).getTime())))
            : j.startedAt);
          return (
            <tr key={j.id} className="row">
              <td className="td font-semibold">{j.jobNumber}</td>
              <td className="td">{isFender ? PROCESS_LABEL[j.process] : `${j.rows.length} row${j.rows.length === 1 ? '' : 's'}`}</td>
              <td className="td">{tonnes(weight)}</td>
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(lastActivity)} {clock(lastActivity)}</td>
              <td className="td text-ink-muted">{j.user?.name ?? '—'}</td>
              <td className="td text-right">
                <a href={`/production/jobs/${j.id}/print`} className="btn-secondary btn-sm">
                  <Printer size={14} /> Print
                </a>
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}

function RecentJobs({ jobs, isFender }: { jobs: any[]; isFender: boolean }) {
  if (jobs.length === 0) return null;
  return (
    <section className="card card-pad mt-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-bold">Recent jobs</h2>
        <Link href="/production/history" className="text-sm font-semibold text-brand-700 hover:underline whitespace-nowrap">Full history →</Link>
      </div>
      <p className="text-sm text-ink-muted mb-4">Finished tally sheets — print a copy for the file.</p>
      <Table head={<>
        <th className="th">Job</th><th className="th">{isFender ? 'Process' : 'Rows'}</th>
        <th className="th">Weight</th><th className="th">Finished</th><th className="th">By</th><th className="th sr-only">Print</th>
      </>}>
        {jobs.map((j) => {
          const weight = j.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
          return (
            <tr key={j.id} className="row">
              <td className="td font-semibold">{j.jobNumber}</td>
              <td className="td">{isFender ? PROCESS_LABEL[j.process] : `${j.rows.length} row${j.rows.length === 1 ? '' : 's'}`}</td>
              <td className="td">{tonnes(weight)}</td>
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(j.finishedAt)}</td>
              <td className="td text-ink-muted">{j.user?.name ?? '—'}</td>
              <td className="td text-right">
                <a href={`/production/jobs/${j.id}/print`} className="btn-secondary btn-sm">
                  <Printer size={14} /> Print
                </a>
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}

// BCS jobs are shared (see actions.ts) — everyone's open jobs show up here,
// not just the viewer's own, so this stays a compact list rather than
// showing every job's full rows and add-row form inline. Click through to
// /production/jobs/[id] to actually work on one.
function OpenBcsJobs({ jobs }: { jobs: any[] }) {
  if (jobs.length === 0) return null;
  return (
    <section className="card card-pad mb-6">
      <h2 className="text-lg font-bold mb-1">Open jobs</h2>
      <p className="text-sm text-ink-muted mb-4">Click a job to add rows, finish for today, or finish it — shared, so anyone can pick one up.</p>
      <Table head={<>
        <th className="th">Job</th><th className="th">Rows</th>
        <th className="th">Weight so far</th><th className="th">Last worked</th><th className="th">Started by</th><th className="th sr-only">Open</th>
      </>}>
        {jobs.map((j) => {
          const weight = j.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
          const lastActivity = j.lastPartFinishedAt ?? (j.rows.length > 0
            ? new Date(Math.max(...j.rows.map((r: any) => new Date(r.at).getTime())))
            : j.startedAt);
          return (
            <tr key={j.id} className="row">
              <td className="td font-semibold">{j.jobNumber}</td>
              <td className="td">{j.rows.length} row{j.rows.length === 1 ? '' : 's'}</td>
              <td className="td">{tonnes(weight)}</td>
              <td className="td text-ink-muted whitespace-nowrap">{shortDate(lastActivity)} {clock(lastActivity)}</td>
              <td className="td text-ink-muted">{j.user?.name ?? '—'}</td>
              <td className="td text-right">
                <Link href={`/production/jobs/${j.id}`} className="btn-primary btn-sm">Open</Link>
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}

function OtherWorkCallout({ openCount }: { openCount: number }) {
  return (
    <div className="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">
        <strong>Other work</strong>
        <span className="text-ink-muted"> — jobs that aren&apos;t a customer order, and things that still need doing.</span>
      </p>
      <div className="flex items-center gap-3">
        {openCount > 0 && <Pill tone="warn">{openCount} needs doing</Pill>}
        <Link href="/production/other-work" className="btn-secondary btn-sm">Other work</Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Fender Steel

function FenderView({ orders, sort, user }: { orders: any[]; sort?: string; user: any }) {
  const cutBent = orders.filter((o) => o.barMarks.length > 0);
  const barsOutstanding = cutBent.reduce(
    (s, o) => s + o.barMarks.filter((b: any) => b.status === 'Scheduled').reduce((n: number, b: any) => n + b.bars, 0), 0);
  const failed = cutBent.reduce((s, o) => s + o.barMarks.filter((b: any) => b.qcChecks.some((c: any) => !c.pass)).length, 0);
  const tonnesOut = cutBent.reduce((s, o) => s + o.barMarks.reduce((n: number, b: any) => n + Number(b.weightKg), 0), 0);

  return (
    <>
      <PageHeader title="Production" blurb="What is on the shear line and the benders, and what still needs checking." />

      {can(user, 'production.progress') && (
        <div className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Start a job</h2>
          <form action={startProductionJob} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="jobNumber">Job number</label>
              <input id="jobNumber" name="jobNumber" required className="input w-40" placeholder="FS-26-05301" />
            </div>
            <div>
              <label className="label" htmlFor="process">Process</label>
              <select id="process" name="process" className="input w-36">
                <option value="CUTTING">Cutting</option>
                <option value="BENDING">Bending</option>
                <option value="STEMA">Stema</option>
              </select>
            </div>
            <button className="btn-primary">Start job</button>
          </form>
        </div>
      )}

      <StatRow>
        <Stat value={cutBent.length} label="Cut & bent orders in the yard" />
        <Stat value={barsOutstanding.toLocaleString('en-GB')} label="Bars still to cut" />
        <Stat value={tonnes(tonnesOut)} label="Tonnage in progress" />
        <Stat value={failed} label="Marks out of tolerance" tone={failed ? 'bad' : 'default'} href="/production/checks" />
      </StatRow>

      <SortForm sort={sort} />

      {orders.length === 0 ? <Empty title="Nothing in production. Approve an order to start it." /> : (
        <div className="space-y-3">
          {orders.map((o) => {
            const scheduled = o.barMarks.filter((b: any) => b.status === 'Scheduled').length;
            const checked = o.barMarks.filter((b: any) => b.qcChecks.length > 0).length;
            return (
              <article key={o.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-5">
                <div className="min-w-[200px]">
                  <Link href={`/orders/${o.id}`} className="font-bold text-brand-700 hover:underline">{o.number}</Link>
                  <p className="text-sm text-ink-muted">{o.customer.name} · {o.town}</p>
                </div>
                <StagePill stage={o.stage} />
                <div className="text-sm">
                  {o.barMarks.length > 0
                    ? <>{o.barMarks.length} bar marks · {scheduled} still to run · {checked} checked</>
                    : <span className="text-ink-muted">Standard products only — no bending</span>}
                </div>
                <div className="text-sm text-ink-muted">Delivery {shortDate(o.deliveryDate)}</div>
                {o.production[0] && (
                  <Pill tone="info">{o.production[0].action} · {o.production[0].station} · {o.production[0].user?.name}</Pill>
                )}
                <div className="ml-auto flex gap-2">
                  {o.barMarks.length > 0 && (
                    <>
                      <a href={`/orders/${o.id}/bending-ticket`} className="btn-secondary btn-sm">Bending ticket</a>
                      <Link href={`/production/checks?order=${o.id}`} className="btn-primary btn-sm">Record checks</Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// -------------------------------------------------------------- BCS Products
// Fence post is cut to length from coil through a straightening machine —
// no bending, no BS 8666 tolerances. Progress is just "which machine, when."

async function BcsView({ orders, sort, user, company }: { orders: any[]; sort?: string; user: any; company: 'BS_SUPPLIES' }) {
  const machines = await db.asset.findMany({
    where: { type: 'MACHINE', retired: false, OR: [{ company: null }, { company }] },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, category: true,
      checks: { orderBy: { performedAt: 'desc' }, take: 1, select: { result: true, items: { select: { critical: true, ok: true, resolved: true } } } },
    },
  });

  const notStarted = orders.filter((o) => o.production.length === 0).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutToday = orders.filter((o) => o.production[0] && new Date(o.production[0].at) >= today).length;
  // Most of what's actually "in progress" here is logged through the tally
  // job (Add a job / Add a row), not against a sales order — a fence post
  // run someone's mid-way through has real, weighed tonnage on it long
  // before (if ever) it's tied to a specific order, so this has to count
  // both or it silently shows 0 while a real job sits open on the floor.
  const jobTonnageAgg = await db.productionJobRow.aggregate({
    _sum: { tallyWeightKg: true },
    where: { job: { company, finishedAt: null } },
  });
  const tonnesInProgress =
    orders.reduce((s, o) => s + o.lines.reduce((n: number, l: any) => n + Number(l.weightKg), 0), 0) +
    Number(jobTonnageAgg._sum.tallyWeightKg ?? 0);

  return (
    <>
      <PageHeader title="Production" blurb="What still needs cutting to length, and what's already off the straightening line." />

      {can(user, 'production.progress') && (
        <div className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Add a job</h2>
          <form action={startProductionJob} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="jobNumber">Job number</label>
              <input id="jobNumber" name="jobNumber" required className="input w-40" />
            </div>
            <button className="btn-primary">Start job</button>
          </form>
        </div>
      )}

      <StatRow>
        <Stat value={orders.length} label="Orders in production" />
        <Stat value={tonnes(tonnesInProgress)} label="Tonnage in progress" />
        <Stat value={notStarted} label="Not started yet" tone={notStarted ? 'warn' : 'default'} />
        <Stat value={cutToday} label="Cut today" tone="good" />
      </StatRow>

      <SortForm sort={sort} />

      {orders.length === 0 ? <Empty title="Nothing in production. Approve an order to start it." /> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <article key={o.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-5">
              <div className="min-w-[200px]">
                <Link href={`/orders/${o.id}`} className="font-bold text-brand-700 hover:underline">{o.number}</Link>
                <p className="text-sm text-ink-muted">{o.customer.name} · {o.town}</p>
              </div>
              <StagePill stage={o.stage} />
              <div className="text-sm text-ink-muted">
                {o.lines.length} {o.lines.length === 1 ? 'line' : 'lines'} · {tonnes(o.lines.reduce((n: number, l: any) => n + Number(l.weightKg), 0))}
              </div>
              <div className="text-sm text-ink-muted">Delivery {shortDate(o.deliveryDate)}</div>
              {o.production[0] ? (
                <Pill tone="info">{o.production[0].action} · {o.production[0].station} · {o.production[0].user?.name}</Pill>
              ) : (
                <Pill tone="warn">Not started</Pill>
              )}

              {can(user, 'production.progress') && (
                <form action={logProduction} className="ml-auto flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="station" value="Straightening line" />
                  <div>
                    <label className="label text-xs" htmlFor={`asset-${o.id}`}>Machine</label>
                    <select id={`asset-${o.id}`} name="assetId" className="input w-36 py-2">
                      {machines.map((m) => {
                        const outOfService = isOutOfService(m.checks[0]);
                        return (
                          <option key={m.id} value={m.id} disabled={outOfService}>
                            {m.name}{outOfService ? ' — OUT OF SERVICE' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`action-${o.id}`}>Progress</label>
                    <select id={`action-${o.id}`} name="action" className="input w-32 py-2">
                      <option value="Started">Started</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <button className="btn-secondary btn-sm">Log</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SortForm({ sort }: { sort?: string }) {
  return (
    <form className="flex justify-end gap-2 mb-4">
      <SortSelect
        value={sort}
        options={[
          { value: 'delivery', label: 'Delivery soonest' },
          { value: 'number', label: 'Order A-Z' },
          { value: 'customer', label: 'Customer A-Z' },
        ]}
      />
      <button className="btn-secondary btn-sm">Apply</button>
    </form>
  );
}

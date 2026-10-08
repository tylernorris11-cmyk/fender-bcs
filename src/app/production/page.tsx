import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, isoDateUk, shortDate, tonnes, ukTimeToUtc } from '@/lib/format';
import { isOutOfService } from '@/lib/assets';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, SortSelect, StagePill, Stat, StatRow, Table } from '@/components/ui';
import { doneByMark } from '@/lib/orderProduction';
import { logProduction, startProductionJob } from './actions';
import { produceStockLength } from '../stock/lengths/actions';
import { FenderHome, OffSystemJob } from './FenderHome';
import { FenderBoard } from './FenderBoard';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

export default async function ProductionPage({ searchParams }: { searchParams: { sort?: string; start?: string } }) {
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

  // What the viewer has tallied since midnight (UK), finished jobs included.
  const today = isFender
    ? await db.productionJobRow.aggregate({
        where: { job: { company, userId: user.id }, at: { gte: ukTimeToUtc(isoDateUk(), '00:00') } },
        _sum: { tallyWeightKg: true },
        _count: { _all: true },
      })
    : null;

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
      barMarks: isFender
        ? { select: { id: true, diaMm: true, shapeCode: true, bars: true, weightKg: true, status: true, qcChecks: { select: { pass: true } } } }
        : false,
      lines: true,
      production: { include: { user: true }, orderBy: { at: 'desc' }, take: 1 },
      productionJobs: isFender
        ? { where: { finishedAt: null }, select: { process: true, userId: true, user: { select: { name: true } } } }
        : false,
    },
    orderBy:
      searchParams.sort === 'number' ? [{ number: 'asc' }]
      : searchParams.sort === 'customer' ? [{ customer: { name: 'asc' } }]
      : [{ deliveryDate: 'asc' }],
  });

  // Which machines each bar mark on those orders has been through, from the rows ticked off their schedules.
  const done = isFender
    ? doneByMark(await db.productionJobRow.findMany({
        where: { scheduleMark: { orderId: { in: orders.map((o) => o.id) } } }, select: { barMarkId: true, process: true },
      }))
    : new Map();

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production" alerts={alerts.length}>
      {isFender ? (
        <>
          <FenderHome
            userName={user.name}
            jobs={activeJobs}
            tallyTodayKg={Number(today?._sum.tallyWeightKg ?? 0)}
            rowsToday={today?._count._all ?? 0}
            openOtherWork={openOtherWork}
            canStart={can(user, 'production.progress')}
          />
          <FenderBoard
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orders={orders as any}
            done={done}
            viewerId={user.id}
            canStart={can(user, 'production.progress')}
            startId={searchParams.start}
            sort={searchParams.sort}
          />
          {can(user, 'production.progress') && <OffSystemJob startAction={startProductionJob} />}
        </>
      ) : (
        <>
          <OtherWorkCallout openCount={openOtherWork} />
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
              <td className="td font-semibold">
                {j.jobNumber}
                {!isFender && j.customerName && <span className="block text-xs font-normal text-ink-muted">{j.customerName}</span>}
              </td>
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
              <td className="td font-semibold">
                {j.jobNumber}
                {!isFender && j.customerName && <span className="block text-xs font-normal text-ink-muted">{j.customerName}</span>}
              </td>
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
              <td className="td font-semibold">
                {j.jobNumber}
                {j.customerName && <span className="block text-xs font-normal text-ink-muted">{j.customerName}</span>}
              </td>
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
            <div>
              <label className="label" htmlFor="customerName">Customer</label>
              <input id="customerName" name="customerName" className="input w-48" placeholder="Optional" />
            </div>
            <button className="btn-primary">Start job</button>
          </form>
        </div>
      )}

      {can(user, 'production.progress') && (
        <div className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Produce stock lengths</h2>
          <p className="text-sm text-ink-muted mb-3">Steel rod cut ahead of any specific order, straight into stock — see Stock → Stock Lengths.</p>
          <form action={produceStockLength} className="flex flex-wrap items-end gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="stockLengthFt">Length (ft)</label>
                <input id="stockLengthFt" name="lengthFt" type="number" min="1" step="1" required className="input w-24" />
              </div>
              <div>
                <label className="label" htmlFor="stockLengthIn">+ inches</label>
                <input id="stockLengthIn" name="lengthIn" type="number" min="0" max="11" step="1" defaultValue={0} className="input w-20" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="stockThicknessMm">Thickness (mm)</label>
              <input id="stockThicknessMm" name="thicknessMm" type="number" min="0" step="0.1" required className="input w-28" />
            </div>
            <div>
              <label className="label" htmlFor="stockWeightKg">Weight produced (kg)</label>
              <input id="stockWeightKg" name="weightKg" type="number" min="0.1" step="0.1" required className="input w-28" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="label" htmlFor="stockNote">Note</label>
              <input id="stockNote" name="note" className="input" placeholder="Optional" />
            </div>
            <button className="btn-primary">Add to stock</button>
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

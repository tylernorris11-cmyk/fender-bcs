import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { shortDate, tonnes } from '@/lib/format';
import { BAR_SIZES } from '@/lib/bs8666';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, SortSelect, StagePill, Stat, StatRow, Table } from '@/components/ui';
import { logProduction, startProductionJob, finishProductionJob, addProductionJobRow } from './actions';
import { CastNumberField } from './CastNumberField';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

export default async function ProductionPage({ searchParams }: { searchParams: { sort?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';

  const activeJob = isFender
    ? await db.productionJob.findFirst({
        where: { userId: user.id, finishedAt: null },
        include: { rows: { orderBy: { sortOrder: 'asc' } }, order: true },
      })
    : null;

  const openOtherWork = await db.otherWorkTask.count({ where: { company, status: 'Open' } });

  const orders = isFender && activeJob ? [] : await db.order.findMany({
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
        activeJob ? <CurrentJobView job={activeJob} /> : <FenderView orders={orders} sort={searchParams.sort} user={user} />
      ) : (
        <BcsView orders={orders} sort={searchParams.sort} user={user} company={company} />
      )}
    </Shell>
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

// ------------------------------------------------------- current tally job

function CurrentJobView({ job }: { job: any }) {
  const totalWeight = job.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
  const lastCastNumber = job.rows.length > 0 ? job.rows[job.rows.length - 1].castNumber : '';

  return (
    <>
      <PageHeader
        title={`Job ${job.jobNumber}`}
        blurb={`${PROCESS_LABEL[job.process]}${job.order ? ` · linked to order ${job.order.number}` : ''}`}
        actions={(
          <form action={finishProductionJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="btn-secondary btn-sm">Finish job</button>
          </form>
        )}
      />

      <StatRow>
        <Stat value={job.rows.length} label="Rows logged" />
        <Stat value={tonnes(totalWeight)} label="Tally weight so far" />
      </StatRow>

      <div className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-3">Add a row</h2>
        <form action={addProductionJobRow} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jobId" value={job.id} />
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
          <button className="btn-primary">Add row</button>
        </form>
      </div>

      {job.rows.length === 0 ? <Empty title="No rows logged yet." /> : (
        <Table head={<>
          <th className="th">Dia</th><th className="th">Bar mark</th><th className="th">Cast number</th>
          <th className="th">Mill</th><th className="th">Weight</th><th className="th">Comments</th>
        </>}>
          {job.rows.map((r: any) => (
            <tr key={r.id} className="row">
              <td className="td">{r.diaMm ? `${r.diaMm} mm` : '—'}</td>
              <td className="td">{r.barMark || '—'}</td>
              <td className="td">{r.castNumber || '—'}</td>
              <td className="td">{r.mill || '—'}</td>
              <td className="td">{Number(r.tallyWeightKg).toLocaleString('en-GB')} kg</td>
              <td className="td text-ink-muted">{r.comments || '—'}</td>
            </tr>
          ))}
        </Table>
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
    select: { id: true, name: true, category: true },
  });

  const notStarted = orders.filter((o) => o.production.length === 0).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutToday = orders.filter((o) => o.production[0] && new Date(o.production[0].at) >= today).length;
  const tonnesInProgress = orders.reduce((s, o) => s + o.lines.reduce((n: number, l: any) => n + Number(l.weightKg), 0), 0);

  return (
    <>
      <PageHeader title="Production" blurb="What still needs cutting to length, and what's already off the straightening line." />

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
                      {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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

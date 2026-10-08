import Link from 'next/link';
import { Pencil, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { can } from '@/lib/rbac';
import { clock, shortDate, tonnes } from '@/lib/format';
import { barMarkHistory, type MarkHistory } from '@/lib/productionHistory';
import { bmk, MACHINE, MACHINES } from '@/lib/productionSplit';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, SortTh, Stat, StatRow, Table } from '@/components/ui';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

export default async function ProductionHistoryPage({
  searchParams,
}: { searchParams: { q?: string; from?: string; to?: string; sort?: string; dir?: string; view?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';
  // Correcting a finished job is BCS-only, for whoever's been given it in People.
  const canEdit = !isFender && can(user, 'production.editHistory');
  // Fender opens on what happened to each bar mark; its tally sheets are the other tab.
  const view = isFender && searchParams.view !== 'sheets' ? 'marks' : 'sheets';
  const q = (searchParams.q ?? '').trim();
  const tabHref = (v: string) => {
    const p = new URLSearchParams({ view: v, ...(q ? { q } : {}), ...(searchParams.from ? { from: searchParams.from } : {}), ...(searchParams.to ? { to: searchParams.to } : {}) });
    return `/production/history?${p}`;
  };

  if (view === 'marks') {
    const { marks, capped } = await barMarkHistory({ q, from: searchParams.from, to: searchParams.to });
    return (
      <Shell user={user} module="production" nav={NAV.production} current="/production/history" alerts={alerts.length}>
        <PageHeader title="Production history" blurb="Who cut, bent or ran each bar mark on the Stema, and when — on open sheets as well as finished ones." />
        <HistoryTabs view={view} tabHref={tabHref} />
        <HistoryFilters q={q} from={searchParams.from} to={searchParams.to} view={view} isMarks />
        <section className="card card-pad">
          {marks.length === 0 ? (
            <Empty title="Nothing logged that matches." action={<Link href="/production/history" className="btn-secondary">Clear filters</Link>} />
          ) : (
            <>
              <p className="text-sm text-ink-muted mb-3">
                {marks.length.toLocaleString('en-GB')} bar mark{marks.length === 1 ? '' : 's'}, newest first{capped ? ' — the most recent 1,500 rows; narrow it down to see further back' : ''}.
              </p>
              <BarMarkTable marks={marks} />
            </>
          )}
        </section>
      </Shell>
    );
  }

  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const orderBy =
    searchParams.sort === 'job' ? [{ jobNumber: dir as 'asc' | 'desc' }]
    : searchParams.sort === 'started' ? [{ startedAt: dir as 'asc' | 'desc' }]
    : [{ finishedAt: dir as 'asc' | 'desc' }];

  const finishedAtFilter: { not: null; gte?: Date; lte?: Date } = { not: null };
  if (searchParams.from) finishedAtFilter.gte = new Date(searchParams.from);
  if (searchParams.to) {
    const end = new Date(searchParams.to);
    end.setHours(23, 59, 59, 999);
    finishedAtFilter.lte = end;
  }

  const jobs = await db.productionJob.findMany({
    where: {
      company,
      finishedAt: finishedAtFilter,
      ...(q ? { OR: [{ jobNumber: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: { user: true, rows: true },
    orderBy,
    take: 200,
  });

  const totalWeight = jobs.reduce((s, j) => s + j.rows.reduce((n, r) => n + Number(r.tallyWeightKg), 0), 0);
  const totalRows = jobs.reduce((s, j) => s + j.rows.length, 0);

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production/history" alerts={alerts.length}>
      <PageHeader title="Production history" blurb="Every finished tally sheet — search, filter and print copies for the file." />
      {isFender && <HistoryTabs view={view} tabHref={tabHref} />}

      <StatRow>
        <Stat value={jobs.length} label={jobs.length === 200 ? 'Jobs shown (200 max)' : 'Jobs'} />
        <Stat value={tonnes(totalWeight)} label="Total weight" />
        <Stat value={totalRows} label="Rows logged" />
      </StatRow>

      <HistoryFilters q={q} from={searchParams.from} to={searchParams.to} view={isFender ? view : undefined} />

      <section className="card card-pad">
        {jobs.length === 0 ? (
          <Empty title="No finished jobs match that." action={<Link href="/production/history" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <Table
            head={
              <>
                <SortTh label="Job" field="job" basePath="/production/history" searchParams={searchParams} />
                <th className="th">{isFender ? 'Process' : 'Rows'}</th>
                <th className="th">Weight</th>
                <SortTh label="Started" field="started" basePath="/production/history" searchParams={searchParams} />
                <SortTh label="Finished" field="finished" basePath="/production/history" searchParams={searchParams} />
                <th className="th">By</th>
                <th className="th sr-only">Print</th>
              </>
            }
          >
            {jobs.map((j) => {
              const weight = j.rows.reduce((s, r) => s + Number(r.tallyWeightKg), 0);
              return (
                <tr key={j.id} className="row">
                  <td className="td font-semibold">
                    {j.jobNumber}
                    {!isFender && j.customerName && <span className="block text-xs font-normal text-ink-muted">{j.customerName}</span>}
                  </td>
                  <td className="td">{isFender ? PROCESS_LABEL[j.process] : `${j.rows.length} row${j.rows.length === 1 ? '' : 's'}`}</td>
                  <td className="td">{tonnes(weight)}</td>
                  <td className="td text-ink-muted whitespace-nowrap">{shortDate(j.startedAt)}</td>
                  <td className="td text-ink-muted whitespace-nowrap">{shortDate(j.finishedAt!)}</td>
                  <td className="td text-ink-muted">{j.user?.name ?? '—'}</td>
                  <td className="td text-right whitespace-nowrap">
                    {canEdit && (
                      <Link href={`/production/jobs/${j.id}/edit`} className="btn-secondary btn-sm mr-2">
                        <Pencil size={14} /> Edit
                      </Link>
                    )}
                    <a href={`/production/jobs/${j.id}/print`} className="btn-secondary btn-sm">
                      <Printer size={14} /> Print
                    </a>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </Shell>
  );
}

function HistoryTabs({ view, tabHref }: { view: string; tabHref: (v: string) => string }) {
  const tab = (v: string, label: string) => (
    <Link
      href={tabHref(v)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === v ? 'bg-white shadow-sm text-ink' : 'text-ink-muted hover:text-ink'}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex gap-1 rounded-xl bg-hairline/60 p-1 mb-5">
      {tab('marks', 'Bar marks')}
      {tab('sheets', 'Tally sheets')}
    </div>
  );
}

function HistoryFilters({ q, from, to, view, isMarks = false }: { q: string; from?: string; to?: string; view?: string; isMarks?: boolean }) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-3">
      {view && <input type="hidden" name="view" value={view} />}
      <div className="flex-1 min-w-[200px]">
        <label className="label text-xs" htmlFor="q">{isMarks ? 'Job, customer or bar mark' : 'Job number or customer'}</label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder={isMarks ? 'e.g. CN92812CN or BMK 131…' : 'Search job number or customer…'} />
      </div>
      <div>
        <label className="label text-xs" htmlFor="from">{isMarks ? 'From' : 'Finished from'}</label>
        <input id="from" name="from" type="date" defaultValue={from} className="input" />
      </div>
      <div>
        <label className="label text-xs" htmlFor="to">{isMarks ? 'To' : 'Finished to'}</label>
        <input id="to" name="to" type="date" defaultValue={to} className="input" />
      </div>
      <button className="btn-secondary">Apply</button>
      {(q || from || to) && <Link href={view ? `/production/history?view=${view}` : '/production/history'} className="btn-secondary">Clear</Link>}
    </form>
  );
}

/** One line per bar mark: each machine it's been through, who by and when, and the cast it went down against. */
function BarMarkTable({ marks }: { marks: MarkHistory[] }) {
  return (
    <Table
      head={
        <>
          <th className="th">Job</th>
          <th className="th">Bar mark</th>
          {MACHINES.map((p) => <th key={p} className="th">{MACHINE[p].name}</th>)}
          <th className="th">Cast</th>
        </>
      }
    >
      {marks.map((m) => {
        const cast = m.steps.CUTTING ?? m.steps.STEMA ?? m.steps.BENDING;
        return (
          <tr key={m.key} className="row align-top">
            <td className="td">
              <span className="font-semibold">{m.jobNumber}</span>
              {m.customerName && <span className="block text-xs text-ink-muted">{m.customerName}</span>}
            </td>
            <td className="td whitespace-nowrap">
              {bmk(m.mark) || '—'}
              {m.diaMm != null && <span className="block text-xs text-ink-muted">H{m.diaMm}</span>}
            </td>
            {MACHINES.map((p) => {
              const step = m.steps[p];
              return (
                <td key={p} className="td whitespace-nowrap">
                  {step ? (
                    <>
                      <span className="font-semibold">{step.by}</span>
                      <span className="block text-xs text-ink-muted">{shortDate(step.at)} {clock(step.at)}</span>
                    </>
                  ) : <span className="text-ink-faint">—</span>}
                </td>
              );
            })}
            <td className="td">
              {cast?.castNumber || '—'}
              {cast?.mill && <span className="block text-xs text-ink-muted">{cast.mill}</span>}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

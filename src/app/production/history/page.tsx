import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, SortTh, Stat, StatRow, Table } from '@/components/ui';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

export default async function ProductionHistoryPage({
  searchParams,
}: { searchParams: { q?: string; from?: string; to?: string; sort?: string; dir?: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';

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

  const q = (searchParams.q ?? '').trim();

  const jobs = await db.productionJob.findMany({
    where: {
      company,
      finishedAt: finishedAtFilter,
      ...(q ? { jobNumber: { contains: q, mode: 'insensitive' } } : {}),
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

      <StatRow>
        <Stat value={jobs.length} label={jobs.length === 200 ? 'Jobs shown (200 max)' : 'Jobs'} />
        <Stat value={tonnes(totalWeight)} label="Total weight" />
        <Stat value={totalRows} label="Rows logged" />
      </StatRow>

      <form className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label text-xs" htmlFor="q">Job number</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Search job number…" />
        </div>
        <div>
          <label className="label text-xs" htmlFor="from">Finished from</label>
          <input id="from" name="from" type="date" defaultValue={searchParams.from} className="input" />
        </div>
        <div>
          <label className="label text-xs" htmlFor="to">Finished to</label>
          <input id="to" name="to" type="date" defaultValue={searchParams.to} className="input" />
        </div>
        <button className="btn-secondary">Apply</button>
        {(q || searchParams.from || searchParams.to) && <Link href="/production/history" className="btn-secondary">Clear</Link>}
      </form>

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
                  <td className="td font-semibold">{j.jobNumber}</td>
                  <td className="td">{isFender ? PROCESS_LABEL[j.process] : `${j.rows.length} row${j.rows.length === 1 ? '' : 's'}`}</td>
                  <td className="td">{tonnes(weight)}</td>
                  <td className="td text-ink-muted whitespace-nowrap">{shortDate(j.startedAt)}</td>
                  <td className="td text-ink-muted whitespace-nowrap">{shortDate(j.finishedAt!)}</td>
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
        )}
      </section>
    </Shell>
  );
}

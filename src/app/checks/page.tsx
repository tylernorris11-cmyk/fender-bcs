import Link from 'next/link';
import { Camera, Plus } from 'lucide-react';
import type { AssetType, CheckResult, Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader, Pill, SortTh, Stat, StatRow, Table } from '@/components/ui';
import { resolveAssetIssue } from './actions';

export default async function ChecksPage({
  searchParams,
}: { searchParams: { type?: AssetType; result?: CheckResult; sort?: string; dir?: string } }) {
  const user = await requirePermission('checks.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.AssetCheckOrderByWithRelationInput =
    searchParams.sort === 'asset' ? { asset: { name: dir } }
    : searchParams.sort === 'result' ? { result: dir }
    : searchParams.sort === 'by' ? { user: { name: dir } }
    : { performedAt: dir === 'asc' ? 'asc' : 'desc' };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [checks, activeAssets, checkedTodayIds, openIssues] = await Promise.all([
    db.assetCheck.findMany({
      where: {
        asset: {
          OR: [{ company: null }, { company }],
          ...(searchParams.type ? { type: searchParams.type } : {}),
        },
        ...(searchParams.result ? { result: searchParams.result } : {}),
      },
      include: { asset: true, user: true, items: true },
      orderBy,
      take: 200,
    }),
    db.asset.findMany({ where: { retired: false, OR: [{ company: null }, { company }] } }),
    db.assetCheck.findMany({ where: { performedAt: { gte: startOfToday } }, select: { assetId: true } }),
    db.assetIssue.findMany({
      where: { resolved: false, asset: { OR: [{ company: null }, { company }] } },
      include: { asset: true, reportedBy: true },
      orderBy: { reportedAt: 'asc' },
    }),
  ]);

  const checkedToday = new Set(checkedTodayIds.map((c) => c.assetId));
  const notCheckedToday = activeAssets.filter((a) => !checkedToday.has(a.id));

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks" alerts={alerts.length}>
      <PageHeader
        title="Checks"
        blurb="Morning pre-use checks on machines, lorries and pickups."
        actions={
          can(user, 'checks.create') && (
            <Link href="/checks/new" className="btn-primary"><Plus size={16} /> Run a check</Link>
          )
        }
      />

      <StatRow>
        <Stat value={activeAssets.length - notCheckedToday.length} label="Checked today" tone="good" />
        <Stat value={notCheckedToday.length} label="Not checked today" tone={notCheckedToday.length ? 'warn' : 'default'} />
        <Stat value={openIssues.length} label="Open issues" tone={openIssues.length ? 'bad' : 'default'} />
        <Stat value={activeAssets.length} label="Active assets" href="/assets" />
      </StatRow>

      {openIssues.length > 0 && (
        <section className="card card-pad mb-6 border-2 border-signal/30">
          <h2 className="text-lg font-bold mb-1">Open issues</h2>
          <p className="text-sm text-ink-muted mb-4">Reported separately from the daily checklist — stays here until someone marks it fixed.</p>
          <ul className="divide-y divide-hairline">
            {openIssues.map((issue) => (
              <li key={issue.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Link href={`/assets/${issue.assetId}`} className="font-semibold text-brand-700 hover:underline">{issue.asset.name}</Link>
                  <span className="text-xs text-ink-faint"> {issue.asset.ref}</span>
                  <p className="text-sm mt-0.5">{issue.description}</p>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {issue.reportedBy?.name ?? 'Unknown'} · {shortDate(issue.reportedAt)} {clock(issue.reportedAt)}
                  </p>
                </div>
                {can(user, 'checks.create') && (
                  <form action={resolveAssetIssue} className="flex items-end gap-2">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <input name="resolutionNote" className="input w-48" placeholder="How was it fixed? (optional)" aria-label="Resolution note" />
                    <button className="btn-secondary btn-sm">Mark fixed</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {notCheckedToday.length > 0 && (
        <div className="banner-warn mb-6">
          <strong>{notCheckedToday.length} {notCheckedToday.length === 1 ? 'asset hasn’t' : 'assets haven’t'} been checked today.</strong>{' '}
          {notCheckedToday.slice(0, 4).map((a) => a.name).join(', ')}
          {notCheckedToday.length > 4 && <> and {notCheckedToday.length - 4} more.</>}
        </div>
      )}

      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Filter">
        <Link href="/checks" className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${!searchParams.type && !searchParams.result ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'}`}>All</Link>
        <Link href="/checks?type=VEHICLE" className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${searchParams.type === 'VEHICLE' ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'}`}>Vehicles</Link>
        <Link href="/checks?type=MACHINE" className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${searchParams.type === 'MACHINE' ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'}`}>Machines</Link>
        <Link href="/checks?result=FAIL" className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${searchParams.result === 'FAIL' ? 'bg-signal text-white border-signal' : 'bg-white border-hairline hover:bg-canvas'}`}>Issues flagged</Link>
      </nav>

      <section className="card card-pad">
        {checks.length === 0 ? (
          <Empty title="No checks match that." action={<Link href="/checks" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <Table
            head={
              <>
                <SortTh label="Asset" field="asset" basePath="/checks" searchParams={searchParams} />
                <SortTh label="When" field="performedAt" basePath="/checks" searchParams={searchParams} />
                <SortTh label="Result" field="result" basePath="/checks" searchParams={searchParams} />
                <SortTh label="By" field="by" basePath="/checks" searchParams={searchParams} />
                <th className="th">Notes</th>
              </>
            }
          >
            {checks.map((c) => (
              <tr key={c.id} className="row">
                <td className="td">
                  <Link href={`/assets/${c.assetId}`} className="font-semibold text-brand-700 hover:underline">{c.asset.name}</Link>
                  <span className="block text-xs text-ink-faint">{c.asset.ref}</span>
                </td>
                <td className="td text-ink-muted whitespace-nowrap">
                  <Link href={`/checks/${c.id}`} className="hover:text-ink hover:underline">{shortDate(c.performedAt)} {clock(c.performedAt)}</Link>
                </td>
                <td className="td"><Pill tone={c.result === 'PASS' ? 'good' : 'bad'}>{c.result === 'PASS' ? 'Pass' : 'Issue flagged'}</Pill></td>
                <td className="td">
                  {c.user && (
                    <span className="flex items-center gap-2">
                      <Avatar name={c.user.name} colour={c.user.colour} size={26} />
                      <span className="text-ink-muted">{c.user.name}</span>
                    </span>
                  )}
                </td>
                <td className="td text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    {c.items.filter((i) => !i.ok).map((i) => i.label).join(', ') || c.notes || '—'}
                    {c.photo && <Camera size={13} className="text-ink-faint shrink-0" aria-label="Has a photo attached" />}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import type { AssetType } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { daysUntil, shortDate } from '@/lib/format';
import { alertWindowDays, type StatutoryCheck } from '@/lib/assets';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, SortSelect, Stat, StatRow } from '@/components/ui';

function DueDate({ label, due, windowDays }: { label: string; due: Date | null; windowDays: number }) {
  if (!due) return null;
  const days = daysUntil(due)!;
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-ink-faint">{label}</span>
      {days < 0 ? <Pill tone="bad">{shortDate(due)} · overdue</Pill>
        : days <= windowDays ? <Pill tone="warn">{shortDate(due)} · {days}d</Pill>
        : <span className="font-medium">{shortDate(due)}</span>}
    </span>
  );
}

export default async function AssetsPage({ searchParams }: { searchParams: { type?: AssetType; retired?: string; q?: string; sort?: string } }) {
  const user = await requirePermission('assets.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const retired = searchParams.retired === '1';
  const type = searchParams.type;
  const q = (searchParams.q ?? '').trim();

  const assets = await db.asset.findMany({
    where: {
      retired,
      OR: [{ company: null }, { company }],
      ...(type ? { type } : {}),
      ...(q ? { AND: [{ OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { makeModel: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { depot: { contains: q, mode: 'insensitive' } },
      ] }] } : {}),
    },
    orderBy: searchParams.sort === 'name' ? { name: 'asc' } : searchParams.sort === 'category' ? { category: 'asc' } : { ref: 'asc' },
  });

  const dueDates = (a: (typeof assets)[number]) => [a.motDue, a.taxDue, a.weeklyCheckDue, a.puwerDue, a.lolerDue, a.serviceDue, a.calibrationDue].filter(Boolean) as Date[];
  if (searchParams.sort === 'due') {
    assets.sort((a, b) => {
      const earliestA = Math.min(...dueDates(a).map((d) => d.getTime()), Infinity);
      const earliestB = Math.min(...dueDates(b).map((d) => d.getTime()), Infinity);
      return earliestA - earliestB;
    });
  }

  const all = await db.asset.findMany({ where: { retired: false, OR: [{ company: null }, { company }] } });
  const checksFor = (a: typeof all[number]): [StatutoryCheck, Date | null][] => [
    ['MOT', a.motDue], ['Road tax', a.taxDue], ['Safety inspection', a.weeklyCheckDue],
    ['PUWER inspection', a.puwerDue], ['LOLER exam', a.lolerDue], ['Service', a.serviceDue],
    ['Measurement calibration', a.calibrationDue],
  ];
  const overdue = all.filter((a) => checksFor(a).some(([, d]) => d && daysUntil(d)! < 0)).length;
  const soon = all.filter((a) => checksFor(a).some(([label, d]) => d && daysUntil(d)! >= 0 && daysUntil(d)! <= alertWindowDays(label, a.category))).length;

  const title = retired ? 'Retired assets' : type === 'MACHINE' ? 'Machinery' : type === 'VEHICLE' ? 'Vehicles' : 'Vehicles & machinery';

  return (
    <Shell
      user={user} module="assets" nav={NAV.assets}
      current={retired ? '/assets?retired=1' : type === 'MACHINE' ? '/assets?type=MACHINE' : type === 'VEHICLE' ? '/assets?type=VEHICLE' : '/assets'}
      alerts={alerts.length}
    >
      <PageHeader
        title={title}
        blurb="Tap a vehicle or machine to see its full record."
        actions={can(user, 'assets.edit') && (
          <Link href="/assets/new" className="btn-primary"><Plus size={16} /> Add asset</Link>
        )}
      />

      <StatRow>
        <Stat value={all.filter((a) => a.type === 'VEHICLE').length} label="Vehicles" href="/assets?type=VEHICLE" />
        <Stat value={all.filter((a) => a.type === 'MACHINE').length} label="Machinery" href="/assets?type=MACHINE" />
        <Stat value={overdue} label="Checks overdue" tone={overdue ? 'bad' : 'default'} />
        <Stat value={soon} label="Due soon" tone={soon ? 'warn' : 'default'} />
      </StatRow>

      <form className="mb-5 flex flex-wrap gap-3">
        {type && <input type="hidden" name="type" value={type} />}
        {retired && <input type="hidden" name="retired" value="1" />}
        <input name="q" defaultValue={q} className="input flex-1 min-w-[220px] max-w-md" placeholder="Search reg, model, type or depot…" aria-label="Search assets" />
        <SortSelect
          value={searchParams.sort}
          options={[
            { value: 'ref', label: 'Reference' },
            { value: 'name', label: 'Name A-Z' },
            { value: 'category', label: 'Category' },
            { value: 'due', label: 'Next check due' },
          ]}
        />
        <button className="btn-secondary">Apply</button>
      </form>

      {assets.length === 0 ? <Empty title="Nothing here." /> : (
        <section className="card overflow-hidden">
          {assets.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b border-hairline last:border-0 hover:bg-canvas transition-colors">
              <div className="min-w-[190px]">
                <p className="font-bold">{a.name}</p>
                <p className="text-xs text-ink-faint">{a.ref} · {a.category} · {a.depot}</p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm flex-1">
                <DueDate label="MOT" due={a.motDue} windowDays={alertWindowDays('MOT', a.category)} />
                <DueDate label="Tax" due={a.taxDue} windowDays={alertWindowDays('Road tax', a.category)} />
                <DueDate label="Safety check" due={a.weeklyCheckDue} windowDays={alertWindowDays('Safety inspection', a.category)} />
                <DueDate label="PUWER" due={a.puwerDue} windowDays={alertWindowDays('PUWER inspection', a.category)} />
                <DueDate label="LOLER" due={a.lolerDue} windowDays={alertWindowDays('LOLER exam', a.category)} />
                <DueDate label="Service" due={a.serviceDue} windowDays={alertWindowDays('Service', a.category)} />
                <DueDate label="Calibration" due={a.calibrationDue} windowDays={alertWindowDays('Measurement calibration', a.category)} />
              </div>
              <ChevronRight size={18} className="text-ink-faint" aria-hidden />
            </Link>
          ))}
        </section>
      )}
    </Shell>
  );
}

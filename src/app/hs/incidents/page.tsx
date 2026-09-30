import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { HsIncidentStatus, HsIncidentType } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { INCIDENT_STATUS_LABEL, INCIDENT_STATUS_TONE, INCIDENT_TYPE_LABEL, INCIDENT_TYPE_TONE } from '@/lib/hs';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { AutoSubmitForm } from '../AutoSubmitForm';
import { Chip, TabLinks } from '../bits';

const TYPE_TABS: { key: HsIncidentType | ''; label: string }[] = [
  { key: '', label: 'All' }, { key: 'INCIDENT', label: 'Incidents' }, { key: 'NEAR_MISS', label: 'Near misses' }, { key: 'HAZARD', label: 'Hazards' },
];

export default async function IncidentsPage({ searchParams }: { searchParams: { type?: string; status?: string; q?: string } }) {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const all = await db.hsIncident.findMany({
    where: { company },
    orderBy: { occurredAt: 'desc' },
    include: { investigator: { select: { name: true } } },
  });
  const type = TYPE_TABS.some((t) => t.key === searchParams.type) ? (searchParams.type as HsIncidentType) : '';
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const rows = all
    .filter((i) => !type || i.type === type)
    .filter((i) => !searchParams.status || i.status === searchParams.status)
    .filter((i) => !q || `${i.ref} ${i.description} ${i.area} ${i.injuredPerson}`.toLowerCase().includes(q));

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key) p.set('type', key);
    if (searchParams.status) p.set('status', searchParams.status);
    if (searchParams.q) p.set('q', searchParams.q);
    const s = p.toString();
    return `/hs/incidents${s ? `?${s}` : ''}`;
  };

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/incidents" alerts={alerts.length}>
      <PageHeader
        title="Incident Reporting"
        blurb="Log incidents, near misses and hazards to keep improving safety."
        actions={<Link href="/hs/incidents/new" className="btn-primary"><Plus size={16} /> Report an incident</Link>}
      />

      <section className="card card-pad">
        <TabLinks
          active={type}
          tabs={TYPE_TABS.map((t) => ({ key: t.key, label: t.label, href: tabHref(t.key), count: t.key ? all.filter((i) => i.type === t.key).length : all.length }))}
        />
        <AutoSubmitForm className="flex flex-wrap gap-3 mb-4">
          {type && <input type="hidden" name="type" value={type} />}
          <label className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="q" defaultValue={searchParams.q} placeholder="Search incidents…" className="input pl-10" aria-label="Search" />
          </label>
          <select name="status" defaultValue={searchParams.status ?? ''} className="input w-auto min-w-[150px]" aria-label="Status">
            <option value="">All status</option>
            {(Object.keys(INCIDENT_STATUS_LABEL) as HsIncidentStatus[]).map((s) => <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>)}
          </select>
        </AutoSubmitForm>

        {rows.length === 0 ? (
          <Empty title={all.length === 0 ? 'Nothing reported yet.' : 'Nothing matches those filters.'} />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Ref</th>
                  <th className="th">Type</th>
                  <th className="th">Description</th>
                  <th className="th">Area</th>
                  <th className="th">Status</th>
                  <th className="th">Investigator</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="row">
                    <td className="td whitespace-nowrap">{shortDate(i.occurredAt)}</td>
                    <td className="td whitespace-nowrap tabular-nums">
                      <Link href={`/hs/incidents/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.ref}</Link>
                    </td>
                    <td className="td"><Chip tone={INCIDENT_TYPE_TONE[i.type]}>{INCIDENT_TYPE_LABEL[i.type]}</Chip></td>
                    <td className="td max-w-[320px]">
                      <Link href={`/hs/incidents/${i.id}`} className="block truncate hover:text-brand-700">{i.description}</Link>
                    </td>
                    <td className="td text-ink-muted">{i.area || '—'}</td>
                    <td className="td">
                      <Chip tone={INCIDENT_STATUS_TONE[i.status]}>{INCIDENT_STATUS_LABEL[i.status]}</Chip>
                      {i.riddor && <Chip tone="bg-signal text-white ml-1">RIDDOR</Chip>}
                    </td>
                    <td className="td text-ink-muted">{i.investigator?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}

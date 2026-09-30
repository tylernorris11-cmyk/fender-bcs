import type { HsIncidentType } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { isoDateUk } from '@/lib/format';
import {
  INCIDENT_TYPE_LABEL, REVIEW_STATUS_LABEL, TICKET_STATUS_LABEL, actionStatus, reviewStatus, ticketStatus,
  type ReviewStatus, type TicketStatus,
} from '@/lib/hs';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';

const TYPE_BAR: Record<HsIncidentType, string> = { INCIDENT: 'bg-signal', NEAR_MISS: 'bg-amber-400', HAZARD: 'bg-sky-400' };
const TYPES: HsIncidentType[] = ['INCIDENT', 'NEAR_MISS', 'HAZARD'];

/** A labelled split of a total, as one bar with a legend under it. */
function SplitBar({ parts }: { parts: { label: string; value: number; colour: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-canvas">
        {total > 0 && parts.map((p) => p.value > 0 && <div key={p.label} className={p.colour} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${p.colour}`} /> {p.label} <span className="font-semibold tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function HsReportingPage() {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const today = isoDateUk();

  // The last 12 calendar months, this one included.
  const [y, m] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) };
  });
  const since = new Date(`${months[0].key}-01T00:00:00Z`);

  const [incidents, lastIncident, actions, assessments, records] = await Promise.all([
    db.hsIncident.findMany({ where: { company, occurredAt: { gte: since } }, select: { type: true, occurredAt: true, area: true, riddor: true } }),
    db.hsIncident.findFirst({ where: { company, type: 'INCIDENT' }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
    db.hsAction.findMany({ where: { company }, select: { dueOn: true, completedAt: true, createdAt: true } }),
    db.hsAssessment.findMany({ where: { archived: false, OR: [{ company: null }, { company }] }, select: { reviewDue: true, archived: true } }),
    db.hsTrainingRecord.findMany({ where: { OR: [{ userId: null }, { user: { companies: { has: company } } }] }, select: { expiresOn: true } }),
  ]);

  const monthKey = (d: Date) => isoDateUk(d).slice(0, 7);
  const byMonth = months.map((mo) => ({
    ...mo,
    counts: TYPES.map((t) => incidents.filter((i) => i.type === t && monthKey(i.occurredAt) === mo.key).length),
  }));
  const peak = Math.max(1, ...byMonth.map((mo) => mo.counts.reduce((s, c) => s + c, 0)));
  const count = (t: HsIncidentType) => incidents.filter((i) => i.type === t).length;

  const areaCounts = [...incidents.reduce((m, i) => m.set(i.area || 'Not given', (m.get(i.area || 'Not given') ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const areaPeak = Math.max(1, ...areaCounts.map(([, n]) => n));

  const daysSince = lastIncident
    ? Math.round((Date.parse(today) - Date.parse(isoDateUk(lastIncident.occurredAt))) / 86_400_000)
    : null;

  const actionStatuses = actions.map((a) => actionStatus(a, today));
  const completedRecently = actions.filter((a) => a.completedAt && a.completedAt >= since);
  const onTime = completedRecently.filter((a) => isoDateUk(a.completedAt!) <= a.dueOn.toISOString().slice(0, 10)).length;

  const reviewCounts = (['LIVE', 'DUE', 'OVERDUE'] as ReviewStatus[]).map((s) => ({ s, n: assessments.filter((a) => reviewStatus(a, today) === s).length }));
  const ticketCounts = (['VALID', 'EXPIRING', 'EXPIRED', 'NO_EXPIRY'] as TicketStatus[]).map((s) => ({ s, n: records.filter((r) => ticketStatus(r, today) === s).length }));

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/reporting" alerts={alerts.length}>
      <PageHeader title="Reporting" blurb="How safety is trending over the last 12 months." />

      <StatRow>
        <Stat value={daysSince ?? '—'} label={daysSince == null ? 'No incidents recorded' : 'Days since the last incident'} tone="good" />
        <Stat value={count('INCIDENT')} label="Incidents" tone={count('INCIDENT') ? 'bad' : 'default'} />
        <Stat value={count('NEAR_MISS')} label="Near misses reported" />
        <Stat value={incidents.filter((i) => i.riddor).length} label="RIDDOR reportable" />
      </StatRow>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <section className="card card-pad lg:col-span-2">
          <h2 className="text-lg font-bold mb-1">Reports by month</h2>
          <p className="text-sm text-ink-muted mb-5">
            Plenty of near misses and hazards reported against few incidents is a good sign: people are spotting things before someone gets hurt.
          </p>
          <div className="flex items-end gap-1.5 sm:gap-2 h-48">
            {byMonth.map((mo) => {
              const total = mo.counts.reduce((s, c) => s + c, 0);
              return (
                <div key={mo.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${mo.label}: ${TYPES.map((t, i) => `${mo.counts[i]} ${INCIDENT_TYPE_LABEL[t].toLowerCase()}`).join(', ')}`}>
                  <span className="text-[11px] text-ink-muted tabular-nums mb-1">{total || ''}</span>
                  <div className="w-full max-w-[36px] flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${(total / peak) * 100}%` }}>
                    {TYPES.map((t, i) => mo.counts[i] > 0 && <div key={t} className={TYPE_BAR[t]} style={{ height: `${(mo.counts[i] / total) * 100}%` }} />)}
                  </div>
                  <span className="text-[11px] text-ink-faint mt-1.5">{mo.label}</span>
                </div>
              );
            })}
          </div>
          <ul className="flex flex-wrap gap-4 mt-4 text-sm">
            {TYPES.map((t) => (
              <li key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${TYPE_BAR[t]}`} /> {INCIDENT_TYPE_LABEL[t]}</li>
            ))}
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Where they happen</h2>
          {areaCounts.length === 0 ? <p className="text-sm text-ink-muted">Nothing reported in the last 12 months.</p> : (
            <ul className="space-y-3">
              {areaCounts.map(([area, n]) => (
                <li key={area}>
                  <div className="flex justify-between text-sm mb-1"><span>{area}</span><span className="font-semibold tabular-nums">{n}</span></div>
                  <div className="h-2 rounded-full bg-canvas overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(n / areaPeak) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Actions</h2>
          <p className="text-sm text-ink-muted mb-4">
            {completedRecently.length
              ? `${Math.round((onTime / completedRecently.length) * 100)}% of the ${completedRecently.length} completed in the last 12 months were done on time.`
              : 'None completed in the last 12 months yet.'}
          </p>
          <SplitBar parts={[
            { label: 'Overdue', value: actionStatuses.filter((s) => s === 'OVERDUE').length, colour: 'bg-signal' },
            { label: 'Due this week', value: actionStatuses.filter((s) => s === 'DUE_SOON').length, colour: 'bg-amber-400' },
            { label: 'Open', value: actionStatuses.filter((s) => s === 'OPEN').length, colour: 'bg-sky-400' },
          ]} />
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Risk assessments and method statements</h2>
          <p className="text-sm text-ink-muted mb-4">{assessments.length} on the register.</p>
          <SplitBar parts={reviewCounts.map(({ s, n }) => ({
            label: REVIEW_STATUS_LABEL[s], value: n, colour: s === 'LIVE' ? 'bg-brand' : s === 'DUE' ? 'bg-amber-400' : 'bg-signal',
          }))} />
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Training records</h2>
          <p className="text-sm text-ink-muted mb-4">{records.length} tickets and certificates held.</p>
          <SplitBar parts={ticketCounts.map(({ s, n }) => ({
            label: TICKET_STATUS_LABEL[s], value: n,
            colour: s === 'VALID' ? 'bg-brand' : s === 'EXPIRING' ? 'bg-amber-400' : s === 'EXPIRED' ? 'bg-signal' : 'bg-slate-300',
          }))} />
        </section>
      </div>
    </Shell>
  );
}

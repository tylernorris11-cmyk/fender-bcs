import Link from 'next/link';
import { ChevronRight, FileText, Plus, Search } from 'lucide-react';
import type { HsAssessmentKind } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { isoDateUk } from '@/lib/format';
import {
  ASSESSMENT_KIND, REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE, RISK_LEVEL_LABEL, RISK_LEVEL_TONE, reviewStatus, type ReviewStatus,
} from '@/lib/hs';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { AutoSubmitForm } from '../AutoSubmitForm';
import { Chip, dayLabel } from '../bits';

export type RegisterParams = { q?: string; area?: string; status?: string };

/** The register of risk assessments or method statements, with search and filters. */
export async function AssessmentRegister({ kind, searchParams }: { kind: HsAssessmentKind; searchParams: RegisterParams }) {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const k = ASSESSMENT_KIND[kind];
  const showArchived = searchParams.status === 'ARCHIVED';

  const all = await db.hsAssessment.findMany({
    where: { kind, archived: showArchived, OR: [{ company: null }, { company }] },
    orderBy: [{ reviewDue: 'asc' }],
    include: { _count: { select: { hazards: true } } },
  });

  const today = isoDateUk();
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const rows = all
    .map((a) => ({ ...a, status: reviewStatus(a, today) }))
    .filter((a) => !q || `${a.ref} ${a.title} ${a.area}`.toLowerCase().includes(q))
    .filter((a) => !searchParams.area || a.area === searchParams.area)
    .filter((a) => !searchParams.status || showArchived || a.status === searchParams.status);
  const areas = [...new Set(all.map((a) => a.area).filter(Boolean))].sort();
  const statuses: ReviewStatus[] = ['LIVE', 'DUE', 'OVERDUE', 'ARCHIVED'];

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current={k.path} alerts={alerts.length}>
      <PageHeader
        title={k.plural}
        blurb={k.blurb}
        actions={can(user, 'hs.edit') && (
          <Link href={`${k.path}/new`} className="btn-primary"><Plus size={16} /> New {k.label.toLowerCase()}</Link>
        )}
      />

      <section className="card card-pad">
        <AutoSubmitForm className="flex flex-wrap gap-3 mb-4">
          <label className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="q" defaultValue={searchParams.q} placeholder={`Search ${k.plural.toLowerCase()}…`} className="input pl-10" aria-label="Search" />
          </label>
          <select name="area" defaultValue={searchParams.area ?? ''} className="input w-auto min-w-[150px]" aria-label="Area">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select name="status" defaultValue={searchParams.status ?? ''} className="input w-auto min-w-[150px]" aria-label="Status">
            <option value="">All status</option>
            {statuses.map((s) => <option key={s} value={s}>{REVIEW_STATUS_LABEL[s]}</option>)}
          </select>
        </AutoSubmitForm>

        {rows.length === 0 ? (
          <Empty
            title={all.length === 0 && !showArchived ? `No ${k.plural.toLowerCase()} yet.` : 'Nothing matches those filters.'}
            action={all.length === 0 && !showArchived && can(user, 'hs.edit')
              ? <Link href={`${k.path}/new`} className="btn-primary"><Plus size={16} /> Add the first one</Link>
              : undefined}
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th">Ref</th>
                  <th className="th">Title</th>
                  <th className="th">Area</th>
                  <th className="th">Hazard level</th>
                  <th className="th">Review date</th>
                  <th className="th">Status</th>
                  <th className="th w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="row">
                    <td className="td text-ink-muted tabular-nums whitespace-nowrap">{a.ref}</td>
                    <td className="td">
                      <Link href={`${k.path}/${a.id}`} className="font-medium hover:text-brand-700">{a.title}</Link>
                      {a.fileUrl && <FileText size={13} className="inline ml-1.5 text-ink-faint" aria-label="Signed copy on file" />}
                    </td>
                    <td className="td text-ink-muted">{a.area || '—'}</td>
                    <td className="td"><Chip tone={RISK_LEVEL_TONE[a.riskLevel]}>{RISK_LEVEL_LABEL[a.riskLevel]}</Chip></td>
                    <td className="td whitespace-nowrap">{dayLabel(a.reviewDue)}</td>
                    <td className="td"><Chip tone={REVIEW_STATUS_TONE[a.status]}>{REVIEW_STATUS_LABEL[a.status]}</Chip></td>
                    <td className="td">
                      <Link href={`${k.path}/${a.id}`} aria-label={`Open ${a.title}`} className="text-ink-faint hover:text-ink"><ChevronRight size={18} /></Link>
                    </td>
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

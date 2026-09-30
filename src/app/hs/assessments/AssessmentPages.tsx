import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, Pencil, Printer } from 'lucide-react';
import type { HsAssessmentKind } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { isoDateUk, shortDate } from '@/lib/format';
import {
  ASSESSMENT_KIND, LIKELIHOOD_LABEL, REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE, RISK_LEVEL_LABEL, RISK_LEVEL_TONE, SEVERITY_LABEL,
  dayInput, reviewStatus, riskLevelFor,
} from '@/lib/hs';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { PrintActions } from '@/components/PrintActions';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionsPanel } from '../ActionsPanel';
import { Chip, Detail, dayLabel } from '../bits';
import { AssessmentForm } from './AssessmentForm';
import { markAssessmentReviewed, setAssessmentArchived } from './actions';

/** A year from today, the usual review interval. */
const aYearOn = () => {
  const d = new Date(`${isoDateUk()}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return dayInput(d);
};

async function load(kind: HsAssessmentKind, id: string, company: string) {
  const a = await db.hsAssessment.findUnique({
    where: { id },
    include: {
      hazards: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { name: true } },
      actions: { include: { owner: { select: { name: true } } }, orderBy: [{ completedAt: 'asc' }, { dueOn: 'asc' }] },
    },
  });
  if (!a || a.kind !== kind || (a.company && a.company !== company)) notFound();
  return a;
}

export async function AssessmentDetail({ kind, id }: { kind: HsAssessmentKind; id: string }) {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const k = ASSESSMENT_KIND[kind];
  const a = await load(kind, id, company);
  const canEdit = can(user, 'hs.edit');
  const status = reviewStatus(a);
  const people = canEdit ? await hsPeople(company) : [];
  const written = a.hazards.length > 0 || a.steps.length > 0;

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current={k.path} alerts={alerts.length}>
      <Link href={k.path} className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
        <ArrowLeft size={15} /> Back to {k.plural.toLowerCase()}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-ink-muted tabular-nums">{a.ref}</p>
          <h1 className="text-3xl font-bold tracking-tight">{a.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Chip tone={RISK_LEVEL_TONE[a.riskLevel]}>{RISK_LEVEL_LABEL[a.riskLevel]} hazard</Chip>
            <Chip tone={REVIEW_STATUS_TONE[status]}>{REVIEW_STATUS_LABEL[status]}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {written && <Link href={`${k.path}/${a.id}/print`} className="btn-secondary"><Printer size={16} /> Print</Link>}
          {canEdit && <Link href={`${k.path}/${a.id}/edit`} className="btn-primary"><Pencil size={16} /> Edit</Link>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2 space-y-6">
          {kind === 'METHOD_STATEMENT' && a.steps.length > 0 && (
            <section className="card card-pad">
              <h2 className="text-lg font-bold mb-3">Sequence of work</h2>
              <ol className="space-y-2">
                {a.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="grid place-items-center h-6 w-6 rounded-full bg-brand-50 text-forest text-xs font-bold shrink-0">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {a.hazards.length > 0 && (
            <section className="card card-pad">
              <h2 className="text-lg font-bold mb-3">Hazards and controls</h2>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="th">Hazard</th>
                      <th className="th">Who could be hurt</th>
                      <th className="th">Controls in place</th>
                      <th className="th">Risk left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.hazards.map((h) => {
                      const score = h.likelihood * h.severity;
                      const level = riskLevelFor(score);
                      return (
                        <tr key={h.id} className="border-t border-hairline align-top">
                          <td className="td font-medium align-top">{h.hazard}</td>
                          <td className="td text-ink-muted align-top">{h.whoAtRisk || '—'}</td>
                          <td className="td align-top whitespace-pre-line">{h.controls || '—'}</td>
                          <td className="td align-top whitespace-nowrap">
                            <Chip tone={RISK_LEVEL_TONE[level]}>{score} · {RISK_LEVEL_LABEL[level]}</Chip>
                            <p className="text-[11px] text-ink-faint mt-1">{LIKELIHOOD_LABEL[h.likelihood]} × {SEVERITY_LABEL[h.severity].toLowerCase()}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!written && (
            <section className="card card-pad text-sm text-ink-muted">
              {a.fileUrl
                ? <>The signed copy is the whole {k.label.toLowerCase()}. <a href={blobFileHref(a.fileUrl)} target="_blank" rel="noreferrer" className="text-brand-700 font-medium hover:underline">Open it</a>.</>
                : 'Nothing written in yet.'}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card card-pad">
            <h2 className="text-lg font-bold mb-2">Details</h2>
            <dl>
              <Detail label="Area">{a.area}</Detail>
              <Detail label="Applies to">{a.company ? COMPANY_LABEL[a.company] : 'Both companies'}</Detail>
              <Detail label="Review due">{dayLabel(a.reviewDue)}</Detail>
              <Detail label="Last reviewed">{a.lastReviewedAt ? shortDate(a.lastReviewedAt) : ''}</Detail>
              <Detail label="Added">{`${shortDate(a.createdAt)}${a.createdBy ? ` by ${a.createdBy.name}` : ''}`}</Detail>
              <Detail label="Signed copy">
                {a.fileUrl && (
                  <a href={blobFileHref(a.fileUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 font-medium hover:underline">
                    <FileText size={14} /> {a.fileName || 'Open'}
                  </a>
                )}
              </Detail>
            </dl>
          </section>

          {canEdit && (
            <section className="card card-pad">
              <h2 className="text-lg font-bold mb-1">Review</h2>
              <p className="text-sm text-ink-muted mb-3">Reviewed it and nothing&apos;s changed? Record it here and set the next date. If something has changed, edit it first.</p>
              <form action={markAssessmentReviewed} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={a.id} />
                <div className="flex-1 min-w-[150px]">
                  <label className="label text-xs" htmlFor="nextReview">Next review</label>
                  <input id="nextReview" name="nextReview" type="date" required defaultValue={aYearOn()} className="input py-2" />
                </div>
                <SubmitButton className="btn-primary py-2" pendingLabel="Saving…">Mark reviewed</SubmitButton>
              </form>
              <form action={setAssessmentArchived} className="mt-4 pt-4 border-t border-hairline">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="archived" value={a.archived ? '0' : '1'} />
                <SubmitButton className="btn-ghost btn-sm" pendingLabel="Saving…">
                  {a.archived ? 'Put back on the register' : 'Archive — no longer in use'}
                </SubmitButton>
              </form>
            </section>
          )}
        </div>
      </div>

      <ActionsPanel actions={a.actions} people={people} assessmentId={a.id} canEdit={canEdit} userId={user.id} />
    </Shell>
  );
}

export async function AssessmentEdit({ kind, id }: { kind: HsAssessmentKind; id?: string }) {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const k = ASSESSMENT_KIND[kind];
  const a = id ? await load(kind, id, company) : null;

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current={k.path} alerts={alerts.length}>
      <Link href={a ? `${k.path}/${a.id}` : k.path} className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
        <ArrowLeft size={15} /> {a ? `Back to ${a.ref}` : `Back to ${k.plural.toLowerCase()}`}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight mb-6">{a ? `Edit ${a.ref}` : `New ${k.label.toLowerCase()}`}</h1>
      <AssessmentForm
        kind={kind}
        companies={user.companies.map((c) => ({ value: c, label: COMPANY_LABEL[c] }))}
        defaultReviewDue={aYearOn()}
        cancelHref={a ? `${k.path}/${a.id}` : k.path}
        initial={a ? {
          id: a.id, title: a.title, area: a.area, company: a.company, riskLevel: a.riskLevel,
          reviewDue: dayInput(a.reviewDue), steps: a.steps, fileName: a.fileName,
          fileHref: a.fileUrl ? blobFileHref(a.fileUrl) : null,
          hazards: a.hazards.map((h) => ({ hazard: h.hazard, whoAtRisk: h.whoAtRisk, controls: h.controls, likelihood: h.likelihood, severity: h.severity })),
        } : undefined}
      />
    </Shell>
  );
}

/** A printable copy with sign-off lines, same bare-page convention as the other print sheets. */
export async function AssessmentPrint({ kind, id }: { kind: HsAssessmentKind; id: string }) {
  const user = await requirePermission('hs.view');
  const company = getActiveCompany(user);
  const k = ASSESSMENT_KIND[kind];
  const a = await load(kind, id, company);
  const isFender = (a.company ?? company) === 'FENDER';

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={950} />
      <div className="p-10 max-w-[950px] mx-auto text-[13px] text-black">
        <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: isFender ? 'rgb(13,74,66)' : 'rgb(230,126,34)' }}>
          {isFender ? (
            <Image src="/fender-logo.png" alt="Fender" width={170} height={119} priority className="w-[170px] h-auto" />
          ) : (
            <span className="inline-block bg-[rgb(23,20,15)] rounded-md px-3 py-2">
              <Image src="/bcs-logo.png" alt="BCS Products" width={140} height={113} priority className="w-[140px] h-auto" />
            </span>
          )}
          <div className="text-right">
            <h1 className="text-xl font-bold">{k.label}</h1>
            <p className="font-semibold">{a.ref}</p>
            <p>Hazard level: {RISK_LEVEL_LABEL[a.riskLevel]}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold mb-2">{a.title}</h2>
        <table className="mb-6">
          <tbody>
            <tr><td className="pr-6 py-0.5 text-black/60">Area</td><td>{a.area || '—'}</td></tr>
            <tr><td className="pr-6 py-0.5 text-black/60">Applies to</td><td>{a.company ? COMPANY_LABEL[a.company] : 'Both companies'}</td></tr>
            <tr><td className="pr-6 py-0.5 text-black/60">Review due</td><td>{dayLabel(a.reviewDue)}</td></tr>
            <tr><td className="pr-6 py-0.5 text-black/60">Last reviewed</td><td>{a.lastReviewedAt ? shortDate(a.lastReviewedAt) : '—'}</td></tr>
          </tbody>
        </table>

        {a.steps.length > 0 && (
          <>
            <h3 className="font-bold uppercase tracking-wide text-[11px] mb-2">Sequence of work</h3>
            <ol className="list-decimal pl-5 mb-6 space-y-1">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </>
        )}

        {a.hazards.length > 0 && (
          <>
            <h3 className="font-bold uppercase tracking-wide text-[11px] mb-2">Hazards and controls</h3>
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
                  <th className="py-2 pr-3">Hazard</th>
                  <th className="py-2 pr-3">Who could be hurt</th>
                  <th className="py-2 pr-3">Controls in place</th>
                  <th className="py-2 text-right">L × S</th>
                </tr>
              </thead>
              <tbody>
                {a.hazards.map((h) => (
                  <tr key={h.id} className="border-b border-black/10 align-top">
                    <td className="py-2 pr-3 font-medium">{h.hazard}</td>
                    <td className="py-2 pr-3">{h.whoAtRisk}</td>
                    <td className="py-2 pr-3 whitespace-pre-line">{h.controls}</td>
                    <td className="py-2 text-right whitespace-nowrap">{h.likelihood} × {h.severity} = {h.likelihood * h.severity} ({RISK_LEVEL_LABEL[riskLevelFor(h.likelihood * h.severity)]})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="grid grid-cols-3 gap-8 mt-12">
          {['Assessed by', 'Signature', 'Date'].map((l) => (
            <div key={l}>
              <div className="border-b border-black/40 h-8" />
              <p className="text-[11px] text-black/60 mt-1">{l}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-8 mt-8">
          {['Read and understood by', 'Signature', 'Date'].map((l) => (
            <div key={l}>
              <div className="border-b border-black/40 h-8" />
              <p className="text-[11px] text-black/60 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

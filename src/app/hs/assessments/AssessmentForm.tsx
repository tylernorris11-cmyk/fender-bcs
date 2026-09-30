'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { Company, HsAssessmentKind, HsRiskLevel } from '@prisma/client';
import {
  ASSESSMENT_KIND, HS_AREAS, LIKELIHOOD_LABEL, RISK_LEVEL_LABEL, RISK_LEVEL_TONE, SEVERITY_LABEL, chip, riskLevelFor,
} from '@/lib/hs';
import { SubmitButton } from '@/components/SubmitButton';
import { saveAssessment } from './actions';

export type HazardRow = { hazard: string; whoAtRisk: string; controls: string; likelihood: number; severity: number };

export type AssessmentFormInitial = {
  id: string;
  title: string;
  area: string;
  company: Company | null;
  riskLevel: HsRiskLevel;
  reviewDue: string;
  steps: string[];
  fileName: string;
  fileHref: string | null;
  hazards: HazardRow[];
};

const blankHazard = (): HazardRow => ({ hazard: '', whoAtRisk: '', controls: '', likelihood: 2, severity: 2 });
const SCORES = [1, 2, 3, 4, 5];

export function AssessmentForm({
  kind, companies, initial, defaultReviewDue, cancelHref,
}: {
  kind: HsAssessmentKind;
  companies: { value: Company; label: string }[];
  initial?: AssessmentFormInitial;
  defaultReviewDue: string;
  cancelHref: string;
}) {
  const k = ASSESSMENT_KIND[kind];
  const [hazards, setHazards] = useState<HazardRow[]>(initial?.hazards.length ? initial.hazards : []);
  const update = (i: number, patch: Partial<HazardRow>) => setHazards((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const written = hazards.filter((h) => h.hazard.trim());
  const worst = written.reduce<HsRiskLevel | null>((w, h) => {
    const l = riskLevelFor(h.likelihood * h.severity);
    return !w || l === 'HIGH' || (l === 'MEDIUM' && w === 'LOW') ? l : w;
  }, null);

  return (
    <form action={saveAssessment} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="hazards" value={JSON.stringify(hazards)} />

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required defaultValue={initial?.title} className="input"
              placeholder={kind === 'RISK_ASSESSMENT' ? 'Coil handling with overhead crane' : 'Loading and unloading vehicles'} />
          </div>
          <div>
            <label className="label" htmlFor="area">Area</label>
            <input id="area" name="area" list="hs-areas" defaultValue={initial?.area} className="input" placeholder="Yard" />
            <datalist id="hs-areas">{HS_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="company">Applies to</label>
            <select id="company" name="company" defaultValue={initial?.company ?? ''} className="input">
              <option value="">Both companies</option>
              {companies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="reviewDue">Next review due</label>
            <input id="reviewDue" name="reviewDue" type="date" required defaultValue={initial?.reviewDue ?? defaultReviewDue} className="input" />
            <p className="hint">Flagged a month before it&apos;s due.</p>
          </div>
          <div>
            <label className="label" htmlFor="riskLevel">Hazard level</label>
            {worst ? (
              <p className="py-2.5 text-sm">
                <span className={`${chip} ${RISK_LEVEL_TONE[worst]}`}>{RISK_LEVEL_LABEL[worst]}</span>
                <span className="text-ink-muted ml-2">the highest risk left in the hazards below</span>
              </p>
            ) : (
              <select id="riskLevel" name="riskLevel" defaultValue={initial?.riskLevel ?? 'MEDIUM'} className="input">
                {(['HIGH', 'MEDIUM', 'LOW'] as HsRiskLevel[]).map((l) => <option key={l} value={l}>{RISK_LEVEL_LABEL[l]}</option>)}
              </select>
            )}
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-1">Signed copy</h2>
        <p className="text-sm text-ink-muted mb-4">Upload the signed {k.label.toLowerCase()} if you have one — PDF, Word or a photo.</p>
        {initial?.fileHref && (
          <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
            <a href={initial.fileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
              <FileText size={15} /> {initial.fileName || 'Current file'}
            </a>
            <label className="inline-flex items-center gap-2 text-ink-muted">
              <input type="checkbox" name="removeFile" className="h-4 w-4 accent-brand" /> Remove it
            </label>
          </div>
        )}
        <input name="file" type="file" className="input"
          accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        {initial?.fileHref && <p className="hint">Choosing a new file replaces the current one.</p>}
      </section>

      {kind === 'METHOD_STATEMENT' && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Sequence of work</h2>
          <p className="text-sm text-ink-muted mb-4">One step per line, in the order the job is done.</p>
          <textarea name="steps" rows={8} defaultValue={initial?.steps.join('\n')} className="input"
            placeholder={'Check the load and the delivery note\nPosition the lorry on level ground\n…'} />
        </section>
      )}

      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold">Hazards and controls</h2>
          <button type="button" onClick={() => setHazards((rows) => [...rows, blankHazard()])} className="btn-secondary btn-sm">
            <Plus size={15} /> Add a hazard
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Score each one for the risk left once the controls are in place: likelihood × severity, each out of 5.
          {hazards.length === 0 && ' Leave this empty if the signed copy covers it.'}
        </p>

        <ol className="space-y-4">
          {hazards.map((h, i) => {
            const score = h.likelihood * h.severity;
            const level = riskLevelFor(score);
            return (
              <li key={i} className="rounded-xl border border-hairline p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Hazard {i + 1}</span>
                  <button type="button" onClick={() => setHazards((rows) => rows.filter((_, j) => j !== i))}
                    className="text-ink-faint hover:text-signal" aria-label={`Remove hazard ${i + 1}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label text-xs" htmlFor={`hz-${i}`}>Hazard</label>
                    <textarea id={`hz-${i}`} rows={2} value={h.hazard} onChange={(e) => update(i, { hazard: e.target.value })} className="input"
                      placeholder="Coil swinging while being lifted" />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`who-${i}`}>Who could be hurt</label>
                    <textarea id={`who-${i}`} rows={2} value={h.whoAtRisk} onChange={(e) => update(i, { whoAtRisk: e.target.value })} className="input"
                      placeholder="Crane operator, anyone in the yard" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs" htmlFor={`ctl-${i}`}>Controls in place</label>
                    <textarea id={`ctl-${i}`} rows={2} value={h.controls} onChange={(e) => update(i, { controls: e.target.value })} className="input"
                      placeholder="Trained operators only, exclusion zone, tag lines, inspected slings" />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3 mt-3">
                  <div>
                    <label className="label text-xs" htmlFor={`l-${i}`}>Likelihood</label>
                    <select id={`l-${i}`} value={h.likelihood} onChange={(e) => update(i, { likelihood: Number(e.target.value) })} className="input w-auto">
                      {SCORES.map((s) => <option key={s} value={s}>{s} · {LIKELIHOOD_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <span className="pb-3 text-ink-faint">×</span>
                  <div>
                    <label className="label text-xs" htmlFor={`s-${i}`}>Severity</label>
                    <select id={`s-${i}`} value={h.severity} onChange={(e) => update(i, { severity: Number(e.target.value) })} className="input w-auto">
                      {SCORES.map((s) => <option key={s} value={s}>{s} · {SEVERITY_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <span className="pb-3 text-ink-faint">=</span>
                  <span className={`${chip} ${RISK_LEVEL_TONE[level]} mb-2.5`}>{score} · {RISK_LEVEL_LABEL[level]}</span>
                </div>
              </li>
            );
          })}
        </ol>
        {hazards.length > 0 && (
          <button type="button" onClick={() => setHazards((rows) => [...rows, blankHazard()])} className="btn-ghost btn-sm mt-3">
            <Plus size={15} /> Add another hazard
          </button>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
        <SubmitButton pendingLabel="Saving…">{initial ? 'Save changes' : `Add ${k.label.toLowerCase()}`}</SubmitButton>
      </div>
    </form>
  );
}

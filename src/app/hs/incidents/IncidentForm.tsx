'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, TriangleAlert } from 'lucide-react';
import type { HsIncidentStatus, HsIncidentType } from '@prisma/client';
import { HS_AREAS, INCIDENT_STATUS_LABEL } from '@/lib/hs';
import { SubmitButton } from '@/components/SubmitButton';
import { reportIncident, updateIncident } from './actions';
import { PhotoPicker } from './PhotoPicker';

export type IncidentFormInitial = {
  id: string;
  type: HsIncidentType;
  date: string;
  time: string;
  area: string;
  description: string;
  injuredPerson: string;
  injury: string;
  immediateAction: string;
  riddor: boolean;
  status: HsIncidentStatus;
  investigatorId: string;
  findings: string;
};

const TYPES: { value: HsIncidentType; label: string; sub: string; icon: typeof AlertTriangle; on: string }[] = [
  { value: 'INCIDENT', label: 'Incident', sub: 'Injury or damage', icon: AlertTriangle, on: 'border-signal bg-signal/5 text-signal' },
  { value: 'NEAR_MISS', label: 'Near miss', sub: 'No injury', icon: AlertCircle, on: 'border-amber-500 bg-amber-50 text-amber-800' },
  { value: 'HAZARD', label: 'Hazard', sub: 'Report a risk', icon: TriangleAlert, on: 'border-sky-500 bg-sky-50 text-sky-800' },
];

/** Reporting an incident, near miss or hazard — and, with `initial`, editing one and its investigation. */
export function IncidentForm({
  initial, people, defaultDate, defaultTime, cancelHref,
}: {
  initial?: IncidentFormInitial;
  people: { id: string; name: string }[];
  defaultDate: string;
  defaultTime: string;
  cancelHref: string;
}) {
  const [type, setType] = useState<HsIncidentType>(initial?.type ?? 'INCIDENT');

  return (
    <form action={initial ? updateIncident : reportIncident} className="space-y-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-3">What are you reporting?</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setType(t.value)} aria-pressed={type === t.value}
              className={`rounded-xl border-2 p-3 text-center transition-colors ${type === t.value ? t.on : 'border-hairline hover:bg-canvas'}`}>
              <t.icon size={22} className="mx-auto mb-1" />
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-[11px] opacity-75">{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">What happened</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={initial?.date ?? defaultDate} max={defaultDate} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="time">Time</label>
            <input id="time" name="time" type="time" required defaultValue={initial?.time ?? defaultTime} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="area">Where</label>
            <input id="area" name="area" list="incident-areas" defaultValue={initial?.area} className="input" placeholder="Machine shop" />
            <datalist id="incident-areas">{HS_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" required rows={4} defaultValue={initial?.description} className="input"
              placeholder={type === 'HAZARD' ? 'What is the risk, and where exactly?' : 'What happened, step by step?'} />
          </div>
          {type === 'INCIDENT' && (
            <>
              <div>
                <label className="label" htmlFor="injuredPerson">Who was hurt</label>
                <input id="injuredPerson" name="injuredPerson" defaultValue={initial?.injuredPerson} className="input" placeholder="Leave blank if nobody" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="injury">Injury or damage</label>
                <input id="injury" name="injury" defaultValue={initial?.injury} className="input" placeholder="Small cut to hand from burr on rebar" />
              </div>
            </>
          )}
          <div className="sm:col-span-3">
            <label className="label" htmlFor="immediateAction">What was done straight away</label>
            <textarea id="immediateAction" name="immediateAction" rows={2} defaultValue={initial?.immediateAction} className="input"
              placeholder="First aid applied. Area made safe." />
          </div>
          {type === 'INCIDENT' && (
            <label className="sm:col-span-3 flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="riddor" defaultChecked={initial?.riddor} className="h-4 w-4 mt-0.5 accent-brand" />
              <span>
                <span className="font-medium">Reportable under RIDDOR</span>
                <span className="block text-ink-muted">A specified injury, over 7 days off work, or a dangerous occurrence. Report it to the HSE as well.</span>
              </span>
            </label>
          )}
        </div>
      </section>

      {!initial && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Photos</h2>
          <p className="text-sm text-ink-muted mb-4">Up to 8. Photos of the area, the equipment or the injury help the investigation.</p>
          <PhotoPicker max={8} />
        </section>
      )}

      {initial && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Investigation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={initial.status} className="input">
                {(Object.keys(INCIDENT_STATUS_LABEL) as HsIncidentStatus[]).map((s) => <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="investigatorId">Investigator</label>
              <select id="investigatorId" name="investigatorId" defaultValue={initial.investigatorId} className="input">
                <option value="">Not assigned</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="findings">Findings and root cause</label>
              <textarea id="findings" name="findings" rows={4} defaultValue={initial.findings} className="input"
                placeholder="Why it happened, and what stops it happening again. Needed before it can be closed." />
            </div>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
        <SubmitButton pendingLabel={initial ? 'Saving…' : 'Sending…'}>{initial ? 'Save changes' : 'Submit report'}</SubmitButton>
      </div>
    </form>
  );
}

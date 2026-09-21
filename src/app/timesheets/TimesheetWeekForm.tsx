'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatHours, workedMinutes } from '@/lib/timesheets';
import { saveTimesheetWeek } from './actions';

export type TimesheetDay = {
  iso: string;
  label: string;
  future: boolean;
  weekend: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: string; // '' when nothing's been entered
  note: string;
};

function IntentButton({ intent, className, pendingLabel, children }: { intent: 'save' | 'submit'; className: string; pendingLabel: string; children: ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get('intent') === intent;
  return (
    <button type="submit" name="intent" value={intent} disabled={pending} className={className}>
      {mine ? <><Loader2 size={16} className="animate-spin" /> {pendingLabel}</> : children}
    </button>
  );
}

export function TimesheetWeekForm({
  week, days, canSubmit, submittedLabel,
}: { week: string; days: TimesheetDay[]; canSubmit: boolean; submittedLabel: string | null }) {
  const [rows, setRows] = useState(days.map((d) => ({ start: d.startTime, end: d.endTime, brk: d.breakMinutes })));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const set = (i: number, patch: Partial<(typeof rows)[number]>) => {
    setSaved('');
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const minutesFor = (r: (typeof rows)[number]) => {
    if (!r.start || !r.end) return null;
    const res = workedMinutes(r.start, r.end, r.brk === '' ? 0 : Number(r.brk));
    return 'minutes' in res ? res.minutes : null;
  };
  const total = rows.reduce((sum, r) => sum + (minutesFor(r) ?? 0), 0);

  return (
    <form
      action={async (formData) => {
        setError('');
        setSaved('');
        const res = await saveTimesheetWeek(formData);
        if (res.ok) setSaved(res.message);
        else setError(res.error);
      }}
    >
      <input type="hidden" name="week" value={week} />

      {error && <p className="banner-bad mb-4 flex items-center gap-2"><AlertTriangle size={16} aria-hidden /> {error}</p>}
      {saved && <p className="banner-ok mb-4 flex items-center gap-2"><CheckCircle2 size={16} aria-hidden /> {saved}</p>}

      <div className="divide-y divide-hairline">
        <div className="hidden md:grid grid-cols-[9rem_8rem_8rem_7rem_1fr_6rem] gap-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <span>Day</span><span>Start</span><span>Finish</span><span>Break (mins)</span><span>Note</span><span className="text-right">Hours</span>
        </div>
        {days.map((d, i) => {
          const r = rows[i];
          const mins = minutesFor(r);
          return (
            <div
              key={d.iso}
              className={`grid gap-3 py-3 md:grid-cols-[9rem_8rem_8rem_7rem_1fr_6rem] md:items-center ${d.weekend ? 'bg-canvas/50' : ''}`}
            >
              <span className={`font-semibold ${d.future ? 'text-ink-faint' : ''}`}>{d.label}</span>
              <label className="md:contents">
                <span className="label md:sr-only">Start</span>
                <input type="time" name={`start_${d.iso}`} value={r.start} disabled={d.future} onChange={(e) => set(i, { start: e.target.value })} className="input py-1.5" />
              </label>
              <label className="md:contents">
                <span className="label md:sr-only">Finish</span>
                <input type="time" name={`end_${d.iso}`} value={r.end} disabled={d.future} onChange={(e) => set(i, { end: e.target.value })} className="input py-1.5" />
              </label>
              <label className="md:contents">
                <span className="label md:sr-only">Break (mins)</span>
                <input
                  type="number" name={`break_${d.iso}`} min={0} step={5} inputMode="numeric" placeholder="0"
                  value={r.brk} disabled={d.future} onChange={(e) => set(i, { brk: e.target.value })} className="input py-1.5"
                />
              </label>
              <label className="md:contents">
                <span className="label md:sr-only">Note</span>
                <input name={`note_${d.iso}`} defaultValue={d.note} disabled={d.future} maxLength={300} placeholder="Optional" className="input py-1.5" />
              </label>
              <span className="text-right font-semibold tabular-nums">{mins === null ? <span className="text-ink-faint">—</span> : formatHours(mins)}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-hairline">
        <p className="text-lg font-bold mr-auto">
          {formatHours(total)} <span className="text-sm font-normal text-ink-muted">this week</span>
        </p>
        {submittedLabel && <span className="text-sm text-ink-muted">{submittedLabel}</span>}
        <IntentButton intent="save" className="btn-secondary" pendingLabel="Saving…">Save</IntentButton>
        {canSubmit && (
          <IntentButton intent="submit" className="btn-primary" pendingLabel="Handing in…">
            {submittedLabel ? 'Save & keep as handed in' : 'Hand in this week'}
          </IntentButton>
        )}
      </div>
    </form>
  );
}

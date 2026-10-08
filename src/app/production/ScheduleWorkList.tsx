'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ProductionProcess } from '@prisma/client';
import { AlertTriangle, CheckCircle2, Plus, Undo2, X } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { MACHINE, recordsCast } from '@/lib/productionSplit';
import { checkCastNumber, completeBarMark, undoBarMark } from './actions';

export type WorkMark = {
  id: string; mark: string; shapeCode: string; bars: number; lengthMm: number; kg: number;
  /** Ticked off on this machine: who, when, the cast it went down against, and whether the viewer can take it back. */
  done: { rowId: string; by: string; at: string; castNumber: string; undoable: boolean } | null;
  /** Bending only: the mark's cutting row, which its cast number comes from. */
  cut: { castNumber: string; by: string } | null;
};
export type WorkGroup = { dia: number; marks: WorkMark[]; lastCast: string; lastMill: string };

type CastStatus = 'idle' | 'checking' | 'certified' | 'stock-only' | 'unknown';
type CastEntry = { key: number; cast: string; mill: string; status: CastStatus };

/**
 * The casts last used for a size, split back into cast-and-mill pairs: a row
 * can carry several ("C123, C456"), with one mill for them all or one each.
 */
function pairsFrom(lastCast: string, lastMill: string) {
  const casts = lastCast.split(',').map((c) => c.trim()).filter(Boolean);
  const mills = lastMill.split(',').map((m) => m.trim()).filter(Boolean);
  if (casts.length === 0) return [{ cast: '', mill: '' }];
  return casts.map((cast, i) => ({ cast, mill: mills.length === casts.length ? mills[i] : mills[0] ?? '' }));
}
const CAST_HINT: Partial<Record<CastStatus, { text: string; tone: string }>> = {
  certified: { text: 'Certificate on file.', tone: 'text-forest' },
  'stock-only': { text: 'In stock, no certificate yet.', tone: 'text-amber-700' },
  unknown: { text: 'Not in stock or on a certificate — check the tag.', tone: 'text-amber-700' },
};

/**
 * One machine's share of an order's schedule, smallest size first and
 * shortest to longest, for ticking off as it's done. On the Cutter and the
 * Stema the cast number and mill are typed once per size (the bundle or coil
 * being worked from) and go on every mark ticked off under it — more than
 * one cast when a mark runs across two; bending needs nothing typed, and only
 * marks that have been cut can be bent.
 */
export function ScheduleWorkList({
  jobId, process, canWork, groups,
}: { jobId: string; process: ProductionProcess; canWork: boolean; groups: WorkGroup[] }) {
  const [hideDone, setHideDone] = useState(false);
  const total = groups.reduce((s, g) => s + g.marks.length, 0);
  const done = groups.reduce((s, g) => s + g.marks.filter((m) => m.done).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">{done} of {total} bar marks {MACHINE[process].done}</p>
        {done > 0 && (
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="h-4 w-4 accent-brand" />
            Hide finished ones
          </label>
        )}
      </div>
      {groups.map((g) => (
        <SizeGroup key={g.dia} group={g} jobId={jobId} process={process} canWork={canWork} hideDone={hideDone} />
      ))}
    </div>
  );
}

function SizeGroup({
  group, jobId, process, canWork, hideDone,
}: { group: WorkGroup; jobId: string; process: ProductionProcess; canWork: boolean; hideDone: boolean }) {
  const machine = MACHINE[process];
  const needsCast = recordsCast(process);
  const keyRef = useRef(0);
  const [casts, setCasts] = useState<CastEntry[]>(() =>
    pairsFrom(group.lastCast, group.lastMill).map((p) => ({ ...p, key: keyRef.current++, status: 'idle' as CastStatus })));
  const [, startTransition] = useTransition();

  const update = (key: number, change: Partial<CastEntry>) =>
    setCasts((prev) => prev.map((c) => (c.key === key ? { ...c, ...change } : c)));

  function check(key: number, value: string) {
    const v = value.trim();
    if (!v) { update(key, { status: 'idle' }); return; }
    update(key, { status: 'checking' });
    startTransition(async () => {
      const found = await checkCastNumber(v);
      update(key, { status: found.certificate ? 'certified' : found.inStock ? 'stock-only' : 'unknown' });
    });
  }

  useEffect(() => {
    if (needsCast) for (const c of casts) if (c.cast.trim()) check(c.key, c.cast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every cast listed goes on each mark ticked off: one when a bundle or coil
  // lasts, two or more across the changeover when it runs out mid-mark.
  const complete = casts.filter((c) => c.cast.trim() && c.mill.trim());
  const halfTyped = casts.some((c) => !c.cast.trim() !== !c.mill.trim());
  const castNumber = complete.map((c) => c.cast.trim()).join(', ');
  const mills = complete.map((c) => c.mill.trim());
  const mill = mills.every((m) => m.toLowerCase() === mills[0]?.toLowerCase()) ? (mills[0] ?? '') : mills.join(', ');

  const left = group.marks.filter((m) => !m.done).length;
  const ready = !needsCast || (complete.length > 0 && !halfTyped);
  const shown = group.marks.filter((m) => !hideDone || !m.done);
  if (shown.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <header className="px-4 py-3 bg-canvas border-b border-hairline flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-xl font-bold">H{group.dia}</p>
          <p className="text-xs text-ink-muted">{left === 0 ? `All ${machine.done}` : `${left} of ${group.marks.length} still to do`}</p>
        </div>
        {needsCast && canWork && left > 0 && (
          <div className="w-full sm:w-[22rem] space-y-2">
            {casts.map((c, i) => {
              const hint = CAST_HINT[c.status];
              return (
                <div key={c.key}>
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <div>
                      {i === 0 && <label className="label text-xs" htmlFor={`cast-${group.dia}-${c.key}`}>Cast number</label>}
                      <div className="relative">
                        <input
                          id={`cast-${group.dia}-${c.key}`} value={c.cast} autoComplete="off" className="input pr-9"
                          aria-label={i === 0 ? undefined : `Cast number ${i + 1}`}
                          onChange={(e) => update(c.key, { cast: e.target.value, status: 'idle' })}
                          onBlur={(e) => check(c.key, e.target.value)}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden>
                          {c.status === 'certified' && <CheckCircle2 size={16} className="text-forest" />}
                          {(c.status === 'stock-only' || c.status === 'unknown') && <AlertTriangle size={16} className="text-amber-600" />}
                        </span>
                      </div>
                    </div>
                    <div>
                      {i === 0 && <label className="label text-xs" htmlFor={`mill-${group.dia}-${c.key}`}>Mill</label>}
                      <input
                        id={`mill-${group.dia}-${c.key}`} value={c.mill} autoComplete="off" className="input"
                        aria-label={i === 0 ? undefined : `Mill for cast ${i + 1}`}
                        onChange={(e) => update(c.key, { mill: e.target.value })}
                      />
                    </div>
                    <button
                      type="button" aria-label={`Remove cast ${c.cast.trim() || i + 1}`} disabled={casts.length === 1}
                      onClick={() => setCasts((prev) => prev.filter((x) => x.key !== c.key))}
                      className="h-10 w-9 grid place-items-center rounded-lg text-ink-faint hover:text-signal hover:bg-white disabled:invisible"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {hint && <p className={`text-xs mt-1 ${hint.tone}`}>Cast {c.cast.trim()}: {hint.text}</p>}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setCasts((prev) => [...prev, { key: keyRef.current++, cast: '', mill: prev[prev.length - 1]?.mill ?? '', status: 'idle' }])}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
            >
              <Plus size={15} /> Add another cast
            </button>
            {!ready && (
              <p className="text-xs text-amber-700">
                {halfTyped ? 'Every cast needs its mill too.' : `Type the cast number and mill of the H${group.dia} you're using, then tick each bar mark off.`}
              </p>
            )}
            {complete.length > 1 && <p className="text-xs text-ink-muted">Each mark you tick off now goes down against all {complete.length} casts. Remove one when it runs out.</p>}
          </div>
        )}
      </header>
      <ul className="divide-y divide-hairline">
        {shown.map((m) => (
          <li key={m.id} className={`px-4 py-3 flex items-center gap-3 ${m.done ? 'bg-brand-50/50' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {m.mark} <span className="text-sm font-normal text-ink-muted">· shape {m.shapeCode}</span>
              </p>
              <p className="text-sm tabular-nums">
                {m.bars.toLocaleString('en-GB')} × {m.lengthMm.toLocaleString('en-GB')} mm <span className="text-ink-muted">· {m.kg.toLocaleString('en-GB', { maximumFractionDigits: 1 })} kg</span>
              </p>
              {m.done ? (
                <p className="text-xs text-forest font-medium mt-0.5">
                  {machine.verb} by {m.done.by} · {m.done.at}{m.done.castNumber && <> · cast {m.done.castNumber}</>}
                </p>
              ) : process === 'BENDING' && (
                m.cut
                  ? <p className="text-xs text-ink-muted mt-0.5">Cut by {m.cut.by}{m.cut.castNumber && <> · cast {m.cut.castNumber}</>}</p>
                  : <p className="text-xs text-amber-700 font-medium mt-0.5">Not cut yet</p>
              )}
            </div>
            {m.done ? (
              m.done.undoable ? (
                <form action={undoBarMark}>
                  <input type="hidden" name="rowId" value={m.done.rowId} />
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Undoing…"><Undo2 size={14} /> Undo</SubmitButton>
                </form>
              ) : <CheckCircle2 size={22} className="text-forest shrink-0" aria-label={machine.verb} />
            ) : canWork && (
              <form action={completeBarMark}>
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="barMarkId" value={m.id} />
                {needsCast && <><input type="hidden" name="castNumber" value={castNumber} /><input type="hidden" name="mill" value={mill} /></>}
                <SubmitButton className="btn-primary min-w-[84px] justify-center" pendingLabel="Saving…" disabled={process === 'BENDING' ? !m.cut : !ready}>
                  {machine.verb}
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

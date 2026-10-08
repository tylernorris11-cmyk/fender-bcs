'use client';

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { readBarSchedule, type ScheduleImport as Result } from './schedule-actions';

type Success = Extract<Result, { ok: true }>;

// Vercel turns away any request to a server function over 4.5MB, whatever
// next.config.mjs allows, so that's the real ceiling for one upload. Kept
// just under it for the form's own overhead.
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;

/**
 * Upload one or more of a customer's bar schedules and have their bar marks
 * put into the rows below, duplicates added together across all of them.
 * Lives inside the order form, so the file input has no name and the button
 * isn't a submit — the schedules themselves are never saved, only the lines
 * read from them once the order is.
 */
export function ScheduleImport({ onImport }: { onImport: (result: Success) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [tooBig, setTooBig] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  function read() {
    const files = [...(input.current?.files ?? [])];
    if (files.length === 0 || tooBig) return;
    const fd = new FormData();
    for (const f of files) fd.append('schedule', f);
    setResult(null);
    start(async () => {
      const r = await readBarSchedule(fd);
      setResult(r);
      if (r.ok) {
        onImport(r);
        if (input.current) input.current.value = '';
        setChosen([]);
      }
    });
  }

  const list = (items: string[]) => items.join(', ');

  return (
    <div className="rounded-xl border border-dashed border-hairline p-4 mb-4">
      <p className="font-semibold text-sm mb-1">Upload the customer&apos;s bar schedules</p>
      <p className="text-xs text-ink-muted mb-3">
        One or more PDFs or photos — choose several at once if the schedule comes in parts. Their bar marks go into the rows
        below, with duplicates added together across all of them, ready to check and price.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="input w-auto max-w-full py-2"
          aria-label="Bar schedule files"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            setChosen(files.map((f) => f.name));
            setTooBig(files.reduce((s, f) => s + f.size, 0) > MAX_UPLOAD_BYTES);
            setResult(null);
          }} />
        <button type="button" onClick={read} disabled={chosen.length === 0 || tooBig || pending} className="btn-primary">
          {pending
            ? <><Loader2 size={16} className="animate-spin" /> Reading {chosen.length > 1 ? `${chosen.length} schedules` : 'the schedule'}…</>
            : <><FileUp size={16} /> {chosen.length > 1 ? `Read ${chosen.length} schedules` : 'Read schedule'}</>}
        </button>
      </div>
      {chosen.length > 1 && !pending && <p className="text-xs text-ink-muted mt-2">{chosen.join(', ')}</p>}
      {tooBig && <p className="text-xs text-signal mt-2">Those files come to more than 4.5 MB together, the most one upload can carry. Read them in a few goes: each go adds to the rows below.</p>}
      {pending && <p className="text-xs text-ink-muted mt-2">This can take up to a minute for long schedules.</p>}

      {result && !result.ok && (
        <p className="banner-bad mt-3"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {result.error}</p>
      )}

      {result?.ok && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="banner-ok">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>
              Read {result.rowsRead} {result.rowsRead === 1 ? 'row' : 'rows'} from {result.pages} {result.pages === 1 ? 'page' : 'pages'} of {list(result.fileNames)},
              {' '}giving {result.bars.length} bar {result.bars.length === 1 ? 'mark' : 'marks'}, added below. Check every line against the schedule before saving.
            </span>
          </p>
          {result.duplicates.length > 0 && (
            <p className="text-ink-muted">
              <strong className="text-ink">Duplicates added together:</strong>{' '}
              {list(result.duplicates.map((d) => `${d.mark} (found ${d.times} times, ${d.bars} bars in all)`))}.
            </p>
          )}
          {result.conflicts.length > 0 && (
            <p className="banner-warn">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Same bar mark but a different bar, so kept as separate lines — check against the drawing: <strong>{list(result.conflicts)}</strong>.</span>
            </p>
          )}
          {result.totalMismatches.length > 0 && (
            <p className="banner-warn">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>The printed total doesn&apos;t equal members × bars in each, so the printed total was used: <strong>{list(result.totalMismatches)}</strong>.</span>
            </p>
          )}
          {result.unreadable.length > 0 && (
            <p className="banner-warn">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Hard to read, so worth a second look: {list(result.unreadable)}.</span>
            </p>
          )}
          {result.pageErrors.length > 0 && (
            <p className="banner-bad">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Not read, so add these by hand: {list(result.pageErrors)}.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

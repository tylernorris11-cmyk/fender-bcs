'use client';

import { useRef, useState, useTransition } from 'react';
import type { BarCountMode } from '@prisma/client';
import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { resizeImageToFile } from '@/lib/image';
import { runBarDetection, confirmBarCount, type BarDetectResult } from './actions';
import type { DetectedCircle } from '@/lib/barDetection';

type Circle = DetectedCircle & { id: string };
type Order = { id: string; number: string };

const MODE_LABEL: Record<BarCountMode, string> = {
  CIRCLE_DETECTOR: 'Circle detector',
  AI_ESTIMATE: 'AI estimate',
  BOTH: 'Both',
};

function withIds(circles: DetectedCircle[]): Circle[] {
  return circles.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

function medianRadius(circles: Circle[]): number {
  if (circles.length === 0) return 0.015;
  const sorted = [...circles].map((c) => c.r).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function BarCounterClient({ orders }: { orders: Order[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const [detecting, startDetect] = useTransition();
  const [detectError, setDetectError] = useState('');

  const [result, setResult] = useState<Extract<BarDetectResult, { ok: true }> | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [manualCount, setManualCount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, startSave] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    setPreviewSrc(URL.createObjectURL(chosen));
    setResult(null);
    setCircles([]);
    setDetectError('');
  }

  function runMode(mode: BarCountMode) {
    if (!file) return;
    setDetectError('');
    startDetect(async () => {
      try {
        const resized = await resizeImageToFile(file);
        const formData = new FormData();
        formData.set('photo', resized);
        formData.set('mode', mode);
        const res = await runBarDetection(formData);
        if (!res.ok) { setDetectError(res.error); return; }
        setResult(res);
        setCircles(withIds(res.circles));
        setManualCount(res.aiEstimateCount != null ? String(res.aiEstimateCount) : '');
      } catch (err) {
        setDetectError(err instanceof Error ? err.message : 'Something went wrong running detection.');
      }
    });
  }

  function handleTapAdd(e: React.MouseEvent<HTMLDivElement>) {
    if (!result || result.mode === 'AI_ESTIMATE') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setCircles((prev) => [...prev, { id: crypto.randomUUID(), x, y, r: medianRadius(prev) }]);
  }

  function removeCircle(id: string) {
    setCircles((prev) => prev.filter((c) => c.id !== id));
  }

  const hasOverlay = result?.ok && result.mode !== 'AI_ESTIMATE';

  return (
    <section className="card card-pad">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="label" htmlFor="photo">Photo of the bundle end</label>
          <input
            ref={fileInputRef} id="photo" type="file" accept="image/png,image/jpeg,image/webp"
            capture="environment" className="sr-only" onChange={onPhotoChosen}
          />
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Camera size={16} /> Take Picture
          </button>
          {file && <span className="block text-xs text-ink-muted mt-1.5">{file.name}</span>}
        </div>
        {file && (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={detecting} onClick={() => runMode('CIRCLE_DETECTOR')}>
              {detecting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Circle detector
            </button>
            <button type="button" className="btn-secondary" disabled={detecting} onClick={() => runMode('AI_ESTIMATE')}>
              AI estimate
            </button>
            <button type="button" className="btn-secondary" disabled={detecting} onClick={() => runMode('BOTH')}>
              Both
            </button>
          </div>
        )}
      </div>

      {detectError && (
        <p className="hint text-signal flex items-center gap-1.5 mb-4"><AlertTriangle size={14} aria-hidden /> {detectError}</p>
      )}

      {!result && previewSrc && (
        <img src={previewSrc} alt="" className="max-w-md rounded-lg border border-hairline mb-4" />
      )}

      {result?.ok && (
        <div className="space-y-4">
          {hasOverlay ? (
            <>
              <div className="relative inline-block max-w-2xl w-full select-none" onClick={handleTapAdd}>
                <img src={previewSrc} alt="" className="block w-full h-auto rounded-lg border border-hairline" draggable={false} />
                {circles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeCircle(c.id); }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-signal/20 hover:bg-signal/40"
                    style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.r * 2 * 100}%`, aspectRatio: '1 / 1' }}
                    aria-label="Remove this bar"
                  />
                ))}
              </div>
              <p className="text-sm text-ink-muted">Tap a marker to remove it, tap empty space to add one you think was missed.</p>
              <p className="text-2xl font-bold">{circles.length} <span className="text-sm font-normal text-ink-muted">bars — confirmed count</span></p>
              {result.mode === 'BOTH' && (
                <p className="text-sm text-ink-muted">
                  Circle detector: {result.detectedCount} · AI estimate: {result.aiEstimateCount ?? (result.aiEstimateError ? 'unavailable' : '—')}
                </p>
              )}
            </>
          ) : (
            <>
              <img src={previewSrc} alt="" className="max-w-md rounded-lg border border-hairline" />
              <p className="text-sm text-ink-muted">
                {result.aiEstimateError ? `AI estimate unavailable: ${result.aiEstimateError}` : `AI estimates ~${result.aiEstimateCount} bars.`}
              </p>
              <div className="max-w-[200px]">
                <label className="label" htmlFor="manualCount">Confirmed count</label>
                <input
                  id="manualCount" type="number" min={0} required className="input"
                  value={manualCount} onChange={(e) => setManualCount(e.target.value)}
                />
              </div>
            </>
          )}

          <form
            action={(formData) => startSave(async () => { await confirmBarCount(formData); setFile(null); setPreviewSrc(''); setResult(null); setCircles([]); setManualCount(''); setOrderId(''); setNotes(''); if (fileInputRef.current) fileInputRef.current.value = ''; })}
            className="flex flex-wrap items-end gap-3 pt-2 border-t border-hairline"
          >
            <input type="hidden" name="mode" value={result.mode} />
            <input type="hidden" name="photoUrl" value={result.photoUrl} />
            <input type="hidden" name="photoWidth" value={result.photoWidth} />
            <input type="hidden" name="photoHeight" value={result.photoHeight} />
            <input type="hidden" name="detectedCount" value={result.detectedCount ?? ''} />
            {hasOverlay && <input type="hidden" name="detectedCircles" value={JSON.stringify(result.circles)} />}
            <input type="hidden" name="aiEstimateCount" value={result.aiEstimateCount ?? ''} />
            <input type="hidden" name="aiEstimateError" value={result.aiEstimateError} />
            {hasOverlay
              ? <input type="hidden" name="confirmedCircles" value={JSON.stringify(circles.map(({ x, y, r }) => ({ x, y, r })))} />
              : <input type="hidden" name="confirmedCount" value={manualCount} />}

            <div>
              <label className="label" htmlFor="orderId">Link to an order (optional)</label>
              <select id="orderId" name="orderId" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">— none —</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="notes">Notes (optional)</label>
              <input id="notes" name="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <button className="btn-primary" disabled={saving || (!hasOverlay && !manualCount)}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm count'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

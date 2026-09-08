'use client';

import { useRef, useState, useTransition } from 'react';
import type { BarCountMode } from '@prisma/client';
import { AlertTriangle, Camera, Loader2, Upload } from 'lucide-react';
import { resizeImageToFile } from '@/lib/image';
import { runBarDetection, confirmBarCount, type BarDetectResult } from './actions';
import type { DetectedCircle } from '@/lib/barDetection';

type Circle = DetectedCircle & { id: string };
type Order = { id: string; number: string };

const MODE_LABEL: Record<BarCountMode, string> = {
  CIRCLE_DETECTOR: 'Circle detector',
  AI_ESTIMATE: 'AI estimate',
  BOTH: 'Both',
  WATERSHED: 'Watershed',
};

function withIds(circles: DetectedCircle[]): Circle[] {
  return circles.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

function medianRadius(circles: Circle[]): number {
  if (circles.length === 0) return 0.015;
  const sorted = [...circles].map((c) => c.r).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type Point = { x: number; y: number };

export function BarCounterClient({ orders }: { orders: Order[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const [detecting, startDetect] = useTransition();
  const [detectError, setDetectError] = useState('');

  // Bar size, shown to the worker as a line drawn across one bar-end before
  // detection runs. The fixed-fraction defaults assumed every photo was
  // framed about the same way — a more tightly cropped or more distant shot
  // makes bars a very different fraction of the frame, and no single fixed
  // range covers both well. Letting the worker show the actual size directly
  // sidesteps that entirely, rather than trying to guess it algorithmically.
  const [calibStart, setCalibStart] = useState<Point | null>(null);
  const [calibEnd, setCalibEnd] = useState<Point | null>(null);
  const [calibratedRadius, setCalibratedRadius] = useState<number | null>(null);

  const [result, setResult] = useState<Extract<BarDetectResult, { ok: true }> | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [manualCount, setManualCount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, startSave] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    setPreviewSrc(URL.createObjectURL(chosen));
    setResult(null);
    setCircles([]);
    setDetectError('');
    setCalibStart(null);
    setCalibEnd(null);
    setCalibratedRadius(null);
  }

  function pointFromEvent(e: React.PointerEvent<HTMLDivElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onCalibDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    setCalibStart(p);
    setCalibEnd(p);
    setCalibratedRadius(null);
  }
  function onCalibMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!calibStart) return;
    setCalibEnd(pointFromEvent(e));
  }
  function onCalibUp() {
    if (!calibStart || !calibEnd) return;
    const dx = calibEnd.x - calibStart.x;
    const dy = calibEnd.y - calibStart.y;
    const diameter = Math.sqrt(dx * dx + dy * dy);
    if (diameter > 0.003) setCalibratedRadius(diameter / 2); // ignore an accidental tap with no real drag
  }

  function runMode(mode: BarCountMode) {
    if (!file) return;
    if (mode !== 'AI_ESTIMATE' && !calibratedRadius) return;
    setDetectError('');
    startDetect(async () => {
      try {
        const resized = await resizeImageToFile(file);
        const formData = new FormData();
        formData.set('photo', resized);
        formData.set('mode', mode);
        if (calibratedRadius) formData.set('calibratedRadius', String(calibratedRadius));
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
          <input
            ref={uploadInputRef} type="file" accept="image/png,image/jpeg,image/webp"
            className="sr-only" onChange={onPhotoChosen}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} /> Take Picture
            </button>
            <button type="button" className="btn-secondary" onClick={() => uploadInputRef.current?.click()}>
              <Upload size={16} /> Upload Photo
            </button>
          </div>
          {file && <span className="block text-xs text-ink-muted mt-1.5">{file.name}</span>}
        </div>
        {file && (
          <div className="flex gap-2">
            <button
              type="button" className="btn-secondary" disabled={detecting || !calibratedRadius}
              title={calibratedRadius ? undefined : 'Drag across one bar end below first, to show its size'}
              onClick={() => runMode('CIRCLE_DETECTOR')}
            >
              {detecting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Circle detector
            </button>
            <button
              type="button" className="btn-secondary" disabled={detecting || !calibratedRadius}
              title={calibratedRadius ? 'Segments touching/overlapping bar ends — unverified against a real photo, try it alongside Circle detector rather than instead of it' : 'Drag across one bar end below first, to show its size'}
              onClick={() => runMode('WATERSHED')}
            >
              {detecting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Watershed
            </button>
            <button type="button" className="btn-secondary" disabled={detecting} onClick={() => runMode('AI_ESTIMATE')}>
              AI estimate
            </button>
            <button
              type="button" className="btn-secondary" disabled={detecting || !calibratedRadius}
              title={calibratedRadius ? undefined : 'Drag across one bar end below first, to show its size'}
              onClick={() => runMode('BOTH')}
            >
              Both
            </button>
          </div>
        )}
      </div>

      {detectError && (
        <p className="hint text-signal flex items-center gap-1.5 mb-4"><AlertTriangle size={14} aria-hidden /> {detectError}</p>
      )}

      {!result && previewSrc && (
        <div className="mb-4">
          <p className="text-sm text-ink-muted mb-2">
            {calibratedRadius
              ? 'Bar size set — drag again to redo it, or run a mode above.'
              : 'Drag across one bar end below to show how big it looks, so the circle detector knows what size to look for.'}
          </p>
          <div
            className="relative inline-block max-w-md w-full select-none touch-none"
            onPointerDown={onCalibDown} onPointerMove={onCalibMove} onPointerUp={onCalibUp} onPointerCancel={onCalibUp}
          >
            <img src={previewSrc} alt="" className="block w-full h-auto rounded-lg border border-hairline" draggable={false} />
            {calibStart && calibEnd && (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
                  <line
                    x1={`${calibStart.x * 100}%`} y1={`${calibStart.y * 100}%`}
                    x2={`${calibEnd.x * 100}%`} y2={`${calibEnd.y * 100}%`}
                    stroke="rgb(197,48,48)" strokeWidth={2}
                  />
                </svg>
                {calibratedRadius && (
                  <span
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-signal/20 pointer-events-none"
                    style={{
                      left: `${((calibStart.x + calibEnd.x) / 2) * 100}%`, top: `${((calibStart.y + calibEnd.y) / 2) * 100}%`,
                      width: `${calibratedRadius * 2 * 100}%`, aspectRatio: '1 / 1',
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
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
            action={(formData) => startSave(async () => { await confirmBarCount(formData); setFile(null); setPreviewSrc(''); setResult(null); setCircles([]); setManualCount(''); setOrderId(''); setNotes(''); setCalibStart(null); setCalibEnd(null); setCalibratedRadius(null); if (fileInputRef.current) fileInputRef.current.value = ''; if (uploadInputRef.current) uploadInputRef.current.value = ''; })}
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

'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Printer } from 'lucide-react';

const KEY = 'tally-print-alignment';
type Alignment = { dx: number; dy: number; corners: boolean };
const DEFAULT: Alignment = { dx: 0, dy: 0, corners: false };

function load(): Alignment {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT; }
}

/**
 * Lining the print up with the pre-printed boxes. Where the page lands on the
 * paper depends on the printer and how the stock sits in its tractors, so
 * the nudge is kept in this browser (the PC the tally printer is on), not
 * shared. "Show box corners" prints a small cross on every corner of the
 * stock's boxes: once those sit on the corners, everything else does too.
 */
export function TallyControls() {
  const [a, setA] = useState<Alignment>(DEFAULT);
  useEffect(() => setA(load()), []);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tally-dx', `${a.dx}mm`);
    root.style.setProperty('--tally-dy', `${a.dy}mm`);
    root.classList.toggle('tally-corners', a.corners);
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private window — just not remembered */ }
  }, [a]);

  const nudge = (dx: number, dy: number) => setA((p) => ({ ...p, dx: Math.round((p.dx + dx) * 10) / 10, dy: Math.round((p.dy + dy) * 10) / 10 }));
  const btn = 'btn-secondary btn-sm px-2.5';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <button type="button" onClick={() => window.print()} className="btn-primary"><Printer size={16} /> Print</button>
      <div className="flex items-center gap-1.5" aria-label="Move the print">
        <span className="text-xs text-ink-muted mr-1">Move 1mm:</span>
        <button type="button" className={btn} onClick={() => nudge(-1, 0)} aria-label="Left"><ArrowLeft size={14} /></button>
        <button type="button" className={btn} onClick={() => nudge(1, 0)} aria-label="Right"><ArrowRight size={14} /></button>
        <button type="button" className={btn} onClick={() => nudge(0, -1)} aria-label="Up"><ArrowUp size={14} /></button>
        <button type="button" className={btn} onClick={() => nudge(0, 1)} aria-label="Down"><ArrowDown size={14} /></button>
        <span className="text-xs text-ink-muted tabular-nums ml-1">
          {a.dx === 0 && a.dy === 0 ? 'as measured' : `${a.dx > 0 ? '+' : ''}${a.dx} across, ${a.dy > 0 ? '+' : ''}${a.dy} down`}
        </span>
        {(a.dx !== 0 || a.dy !== 0) && (
          <button type="button" className="text-xs text-brand-700 hover:underline ml-1" onClick={() => setA((p) => ({ ...p, dx: 0, dy: 0 }))}>Reset</button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={a.corners} onChange={(e) => setA((p) => ({ ...p, corners: e.target.checked }))} className="h-4 w-4 accent-brand" />
        Show box corners (for lining up)
      </label>
    </div>
  );
}

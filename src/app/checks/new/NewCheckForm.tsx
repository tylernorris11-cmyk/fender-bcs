'use client';

import { useState } from 'react';
import type { AssetType } from '@prisma/client';
import { defaultCheckItems } from '@/lib/checks';
import { logAssetCheck } from '../actions';

type Asset = { id: string; name: string; ref: string; type: AssetType };

export function NewCheckForm({ assets, initialAssetId }: { assets: Asset[]; initialAssetId?: string }) {
  const [assetId, setAssetId] = useState(initialAssetId && assets.some((a) => a.id === initialAssetId) ? initialAssetId : assets[0]?.id ?? '');
  const [oks, setOks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const asset = assets.find((a) => a.id === assetId);
  const items = asset ? defaultCheckItems(asset.type) : [];
  const vehicles = assets.filter((a) => a.type === 'VEHICLE');
  const machines = assets.filter((a) => a.type === 'MACHINE');

  return (
    <form action={logAssetCheck} className="space-y-6">
      <section className="card card-pad">
        <label className="label" htmlFor="assetId">Asset</label>
        <select id="assetId" name="assetId" required value={assetId}
                onChange={(e) => setAssetId(e.target.value)} className="input max-w-md">
          {vehicles.length > 0 && (
            <optgroup label="Vehicles">
              {vehicles.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
            </optgroup>
          )}
          {machines.length > 0 && (
            <optgroup label="Machines">
              {machines.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
            </optgroup>
          )}
        </select>
      </section>

      {asset && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Checklist</h2>
          <p className="text-sm text-ink-muted mb-4">
            Everything starts ticked OK — untick anything that needs attention and add a note.
          </p>
          <ul className="space-y-2">
            {items.map((label, i) => {
              const ok = oks[label] ?? true;
              return (
                <li key={label} className="flex flex-wrap items-center gap-3 bg-canvas rounded-xl p-3">
                  <input type="hidden" name={`item[${i}][label]`} value={label} />
                  <input type="hidden" name={`item[${i}][ok]`} value={ok ? '1' : '0'} />
                  <button
                    type="button"
                    onClick={() => setOks((p) => ({ ...p, [label]: !ok }))}
                    className={`h-6 w-6 shrink-0 rounded-md border-2 grid place-items-center font-bold text-xs transition-colors ${
                      ok ? 'bg-brand border-brand text-white' : 'bg-white border-signal text-signal'
                    }`}
                    aria-pressed={ok}
                    aria-label={`${label}: ${ok ? 'OK' : 'Needs attention'}`}
                  >
                    {ok ? '✓' : '!'}
                  </button>
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  {!ok && (
                    <input
                      name={`item[${i}][note]`}
                      value={notes[label] ?? ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [label]: e.target.value }))}
                      className="input flex-1 min-w-[200px]" placeholder="What's wrong?"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card card-pad">
        <label className="label" htmlFor="notes">Overall notes</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Anything else worth recording" />
        <button type="submit" className="btn-primary mt-4" disabled={!asset}>Save check</button>
      </section>
    </form>
  );
}

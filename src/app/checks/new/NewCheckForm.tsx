'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import type { AssetType } from '@prisma/client';
import { resizeImageToDataUrl } from '@/lib/image';
import { logAssetCheck, reportAssetIssue } from '../actions';

type Asset = { id: string; name: string; ref: string; type: AssetType; checklistItems: { label: string }[] };

export function NewCheckForm({ assets, initialAssetId }: { assets: Asset[]; initialAssetId?: string }) {
  const [assetId, setAssetId] = useState(initialAssetId && assets.some((a) => a.id === initialAssetId) ? initialAssetId : assets[0]?.id ?? '');
  const [oks, setOks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);

  async function onPhotoChosen(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await resizeImageToDataUrl(file));
    } catch {
      // Not a real photo, or the browser couldn't decode it — just skip it.
    } finally {
      setBusy(false);
    }
  }

  const asset = assets.find((a) => a.id === assetId);
  const items = asset ? asset.checklistItems.map((i) => i.label) : [];
  const vehicles = assets.filter((a) => a.type === 'VEHICLE');
  const machines = assets.filter((a) => a.type === 'MACHINE');

  return (
    <div className="space-y-6">
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

      <section className="card card-pad border-2 border-signal/30">
        <h2 className="text-lg font-bold mb-1">Report an issue</h2>
        <p className="text-sm text-ink-muted mb-3">
          Spotted something wrong with {asset ? asset.name : 'this asset'}? Report it here — it stays on the main checks
          screen for everyone to see until someone marks it fixed, separate from the checklist below.
        </p>
        <form action={reportAssetIssue} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="assetId" value={assetId} />
          <div className="flex-1 min-w-[240px]">
            <label className="label text-xs" htmlFor="description">What&apos;s wrong</label>
            <input id="description" name="description" required className="input" placeholder="Nearside indicator not working" />
          </div>
          <button type="submit" className="btn-secondary" disabled={!asset}>Report issue</button>
        </form>
      </section>

      <form action={logAssetCheck} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
      {asset && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Checklist</h2>
          <p className="text-sm text-ink-muted mb-4">
            Nothing is ticked yet — go through each one and confirm it&apos;s OK. Leave anything you can&apos;t confirm unticked and add a note.
          </p>
          <ul className="space-y-2">
            {items.map((label, i) => {
              const ok = oks[label] ?? false;
              return (
                <li key={label} className="flex flex-wrap items-center gap-3 bg-canvas rounded-xl p-3">
                  <input type="hidden" name={`item[${i}][label]`} value={label} />
                  <input type="hidden" name={`item[${i}][ok]`} value={ok ? '1' : '0'} />
                  <button
                    type="button"
                    onClick={() => setOks((p) => ({ ...p, [label]: !ok }))}
                    className={`h-6 w-6 shrink-0 rounded-md border-2 grid place-items-center font-bold text-xs transition-colors ${
                      ok ? 'bg-brand border-brand text-white' : 'bg-white border-hairline text-ink-faint'
                    }`}
                    aria-pressed={ok}
                    aria-label={`${label}: ${ok ? 'OK' : 'Not confirmed'}`}
                  >
                    {ok ? '✓' : ''}
                  </button>
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  {!ok && (
                    <input
                      name={`item[${i}][note]`}
                      value={notes[label] ?? ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [label]: e.target.value }))}
                      className="input flex-1 min-w-[200px]" placeholder="Note (optional)"
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

        <input type="hidden" name="photo" value={photo} />
        <div className="mt-3 flex items-center gap-3">
          {photo ? (
            <span className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-16 w-16 rounded-lg object-cover border border-hairline" />
              <button
                type="button"
                onClick={() => setPhoto('')}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-ink text-white grid place-items-center"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            </span>
          ) : (
            <label className="btn-secondary btn-sm cursor-pointer">
              <Camera size={14} /> {busy ? 'Adding…' : 'Add photo'}
              <input
                type="file" accept="image/*" capture="environment" className="sr-only"
                onChange={(e) => onPhotoChosen(e.target.files?.[0])}
              />
            </label>
          )}
          <p className="text-xs text-ink-faint">If there's a problem, a photo helps whoever picks this up next.</p>
        </div>

        <button type="submit" className="btn-primary mt-4" disabled={!asset}>Save check</button>
      </section>
      </form>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, X } from 'lucide-react';
import type { AssetType } from '@prisma/client';
import { resizeImageToDataUrl } from '@/lib/image';
import { logAssetCheck, reportAssetIssue } from '../actions';

type Asset = {
  id: string; name: string; ref: string; type: AssetType;
  checklistItems: { label: string; critical: boolean }[];
  outOfService: boolean; latestCheckId: string | null;
};

export function NewCheckForm({ assets, initialAssetId }: { assets: Asset[]; initialAssetId?: string }) {
  const [assetId, setAssetId] = useState(initialAssetId && assets.some((a) => a.id === initialAssetId) ? initialAssetId : assets[0]?.id ?? '');
  const [oks, setOks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);

  // Leaving an item unticked is how an issue gets reported on this form —
  // easy to do by accident (forget one, or tick through on autopilot) with
  // real consequences (a critical item takes the asset out of service), so
  // saving is interrupted with exactly what's about to be flagged rather
  // than submitting silently.
  const [pendingIssues, setPendingIssues] = useState<{ label: string; critical: boolean; note: string }[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  function handleChecklistSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) { confirmedRef.current = false; return; }
    const unticked = items
      .filter(({ label }) => !(oks[label] ?? false))
      .map(({ label, critical }) => ({ label, critical, note: notes[label] ?? '' }));
    if (unticked.length > 0) {
      e.preventDefault();
      setPendingIssues(unticked);
    }
  }

  function confirmAndSubmit() {
    confirmedRef.current = true;
    setPendingIssues(null);
    formRef.current?.requestSubmit();
  }

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
  const items = asset ? asset.checklistItems : [];
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
              {vehicles.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref}){a.outOfService ? ' — OUT OF SERVICE' : ''}</option>)}
            </optgroup>
          )}
          {machines.length > 0 && (
            <optgroup label="Machines">
              {machines.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref}){a.outOfService ? ' — OUT OF SERVICE' : ''}</option>)}
            </optgroup>
          )}
        </select>
      </section>

      {asset?.outOfService && (
        <section className="card card-pad border-2 border-signal">
          <h2 className="text-lg font-bold mb-1 text-signal">{asset.name} is out of service</h2>
          <p className="text-sm">
            A critical item on the last check is still unresolved. Resolve it before a new check can be logged for this asset.
          </p>
          {asset.latestCheckId && (
            <Link href={`/checks/${asset.latestCheckId}/resolve`} className="btn-secondary mt-3 inline-flex">Go to resolve it</Link>
          )}
        </section>
      )}

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

      <form ref={formRef} action={logAssetCheck} onSubmit={handleChecklistSubmit} className="space-y-6">
      <input type="hidden" name="assetId" value={assetId} />
      {asset && !asset.outOfService && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Checklist</h2>
          <p className="text-sm text-ink-muted mb-4">
            Nothing is ticked yet — go through each one and confirm it&apos;s OK. Leave anything you can&apos;t confirm unticked and add a note.
          </p>
          {asset.type === 'VEHICLE' && (
            <div className="mb-4 max-w-[200px]">
              <label className="label text-xs" htmlFor="mileage">Mileage</label>
              <input id="mileage" name="mileage" type="number" min="0" step="1" className="input" placeholder="e.g. 84210" />
            </div>
          )}
          <ul className="space-y-2">
            {items.map(({ label, critical }, i) => {
              const ok = oks[label] ?? false;
              return (
                <li key={label} className="flex flex-wrap items-center gap-3 bg-canvas rounded-xl p-3">
                  <input type="hidden" name={`item[${i}][label]`} value={label} />
                  <input type="hidden" name={`item[${i}][ok]`} value={ok ? '1' : '0'} />
                  <input type="hidden" name={`item[${i}][critical]`} value={critical ? '1' : '0'} />
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
                  <span className="flex-1 text-sm font-medium">
                    {label}
                    {critical && <span className="ml-2 text-xs font-bold text-signal uppercase tracking-wide">Critical</span>}
                  </span>
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

      {asset && !asset.outOfService && (
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

        <button type="submit" className="btn-primary mt-4" disabled={!asset || asset.outOfService}>Save check</button>
      </section>
      )}
      </form>

      {pendingIssues && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={() => setPendingIssues(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-issue-heading"
        >
          <div className="card card-pad max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-issue-heading" className="text-lg font-bold mb-1 text-signal">
              {pendingIssues.length === 1 ? "You're about to report an issue" : `You're about to report ${pendingIssues.length} issues`}
            </h2>
            <p className="text-sm text-ink-muted mb-3">
              {pendingIssues.length === 1 ? "This item isn't" : 'These items are not'} ticked OK, which will flag{' '}
              {pendingIssues.length === 1 ? 'it' : 'them'} as an issue on {asset?.name ?? 'this asset'}:
            </p>
            <ul className="space-y-1.5 mb-3">
              {pendingIssues.map(({ label, critical, note }) => (
                <li key={label} className="text-sm bg-canvas rounded-lg p-2.5">
                  <span className="font-medium">{label}</span>
                  {critical && <span className="ml-2 text-xs font-bold text-signal uppercase tracking-wide">Critical</span>}
                  {note && <span className="block text-xs text-ink-muted mt-0.5">{note}</span>}
                </li>
              ))}
            </ul>
            {pendingIssues.some((i) => i.critical) && (
              <p className="text-xs text-signal font-medium mb-3">
                This includes a critical item — {asset?.name ?? 'this asset'} will be marked out of service until it&apos;s resolved.
              </p>
            )}
            <p className="text-sm font-medium mb-4">Do you want to confirm?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPendingIssues(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={confirmAndSubmit}>Confirm &amp; save check</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

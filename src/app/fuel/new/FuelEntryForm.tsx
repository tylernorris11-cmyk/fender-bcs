'use client';

import { useRef, useState } from 'react';
import type { Company } from '@prisma/client';
import { SubmitButton } from '@/components/SubmitButton';
import { logFuelEntry } from '../actions';

type Asset = { id: string; name: string; ref: string; company: Company | null; lastMileage: number | null };

const COMPANY_LABEL: Record<Company, string> = { FENDER: 'Fender Steel', BS_SUPPLIES: 'BCS Products' };

// Flag it rather than block — a vehicle can legitimately rack up big miles
// between fill-ups, this just catches the far more common case of a typo
// (a digit dropped or transposed) before it lands in the log.
const MILEAGE_WARNING_THRESHOLD = 1000;

export function FuelEntryForm({ assets, defaultDriverName }: { assets: Asset[]; defaultDriverName: string }) {
  const [notOnSystem, setNotOnSystem] = useState(false);
  const fender = assets.filter((a) => a.company === 'FENDER');
  const bcs = assets.filter((a) => a.company === 'BS_SUPPLIES');
  const shared = assets.filter((a) => !a.company);
  const [litresBefore, setLitresBefore] = useState('');
  const [litresAfter, setLitresAfter] = useState('');
  const [assetId, setAssetId] = useState('');
  const [mileage, setMileage] = useState('');
  const [pendingMileageGap, setPendingMileageGap] = useState<{ last: number; entered: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  const before = Number(litresBefore);
  const after = Number(litresAfter);
  const hasReadings = litresBefore !== '' && litresAfter !== '' && Number.isFinite(before) && Number.isFinite(after);
  const difference = hasReadings ? after - before : null;

  const selectedAsset = assets.find((a) => a.id === assetId);
  const lastMileage = notOnSystem ? null : selectedAsset?.lastMileage ?? null;
  const enteredMileage = mileage !== '' ? Number(mileage) : null;
  const mileageGap = lastMileage != null && enteredMileage != null && Number.isFinite(enteredMileage)
    ? Math.abs(enteredMileage - lastMileage) : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) { confirmedRef.current = false; return; }
    if (mileageGap !== null && mileageGap > MILEAGE_WARNING_THRESHOLD && lastMileage != null && enteredMileage != null) {
      e.preventDefault();
      setPendingMileageGap({ last: lastMileage, entered: enteredMileage });
    }
  }

  function confirmAndSubmit() {
    confirmedRef.current = true;
    setPendingMileageGap(null);
    formRef.current?.requestSubmit();
  }

  return (
    <>
    <form ref={formRef} action={logFuelEntry} onSubmit={handleSubmit} className="card card-pad space-y-4 max-w-xl">
      {notOnSystem ? (
        <div>
          <label className="label" htmlFor="otherVehicle">Vehicle reg or name</label>
          <input id="otherVehicle" name="otherVehicle" required className="input" placeholder="e.g. hired flatbed, KX21 ABC" />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="assetId">Vehicle name or reg</label>
          <select id="assetId" name="assetId" required className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="" disabled>Choose a vehicle…</option>
            {shared.length > 0 && (
              <optgroup label="Shared fleet">
                {shared.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
              </optgroup>
            )}
            {fender.length > 0 && (
              <optgroup label={COMPANY_LABEL.FENDER}>
                {fender.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
              </optgroup>
            )}
            {bcs.length > 0 && (
              <optgroup label={COMPANY_LABEL.BS_SUPPLIES}>
                {bcs.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
              </optgroup>
            )}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm -mt-2">
        <input
          type="checkbox" name="notOnSystem" value="1" checked={notOnSystem}
          onChange={(e) => setNotOnSystem(e.target.checked)} className="h-4 w-4 accent-brand"
        />
        Vehicle not on the system
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mileage">Mileage</label>
          <input
            id="mileage" name="mileage" type="number" min="0" required className="input" placeholder="84210"
            value={mileage} onChange={(e) => setMileage(e.target.value)}
          />
          {lastMileage != null && (
            <p className="text-xs text-ink-faint mt-1">Last logged: {lastMileage.toLocaleString('en-GB')}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="driverName">Current user</label>
          <input id="driverName" name="driverName" required defaultValue={defaultDriverName} className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="litresBefore">Current litre reading</label>
          <input
            id="litresBefore" name="litresBefore" type="number" step="0.01" min="0" required className="input"
            value={litresBefore} onChange={(e) => setLitresBefore(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="litresAfter">New litre reading</label>
          <input
            id="litresAfter" name="litresAfter" type="number" step="0.01" min="0" required className="input"
            value={litresAfter} onChange={(e) => setLitresAfter(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl bg-canvas px-4 py-3 text-sm">
        <span className="text-ink-muted">Litres used: </span>
        <span className={`font-bold ${difference !== null && difference < 0 ? 'text-signal' : ''}`}>
          {difference !== null ? difference.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
        </span>
        {difference !== null && difference < 0 && (
          <span className="text-signal"> — the new reading should be higher than the current one</span>
        )}
      </div>

      <SubmitButton pendingLabel="Saving…">Save entry</SubmitButton>
    </form>

    {pendingMileageGap !== null && (
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
        onClick={() => setPendingMileageGap(null)}
        role="dialog" aria-modal="true" aria-labelledby="mileage-gap-heading"
      >
        <div className="card card-pad max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <h2 id="mileage-gap-heading" className="text-lg font-bold mb-1 text-signal">Check this mileage</h2>
          <p className="text-sm text-ink-muted mb-4">
            This vehicle was last logged at <strong className="text-ink">{pendingMileageGap.last.toLocaleString('en-GB')}</strong> miles.
            You&apos;ve entered <strong className="text-ink">{pendingMileageGap.entered.toLocaleString('en-GB')}</strong> —{' '}
            {Math.abs(pendingMileageGap.entered - pendingMileageGap.last).toLocaleString('en-GB')} miles different.
          </p>
          <p className="text-sm font-medium mb-4">Is that right?</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPendingMileageGap(null)}>Let me check</button>
            <button type="button" className="btn-primary" onClick={confirmAndSubmit}>Yes, it&apos;s correct</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

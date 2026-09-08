'use client';

import { useState } from 'react';
import type { Company } from '@prisma/client';
import { SubmitButton } from '@/components/SubmitButton';
import { logFuelEntry } from '../actions';

type Asset = { id: string; name: string; ref: string; company: Company | null };

const COMPANY_LABEL: Record<Company, string> = { FENDER: 'Fender Steel', BS_SUPPLIES: 'BCS Products' };

export function FuelEntryForm({ assets, defaultDriverName }: { assets: Asset[]; defaultDriverName: string }) {
  const [notOnSystem, setNotOnSystem] = useState(false);
  const fender = assets.filter((a) => a.company === 'FENDER');
  const bcs = assets.filter((a) => a.company === 'BS_SUPPLIES');
  const shared = assets.filter((a) => !a.company);
  const [litresBefore, setLitresBefore] = useState('');
  const [litresAfter, setLitresAfter] = useState('');

  const before = Number(litresBefore);
  const after = Number(litresAfter);
  const hasReadings = litresBefore !== '' && litresAfter !== '' && Number.isFinite(before) && Number.isFinite(after);
  const difference = hasReadings ? after - before : null;

  return (
    <form action={logFuelEntry} className="card card-pad space-y-4 max-w-xl">
      {notOnSystem ? (
        <div>
          <label className="label" htmlFor="otherVehicle">Vehicle reg or name</label>
          <input id="otherVehicle" name="otherVehicle" required className="input" placeholder="e.g. hired flatbed, KX21 ABC" />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="assetId">Vehicle name or reg</label>
          <select id="assetId" name="assetId" required className="input">
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
          <input id="mileage" name="mileage" type="number" min="0" required className="input" placeholder="84210" />
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
  );
}

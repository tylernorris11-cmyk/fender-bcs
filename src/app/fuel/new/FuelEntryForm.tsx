'use client';

import { useState } from 'react';
import { logFuelEntry } from '../actions';

type Asset = { id: string; name: string; ref: string };

export function FuelEntryForm({ assets, defaultDriverName }: { assets: Asset[]; defaultDriverName: string }) {
  const [litresBefore, setLitresBefore] = useState('');
  const [litresAfter, setLitresAfter] = useState('');

  const before = Number(litresBefore);
  const after = Number(litresAfter);
  const hasReadings = litresBefore !== '' && litresAfter !== '' && Number.isFinite(before) && Number.isFinite(after);
  const difference = hasReadings ? after - before : null;

  return (
    <form action={logFuelEntry} className="card card-pad space-y-4 max-w-xl">
      <div>
        <label className="label" htmlFor="assetId">Vehicle name or reg</label>
        <select id="assetId" name="assetId" required className="input">
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.ref})</option>)}
        </select>
      </div>

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

      <button type="submit" className="btn-primary">Save entry</button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import type { AssetType, Company } from '@prisma/client';
import { createAsset } from '../actions';

const VEHICLE_CATEGORIES = ['HGV', 'Van', 'Pickup'];
const MACHINE_CATEGORIES = ['Bar bender', 'Shear line', 'Link bender', 'Forklift', 'Overhead crane'];
// A tiny client-safe copy — lib/company.ts is server-only (it reads cookies).
const COMPANY_LABEL: Record<Company, string> = { FENDER: 'Fender Steel', BS_SUPPLIES: 'BCS Products' };

export function NewAssetForm({ locations, companies }: { locations: string[]; companies: Company[] }) {
  const [type, setType] = useState<AssetType>('VEHICLE');
  const [liftingEquipment, setLiftingEquipment] = useState(false);
  const [company, setCompany] = useState(''); // '' = shared fleet
  const isVehicle = type === 'VEHICLE';

  return (
    <form action={createAsset} className="space-y-6">
      <section className="card card-pad">
        <label className="label">Type</label>
        <div className="flex gap-2 mb-1">
          {(['VEHICLE', 'MACHINE'] as AssetType[]).map((t) => (
            <button
              key={t} type="button" onClick={() => setType(t)}
              className={`rounded-pill px-5 py-2 text-sm font-medium border transition-colors ${
                type === t ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'
              }`}
            >
              {t === 'VEHICLE' ? 'Vehicle' : 'Machine'}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </section>

      {companies.length > 1 && (
        <section className="card card-pad">
          <label className="label" htmlFor="company">Which side is this for?</label>
          <select id="company" name="company" value={company} onChange={(e) => setCompany(e.target.value)} className="input max-w-xs">
            <option value="">Shared — both companies</option>
            {companies.map((c) => <option key={c} value={c}>{COMPANY_LABEL[c]} only</option>)}
          </select>
          <p className="hint">Most lorries and machines are shared — pick one company only if it&apos;s kit that side doesn&apos;t use.</p>
        </section>
      )}
      {companies.length === 1 && <input type="hidden" name="company" value={companies[0]} />}

      <section className="card card-pad grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{isVehicle ? 'Registration' : 'Name'}</label>
          <input id="name" name="name" required className="input" placeholder={isVehicle ? 'FJ23 YLK' : 'Schnell Bend 42'} />
        </div>

        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" required list="category-options" className="input" placeholder={isVehicle ? 'HGV' : 'Bar bender'} />
          <datalist id="category-options">
            {(isVehicle ? VEHICLE_CATEGORIES : MACHINE_CATEGORIES).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="makeModel">Make / model</label>
          <input id="makeModel" name="makeModel" className="input" placeholder={isVehicle ? 'DAF CF 370 8x4' : 'Schnell Bend 42'} />
        </div>

        <div>
          <label className="label" htmlFor="year">Year</label>
          <input id="year" name="year" type="number" min="1980" max="2100" className="input" placeholder="2023" />
        </div>

        <div>
          <label className="label" htmlFor="serialNumber">Serial number</label>
          <input id="serialNumber" name="serialNumber" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="depot">Depot</label>
          <select id="depot" name="depot" defaultValue={locations.includes('Scunthorpe') ? 'Scunthorpe' : (locations[0] ?? 'Scunthorpe')} className="input">
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {!isVehicle && (
          <div>
            <label className="label" htmlFor="hours">Hours on the clock</label>
            <input id="hours" name="hours" type="number" min="0" className="input" placeholder="9420" />
          </div>
        )}

        <div className="flex items-center gap-2.5 sm:col-span-2">
          <input
            id="liftingEquipment" name="liftingEquipment" type="checkbox" value="1"
            checked={liftingEquipment} onChange={(e) => setLiftingEquipment(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          <label htmlFor="liftingEquipment" className="text-sm font-medium">Lifting equipment fitted (needs a LOLER exam)</label>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-1">Statutory dates</h2>
        <p className="text-sm text-ink-muted mb-4">Optional here — leave blank and log them later from the asset&apos;s own page instead.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {isVehicle ? (
            <>
              <div>
                <label className="label" htmlFor="motDue">MOT due</label>
                <input id="motDue" name="motDue" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="taxDue">Road tax due</label>
                <input id="taxDue" name="taxDue" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="weeklyCheckDue">Safety inspection due</label>
                <input id="weeklyCheckDue" name="weeklyCheckDue" type="date" className="input" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="puwerDue">PUWER inspection due</label>
                <input id="puwerDue" name="puwerDue" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="serviceDue">Service due</label>
                <input id="serviceDue" name="serviceDue" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="calibrationDue">Calibration due</label>
                <input id="calibrationDue" name="calibrationDue" type="date" className="input" />
              </div>
            </>
          )}
          {liftingEquipment && (
            <div>
              <label className="label" htmlFor="lolerDue">LOLER exam due</label>
              <input id="lolerDue" name="lolerDue" type="date" className="input" />
            </div>
          )}
        </div>
      </section>

      <button type="submit" className="btn-primary">Add {isVehicle ? 'vehicle' : 'machine'}</button>
    </form>
  );
}

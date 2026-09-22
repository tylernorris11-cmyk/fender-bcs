'use client';

import { useState } from 'react';
import type { DeliveryColour } from '@prisma/client';
import { DELIVERY_COLOURS, DELIVERY_COLOUR_LABEL, DELIVERY_COLOUR_SWATCH } from '@/lib/deliveryColours';
import { SubmitButton } from '@/components/SubmitButton';
import { createDelivery } from '../actions';

type Driver = { id: string; name: string };

export function NewDeliveryForm({
  towns, drivers, defaultDate,
}: { towns: string[]; drivers: Driver[]; defaultDate?: string }) {
  const [colour, setColour] = useState<DeliveryColour>('BLUE');

  return (
    <form action={createDelivery} className="card card-pad max-w-xl space-y-4">
      <input type="hidden" name="colour" value={colour} />

      <div>
        <label className="label" htmlFor="customerName">Customer name</label>
        <input id="customerName" name="customerName" required className="input" placeholder="Riverside Construction" />
      </div>

      <div>
        <label className="label" htmlFor="town">Delivery location</label>
        <input id="town" name="town" required list="town-options" className="input" placeholder="Bradford" />
        <datalist id="town-options">
          {towns.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" required defaultValue={defaultDate} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="time">Time</label>
          <input id="time" name="time" type="time" className="input" />
          <p className="hint">Leave blank if it isn&apos;t at a set time.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="weightTonnes">Weight (tonnes)</label>
        <input id="weightTonnes" name="weightTonnes" type="number" step="0.001" min="0" className="input max-w-[160px]" placeholder="2.4" />
      </div>

      <div>
        <label className="label" htmlFor="driverId">Driver</label>
        <select id="driverId" name="driverId" defaultValue="" className="input max-w-xs">
          <option value="">Not assigned yet</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <fieldset>
        <legend className="label">Colour on the board</legend>
        <div className="flex gap-3">
          {DELIVERY_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColour(c)}
              aria-pressed={colour === c}
              aria-label={DELIVERY_COLOUR_LABEL[c]}
              title={DELIVERY_COLOUR_LABEL[c]}
              className={`h-9 w-9 rounded-full border-2 transition-transform ${colour === c ? 'scale-110 border-ink' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: DELIVERY_COLOUR_SWATCH[c] }}
            />
          ))}
        </div>
      </fieldset>

      <div className="pt-2">
        <SubmitButton pendingLabel="Adding…">Add delivery</SubmitButton>
      </div>
    </form>
  );
}

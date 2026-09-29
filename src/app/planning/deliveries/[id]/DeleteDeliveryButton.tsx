'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { deleteDelivery } from '../../actions';

/** Two taps, so a delivery never disappears off the board by accident. */
export function DeleteDeliveryButton({ eventId, summary }: { eventId: string; summary: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-danger btn-sm">
        <Trash2 size={15} /> Delete delivery
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-signal/30 bg-signal/5 p-4">
      <p className="text-sm font-semibold text-signal mb-3">Delete {summary}? It comes off the board for good.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="btn-secondary btn-sm">Keep it</button>
        <form action={deleteDelivery}>
          <input type="hidden" name="eventId" value={eventId} />
          <SubmitButton className="btn-danger btn-sm" pendingLabel="Deleting…">Yes, delete it</SubmitButton>
        </form>
      </div>
    </div>
  );
}

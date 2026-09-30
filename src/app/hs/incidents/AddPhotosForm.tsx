'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { addIncidentPhotos } from './actions';
import { PhotoPicker } from './PhotoPicker';

/** Adds more photos to an incident that's already been reported. */
export function AddPhotosForm({ incidentId, room }: { incidentId: string; room: number }) {
  const [count, setCount] = useState(0);
  // Remount the picker after each upload so it starts empty again.
  const [round, setRound] = useState(0);

  if (room <= 0) return <p className="text-xs text-ink-faint">That&apos;s the most photos one incident can have.</p>;
  return (
    <form action={async (fd) => { await addIncidentPhotos(fd); setRound((r) => r + 1); setCount(0); }} className="space-y-3">
      <input type="hidden" name="id" value={incidentId} />
      <PhotoPicker key={round} max={room} onCountChange={setCount} />
      {count > 0 && <SubmitButton className="btn-primary btn-sm" pendingLabel="Uploading…">Add {count === 1 ? 'photo' : `${count} photos`}</SubmitButton>}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';

/** A delete button that asks "are you sure?" in place before it posts. */
export function ConfirmDeleteForm({
  action, id, label, question,
}: { action: (fd: FormData) => Promise<void>; id: string; label: string; question: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className="btn-danger btn-sm">{label}</button>;
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-sm text-signal font-medium mr-1">{question}</span>
      <button type="button" onClick={() => setAsking(false)} className="btn-secondary btn-sm">Cancel</button>
      <SubmitButton className="btn-danger btn-sm" pendingLabel="Deleting…">Yes, delete it</SubmitButton>
    </form>
  );
}

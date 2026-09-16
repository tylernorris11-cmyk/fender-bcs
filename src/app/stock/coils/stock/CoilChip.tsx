'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { removeCoilFromStock } from '../actions';

const GRADE_LABEL = { SOFT: 'Soft', MEDIUM: 'Medium', HIGH_CARBON: 'High carbon' } as const;

export type CoilChipData = {
  id: string;
  ref: string;
  grade: keyof typeof GRADE_LABEL | null;
  diameterMm: number;
  weightKg: number;
  note: string;
  receivedLabel: string;
  receivedByName: string | null;
  allocatedLabel: string;
  allocatedByName: string | null;
};

/** A coil in the board grid — click it to see when it came in and, if you're allowed to, remove it from stock. */
export function CoilChip({ coil, canAdjust }: { coil: CoilChipData; canAdjust: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-canvas px-1.5 py-1.5 text-center hover:bg-hairline/50 transition-colors"
      >
        <p className="text-sm font-bold leading-tight">{coil.ref}</p>
        <p className="text-[11px] text-ink-muted leading-tight">{coil.weightKg.toLocaleString('en-GB')}</p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`coil-${coil.id}-heading`}
        >
          <div className="card card-pad max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {!confirming ? (
              <>
                <div className="flex items-start justify-between mb-3">
                  <h2 id={`coil-${coil.id}-heading`} className="text-lg font-bold">Coil {coil.ref}</h2>
                  <button type="button" onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink">
                    <X size={20} />
                  </button>
                </div>
                <dl className="text-sm space-y-2 mb-5">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Grade</dt>
                    <dd className="font-medium text-right">{coil.grade ? GRADE_LABEL[coil.grade] : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Diameter</dt>
                    <dd className="font-medium text-right">{coil.diameterMm} mm</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Weight</dt>
                    <dd className="font-medium text-right">{coil.weightKg.toLocaleString('en-GB')} kg</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted shrink-0">Received</dt>
                    <dd className="font-medium text-right">
                      {coil.receivedLabel}{coil.receivedByName ? ` by ${coil.receivedByName}` : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted shrink-0">Number allocated</dt>
                    <dd className="font-medium text-right">
                      {coil.allocatedLabel}{coil.allocatedByName ? ` by ${coil.allocatedByName}` : ''}
                    </dd>
                  </div>
                  {coil.note && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-muted shrink-0">Note</dt>
                      <dd className="font-medium text-right">{coil.note}</dd>
                    </div>
                  )}
                </dl>
                {canAdjust && (
                  <div className="flex justify-end">
                    <button type="button" className="btn-danger btn-sm" onClick={() => setConfirming(true)}>
                      Remove from stock
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-1 text-signal">Remove coil {coil.ref}?</h2>
                <p className="text-sm text-ink-muted mb-4">
                  This permanently removes it from stock — {coil.weightKg.toLocaleString('en-GB')} kg
                  {coil.grade ? ` of ${GRADE_LABEL[coil.grade].toLowerCase()}` : ''} at {coil.diameterMm}mm.
                  This can&apos;t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                  <form action={removeCoilFromStock}>
                    <input type="hidden" name="coilId" value={coil.id} />
                    <SubmitButton className="btn-danger" pendingLabel="Removing…">Yes, remove it</SubmitButton>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

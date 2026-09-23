'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { removeStockLengthFromStock } from './actions';

export type StockLengthChipData = {
  id: string;
  tag: string;
  lengthLabel: string;
  thicknessMm: number;
  weightKg: number;
  note: string;
  producedLabel: string;
  producedByName: string | null;
};

/** A bundle in the stock grid — click it to see when it was cut and, if you're allowed to, remove it from stock. */
export function StockLengthChip({ bundle, canAdjust }: { bundle: StockLengthChipData; canAdjust: boolean }) {
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
        <p className="text-sm font-bold leading-tight">{bundle.tag}</p>
        <p className="text-[11px] text-ink-muted leading-tight">{bundle.weightKg.toLocaleString('en-GB')}</p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`stock-length-${bundle.id}-heading`}
        >
          <div className="card card-pad max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {!confirming ? (
              <>
                <div className="flex items-start justify-between mb-3">
                  <h2 id={`stock-length-${bundle.id}-heading`} className="text-lg font-bold">Bundle {bundle.tag}</h2>
                  <button type="button" onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink">
                    <X size={20} />
                  </button>
                </div>
                <dl className="text-sm space-y-2 mb-5">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Length</dt>
                    <dd className="font-medium text-right">{bundle.lengthLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Thickness</dt>
                    <dd className="font-medium text-right">{bundle.thicknessMm} mm</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Weight</dt>
                    <dd className="font-medium text-right">{bundle.weightKg.toLocaleString('en-GB')} kg</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted shrink-0">Produced</dt>
                    <dd className="font-medium text-right">
                      {bundle.producedLabel}{bundle.producedByName ? ` by ${bundle.producedByName}` : ''}
                    </dd>
                  </div>
                  {bundle.note && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-muted shrink-0">Note</dt>
                      <dd className="font-medium text-right">{bundle.note}</dd>
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
                <h2 className="text-lg font-bold mb-1 text-signal">Remove bundle {bundle.tag}?</h2>
                <p className="text-sm text-ink-muted mb-4">
                  This permanently removes it from stock — {bundle.weightKg.toLocaleString('en-GB')} kg
                  of {bundle.lengthLabel} × {bundle.thicknessMm}mm. This can&apos;t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                  <form action={removeStockLengthFromStock}>
                    <input type="hidden" name="stockLengthId" value={bundle.id} />
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

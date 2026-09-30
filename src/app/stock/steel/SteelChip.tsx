'use client';

import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { removeSteelStock } from './actions';

export type SteelChipData = {
  id: string;
  castNumber: string;
  sizeLabel: string;
  weightKg: number;
  note: string;
  addedLabel: string;
  addedByName: string | null;
  certHref: string | null;
};

/** One coil or bundle on the stock board. Click it for its details and, if you're allowed, to take it out of stock. */
export function SteelChip({ item, canAdjust }: { item: SteelChipData; canAdjust: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => { setOpen(false); setConfirming(false); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full rounded-lg bg-canvas px-1.5 py-1.5 text-center hover:bg-hairline/50 transition-colors"
        title={item.certHref ? undefined : 'No certificate on file for this cast yet'}
      >
        {!item.certHref && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
        <p className="text-xs font-bold leading-tight truncate">{item.castNumber}</p>
        <p className="text-[11px] text-ink-muted leading-tight">{item.weightKg.toLocaleString('en-GB')} kg</p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={close} role="dialog" aria-modal="true" aria-labelledby={`steel-${item.id}`}>
          <div className="card card-pad max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {!confirming ? (
              <>
                <div className="flex items-start justify-between mb-3">
                  <h2 id={`steel-${item.id}`} className="text-lg font-bold">Cast {item.castNumber}</h2>
                  <button type="button" onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink"><X size={20} /></button>
                </div>
                <dl className="text-sm space-y-2 mb-5">
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">Size</dt><dd className="font-medium text-right">{item.sizeLabel}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">Weight</dt><dd className="font-medium text-right">{item.weightKg.toLocaleString('en-GB')} kg</dd></div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Certificate</dt>
                    <dd className="font-medium text-right">
                      {item.certHref
                        ? <a href={item.certHref} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><FileText size={14} /> Open</a>
                        : <span className="text-amber-700">Not on file yet</span>}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted shrink-0">Added</dt>
                    <dd className="font-medium text-right">{item.addedLabel}{item.addedByName ? ` by ${item.addedByName}` : ''}</dd>
                  </div>
                  {item.note && <div className="flex justify-between gap-4"><dt className="text-ink-muted shrink-0">Note</dt><dd className="font-medium text-right">{item.note}</dd></div>}
                </dl>
                {canAdjust && (
                  <div className="flex justify-end">
                    <button type="button" className="btn-danger btn-sm" onClick={() => setConfirming(true)}>Remove from stock</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-1 text-signal">Remove cast {item.castNumber}?</h2>
                <p className="text-sm text-ink-muted mb-4">
                  This takes the {item.sizeLabel} ({item.weightKg.toLocaleString('en-GB')} kg) out of stock. It can&apos;t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                  <form action={removeSteelStock}>
                    <input type="hidden" name="itemId" value={item.id} />
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

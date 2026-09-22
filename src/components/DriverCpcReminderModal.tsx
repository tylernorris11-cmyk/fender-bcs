'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { setOwnDriverCpcExpiry } from '@/app/setup/actions';

/** "Later" hides it for the rest of the day — it comes back tomorrow if the CPC expiry still hasn't been given. */
export function DriverCpcReminderModal({ dismissKey }: { dismissKey: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(dismissKey) === '1'; } catch { /* storage blocked — just show it */ }
    setOpen(!dismissed);
  }, [dismissKey]);

  // Already has its own way to set this there — no need to nag on top of it.
  const onDriversPage = pathname.startsWith('/setup/drivers');

  useEffect(() => {
    if (open && !onDriversPage) dateInput.current?.focus();
  }, [open, onDriversPage]);

  function later() {
    try { window.localStorage.setItem(dismissKey, '1'); } catch { /* fine — it'll show again on the next page */ }
    setOpen(false);
  }

  if (!open || onDriversPage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') later(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="driver-cpc-reminder-title" className="card card-pad w-full max-w-md text-center">
        <span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 mb-4">
          <ShieldAlert size={28} aria-hidden />
        </span>
        <h2 id="driver-cpc-reminder-title" className="text-xl font-bold">Your Driver CPC expiry isn&apos;t on file</h2>
        <p className="text-ink-muted mt-2">
          Let us know when yours runs out, so it can be kept track of like everyone else&apos;s.
        </p>
        <form
          action={async (formData) => { await setOwnDriverCpcExpiry(formData); setOpen(false); }}
          className="flex flex-col gap-3 mt-6"
        >
          <div className="flex justify-center gap-2">
            <input ref={dateInput} type="date" name="cpcExpiry" required className="input max-w-[180px]" aria-label="Driver CPC expiry date" />
            <button type="submit" className="btn-primary">Save</button>
          </div>
          <button type="button" onClick={later} className="btn-secondary self-center">Remind me later</button>
        </form>
      </div>
    </div>
  );
}

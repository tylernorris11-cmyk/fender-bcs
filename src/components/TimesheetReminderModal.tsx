'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock } from 'lucide-react';

/** "Later" hides it for the rest of the day (per person, per week) — it comes back tomorrow if the week still hasn't been handed in. */
export function TimesheetReminderModal({
  weekLabel, href, when, dismissKey,
}: { weekLabel: string; href: string; when: 'tomorrow' | 'today' | 'overdue'; dismissKey: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(dismissKey) === '1'; } catch { /* storage blocked — just show it */ }
    setOpen(!dismissed);
  }, [dismissKey]);

  const onTimesheetPage = pathname.startsWith('/timesheets');

  useEffect(() => {
    if (open && !onTimesheetPage) primary.current?.focus();
  }, [open, onTimesheetPage]);

  function later() {
    try { window.localStorage.setItem(dismissKey, '1'); } catch { /* fine — it'll show again on the next page */ }
    setOpen(false);
  }

  if (!open || onTimesheetPage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') later(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="timesheet-reminder-title" className="card card-pad w-full max-w-md text-center">
        <span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 mb-4">
          <Clock size={28} aria-hidden />
        </span>
        <h2 id="timesheet-reminder-title" className="text-xl font-bold">
          {when === 'tomorrow' ? 'Your timesheet is due tomorrow' : when === 'today' ? 'Your timesheet is due today' : 'Your timesheet is overdue'}
        </h2>
        <p className="text-ink-muted mt-2">
          Last week&apos;s hours ({weekLabel}) need filling in and handing in. It only takes a minute — start, finish and breaks for each day you were in.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-center mt-6">
          <button type="button" onClick={later} className="btn-secondary">Remind me later</button>
          <Link ref={primary} href={href} className="btn-primary">Fill it in now</Link>
        </div>
      </div>
    </div>
  );
}

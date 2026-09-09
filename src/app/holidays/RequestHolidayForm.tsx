'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { parseDayInput, workingDaysBetween } from '@/lib/holidays';
import { SubmitButton } from '@/components/SubmitButton';
import { requestHoliday } from './actions';

type Conflict = { name: string; colour: string; status: 'PENDING' | 'APPROVED'; startDate: string; endDate: string };

/** remainingDays: the requester's own paid days left in the current
 * holiday year (see lib/holidayBalance.ts) — used only to warn them here
 * before they submit; the real number that gets stored is worked out
 * server-side the same way, not trusted from this component. */
export function RequestHolidayForm({ remainingDays }: { remainingDays: number }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [checking, setChecking] = useState(false);
  const [pendingUnpaidDays, setPendingUnpaidDays] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  const start = parseDayInput(startDate);
  const end = parseDayInput(endDate);
  const workingDays = start && end && end >= start ? workingDaysBetween(start, end) : null;
  const unpaidDays = workingDays !== null ? Math.max(0, workingDays - Math.max(0, remainingDays)) : 0;

  // Debounced live conflict check — the point of showing it here, before
  // submitting, not just after someone's already asked.
  useEffect(() => {
    if (!start || !end || end < start) { setConflicts([]); return; }
    setChecking(true);
    const timer = setTimeout(() => {
      fetch(`/api/holidays/conflicts?start=${startDate}&end=${endDate}`)
        .then((r) => r.json())
        .then((data) => setConflicts(data.conflicts ?? []))
        .catch(() => setConflicts([]))
        .finally(() => setChecking(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) { confirmedRef.current = false; return; }
    if (unpaidDays > 0) {
      e.preventDefault();
      setPendingUnpaidDays(unpaidDays);
    }
  }

  function confirmAndSubmit() {
    confirmedRef.current = true;
    setPendingUnpaidDays(null);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={requestHoliday} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="startDate">First day</label>
            <input id="startDate" name="startDate" type="date" required className="input"
                   value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="endDate">Last day</label>
            <input id="endDate" name="endDate" type="date" required className="input"
                   value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {workingDays !== null && (
          <p className="text-sm text-ink-muted">
            <strong className="text-ink">{workingDays} working day{workingDays === 1 ? '' : 's'}</strong> — weekends and bank holidays don&apos;t count against your allowance.
            {unpaidDays > 0 && (
              <span className="block text-signal font-medium mt-1">
                You have {Math.max(0, remainingDays)} paid day{Math.max(0, remainingDays) === 1 ? '' : 's'} left —
                {' '}{unpaidDays} of these would be unpaid holiday.
              </span>
            )}
          </p>
        )}

        {checking && <p className="text-sm text-ink-faint">Checking who else is off…</p>}

        {!checking && conflicts.length > 0 && (
          <div className="banner-warn">
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {conflicts.length} colleague{conflicts.length === 1 ? ' has' : 's have'} time off somewhere in this range
              </p>
              <ul className="mt-1.5 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.colour || '#16A085' }} aria-hidden />
                    {c.name} — {c.startDate} to {c.endDate}
                    {c.status === 'PENDING' && <span className="text-ink-faint">(requested, not yet approved)</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="note">Note (optional)</label>
          <input id="note" name="note" className="input" placeholder="Anything worth flagging" />
        </div>

        <SubmitButton pendingLabel="Requesting…">Request holiday</SubmitButton>
      </form>

      {pendingUnpaidDays !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={() => setPendingUnpaidDays(null)}
          role="dialog" aria-modal="true" aria-labelledby="unpaid-holiday-heading"
        >
          <div className="card card-pad max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 id="unpaid-holiday-heading" className="text-lg font-bold mb-1 text-signal">
              Part of this will be unpaid
            </h2>
            <p className="text-sm text-ink-muted mb-4">
              You have {Math.max(0, remainingDays)} paid day{Math.max(0, remainingDays) === 1 ? '' : 's'} left this holiday year.
              This request is for {workingDays} day{workingDays === 1 ? '' : 's'}, so{' '}
              <strong className="text-ink">{pendingUnpaidDays} of {workingDays} would be unpaid holiday</strong>.
            </p>
            <p className="text-sm font-medium mb-4">Do you want to continue?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPendingUnpaidDays(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={confirmAndSubmit}>Yes, request it anyway</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

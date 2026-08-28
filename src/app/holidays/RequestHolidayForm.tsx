'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { parseDayInput, workingDaysBetween } from '@/lib/holidays';
import { requestHoliday } from './actions';

type Conflict = { name: string; colour: string; status: 'PENDING' | 'APPROVED'; startDate: string; endDate: string };

export function RequestHolidayForm() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [checking, setChecking] = useState(false);

  const start = parseDayInput(startDate);
  const end = parseDayInput(endDate);
  const workingDays = start && end && end >= start ? workingDaysBetween(start, end) : null;

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

  return (
    <form action={requestHoliday} className="space-y-4">
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

      <button type="submit" className="btn-primary">Request holiday</button>
    </form>
  );
}

'use client';

import { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { checkCastNumber } from './actions';

type Status = 'idle' | 'checking' | 'match' | 'no-match';

/**
 * Cast-number field for the "add a row" tally form. Checks the typed value
 * against the compliance records (Batch.heatNumber) and shows a green tick
 * if it matches or an amber triangle if it doesn't — on blur, and immediately
 * if pre-filled (the value is auto-copied forward from the previous row).
 */
export function CastNumberField({ defaultValue = '' }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>('idle');
  const [, startTransition] = useTransition();

  function check(v: string) {
    const trimmed = v.trim();
    if (!trimmed) { setStatus('idle'); return; }
    setStatus('checking');
    startTransition(async () => {
      const ok = await checkCastNumber(trimmed);
      setStatus(ok ? 'match' : 'no-match');
    });
  }

  useEffect(() => {
    if (defaultValue.trim()) check(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="label text-xs" htmlFor="castNumber">Cast number</label>
      <div className="relative">
        <input
          id="castNumber" name="castNumber" className="input pr-9" value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => check(e.target.value)}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden>
          {status === 'match' && <CheckCircle2 size={16} className="text-forest" />}
          {status === 'no-match' && <AlertTriangle size={16} className="text-amber-600" />}
        </span>
      </div>
      {status === 'no-match' && <p className="hint text-amber-600">No matching cast in the compliance records — check the tag.</p>}
    </div>
  );
}

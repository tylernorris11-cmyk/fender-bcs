'use client';

import { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { checkCastNumber } from './actions';

type Status = 'idle' | 'checking' | 'certified' | 'stock-only' | 'unknown';

const HINT: Partial<Record<Status, { text: string; tone: string }>> = {
  certified: { text: 'Certificate on file.', tone: 'text-forest' },
  'stock-only': { text: 'In stock, but no certificate on file for this cast yet.', tone: 'text-amber-600' },
  unknown: { text: 'Not in stock or on a certificate — check the tag.', tone: 'text-amber-600' },
};

/**
 * Cast-number field for the "add a row" tally form. Checks the typed value
 * against Fender's light and heavy gauge stock and the confirmed casts on
 * mill certificates: a green tick when there's a certificate behind it, an
 * amber triangle when there isn't. Checked on blur, and straight away when
 * pre-filled (the value is carried forward from the previous row).
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
      const found = await checkCastNumber(trimmed);
      setStatus(found.certificate ? 'certified' : found.inStock ? 'stock-only' : 'unknown');
    });
  }

  useEffect(() => {
    if (defaultValue.trim()) check(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = HINT[status];
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
          {status === 'certified' && <CheckCircle2 size={16} className="text-forest" />}
          {(status === 'stock-only' || status === 'unknown') && <AlertTriangle size={16} className="text-amber-600" />}
        </span>
      </div>
      {hint && <p className={`hint ${hint.tone}`}>{hint.text}</p>}
    </div>
  );
}

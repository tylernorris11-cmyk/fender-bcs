'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SwitcherItem = { key: string; label: string; href: string };

/** The module pill in the header — click it to jump straight to any area
 * the signed-in user has access to, instead of going home first. */
export function ModuleSwitcher({
  current, currentLabel, items,
}: { current: string; currentLabel: string; items: SwitcherItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn bg-white/10 hover:bg-white/15 text-white px-4 py-2 text-sm"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {currentLabel} <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-56 max-h-[70vh] overflow-y-auto rounded-xl border border-hairline bg-white shadow-pop py-1.5 z-30"
        >
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={item.key === current ? 'page' : undefined}
              className={`block px-4 py-2.5 text-sm transition-colors ${
                item.key === current ? 'bg-brand-50 text-forest font-semibold' : 'text-ink hover:bg-canvas'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

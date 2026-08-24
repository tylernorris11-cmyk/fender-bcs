'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Suggestion } from '@/app/api/search/suggest/route';

/**
 * The header search box. A plain <form action="/search"> underneath, so
 * pressing Enter with nothing highlighted still goes to the full results
 * page exactly as it always did — the dropdown is a progressive enhancement
 * on top, not a replacement for it.
 */
export function GlobalSearch({
  placeholder = 'Search orders, customers…',
  label = 'Search orders and customers',
  className = 'hidden sm:flex flex-1 max-w-xl relative',
}: { placeholder?: string; label?: string; className?: string } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function onChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { results: Suggestion[] } = await res.json();
        setResults(data.results);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        // Aborted by a newer keystroke, or a network hiccup — leave things as they are.
      }
    }, 180);
  }

  function closeAndReset() {
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      const target = results[highlighted].href;
      closeAndReset();
      router.push(target);
    }
    // Enter with nothing highlighted falls through to the form's normal submit.
  }

  return (
    <form action="/search" ref={formRef} autoComplete="off" className={className}>
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" aria-hidden />
      <label className="sr-only" htmlFor="global-search">{label}</label>
      <input
        id="global-search" name="q" value={query} autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls="global-search-results"
        className="w-full rounded-xl bg-white/10 border border-white/10 pl-10 pr-4 py-2.5 text-sm
                   text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
      />

      {open && results.length > 0 && (
        <div id="global-search-results" role="listbox"
             className="absolute left-0 top-full mt-2 w-full max-h-[70vh] overflow-y-auto rounded-xl border border-hairline bg-white shadow-pop py-1.5 z-30">
          {results.map((r, i) => (
            <Link
              key={`${r.type}-${r.href}-${i}`}
              href={r.href}
              role="option"
              aria-selected={i === highlighted}
              onClick={closeAndReset}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                i === highlighted ? 'bg-brand-50' : 'hover:bg-canvas'
              }`}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-ink truncate">{r.label}</span>
                {r.sublabel && <span className="block text-xs text-ink-muted truncate">{r.sublabel}</span>}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">{r.type}</span>
            </Link>
          ))}
          <Link
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={closeAndReset}
            className="block border-t border-hairline mt-1 pt-2.5 px-4 py-2 text-sm font-semibold text-brand-700 hover:underline"
          >
            See all results for “{query.trim()}”
          </Link>
        </div>
      )}
    </form>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';

export type PickerCustomer = { id: string; name: string; code: string; address: string; town: string; postcode: string };

// Enough to scan by eye; past this, another letter or two narrows it faster than scrolling.
const MAX_SHOWN = 50;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The account's address on one line — most imported accounts keep their town in the address rather than the town field. */
const oneLine = (c: PickerCustomer) => {
  const parts = c.address.split(/\r?\n|,\s+/).map((l) => l.trim()).filter(Boolean);
  for (const extra of [c.town, c.postcode]) if (extra.trim() && !parts.some((p) => norm(p) === norm(extra))) parts.push(extra.trim());
  return parts.join(', ');
};

/**
 * Every customer matching all the typed words, anywhere in the name, account
 * code, address, town or postcode. A code typed exactly comes first, then
 * names starting with what's typed, then the rest alphabetically.
 */
function search(customers: PickerCustomer[], query: string) {
  const q = norm(query);
  if (!q) return customers;
  const words = q.split(' ');
  const scored: { c: PickerCustomer; score: number }[] = [];
  for (const c of customers) {
    const name = norm(c.name);
    const hay = `${name} ${norm(c.code)} ${norm(c.address)} ${norm(c.town)} ${norm(c.postcode)} ${norm(c.postcode).replace(/ /g, '')}`;
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push({ c, score: norm(c.code) === q ? 0 : name.startsWith(q) ? 1 : name.includes(` ${words[0]}`) ? 2 : 3 });
  }
  return scored.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name)).map((s) => s.c);
}

/**
 * Pick a customer by typing part of their name, account code, town or
 * postcode — a dropdown of 1,500+ accounts is too long to scroll. Posts the
 * chosen customer's id as `name`, and won't let the form submit with text
 * typed but nothing picked.
 */
export function CustomerPicker({
  customers, name = 'customerId', id = name, defaultValue = '', required = false, onChange, onNotListed,
}: {
  customers: PickerCustomer[];
  name?: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (customer: PickerCustomer | undefined) => void;
  /** Offered when nothing matches: open a new account under the typed name. */
  onNotListed?: (typed: string) => void;
}) {
  const initial = customers.find((c) => c.id === defaultValue);
  const [selected, setSelected] = useState<PickerCustomer | undefined>(initial);
  const [query, setQuery] = useState(initial?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Typing over a picked customer unpicks them; Escape brings them back.
  const lastPicked = useRef(initial);

  // While a customer is picked the box shows their name, so list everyone again rather than just them.
  const matches = useMemo(() => search(customers, selected ? '' : query), [customers, query, selected]);
  const shown = matches.slice(0, MAX_SHOWN);
  const typed = query.trim();

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      selected ? ''
      : typed ? 'Pick a customer from the list.'
      : required ? 'Pick a customer.' : '',
    );
  }, [selected, typed, required]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  });

  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  function choose(c: PickerCustomer | undefined) {
    lastPicked.current = c;
    setSelected(c);
    setQuery(c?.name ?? '');
    setOpen(false);
    onChange?.(c);
  }

  function onType(value: string) {
    setQuery(value);
    setActive(0);
    setOpen(true);
    if (selected) { setSelected(undefined); onChange?.(undefined); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((i) => Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter') {
      // Enter in here only ever picks a customer — a second press shouldn't save the whole order.
      e.preventDefault();
      if (!open) setOpen(true);
      else if (shown[active]) choose(shown[active]);
      else if (typed && onNotListed) { setOpen(false); onNotListed(typed); }
    } else if (e.key === 'Escape' && (open || (!selected && lastPicked.current))) {
      e.preventDefault();
      if (!selected && lastPicked.current) choose(lastPicked.current);
      else setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" aria-hidden />
      <input
        ref={inputRef} id={id} value={query} autoComplete="off" spellCheck={false}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => { e.target.select(); setOpen(true); }}
        onClick={() => setOpen(true)}
        placeholder="Type a name, account code, town or postcode"
        role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={listId}
        aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
        className="input !pl-9 !pr-9"
      />
      {query && (
        <button type="button" aria-label="Clear customer" tabIndex={-1}
                onClick={() => { choose(undefined); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-faint hover:text-ink hover:bg-canvas">
          <X size={15} />
        </button>
      )}

      {open && (
        <div id={listId} role="listbox"
             className="absolute left-0 top-full mt-1.5 w-full max-h-80 overflow-y-auto rounded-xl border border-hairline bg-white shadow-pop py-1.5 z-30">
          {shown.map((c, i) => (
            <div
              key={c.id} id={`${id}-opt-${i}`} role="option" aria-selected={c.id === selected?.id}
              onMouseDown={(e) => { e.preventDefault(); choose(c); }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2 text-sm cursor-pointer ${i === active ? 'bg-brand-50' : ''}`}
            >
              <span className="min-w-0">
                <span className={`block truncate ${c.id === selected?.id ? 'font-bold text-brand-700' : 'font-semibold text-ink'}`}>{c.name}</span>
                {oneLine(c) && <span className="block text-xs text-ink-muted truncate">{oneLine(c)}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-faint">{c.code}</span>
            </div>
          ))}
          {matches.length > MAX_SHOWN && (
            <p className="px-3.5 pt-2 pb-1 text-xs text-ink-muted border-t border-hairline mt-1">
              {matches.length - MAX_SHOWN} more — keep typing to narrow it down.
            </p>
          )}
          {matches.length === 0 && (
            <p className="px-3.5 py-2 text-sm text-ink-muted">No customer matches “{typed}”.</p>
          )}
          {matches.length === 0 && typed && onNotListed && (
            <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); onNotListed(typed); }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              <Plus size={15} /> Open a new account for “{typed}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

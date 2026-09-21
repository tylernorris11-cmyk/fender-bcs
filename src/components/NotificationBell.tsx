'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';

type Item = { id: string; severity: 'bad' | 'warn' | 'info'; title: string; detail: string; href: string };

const DOT = { bad: 'bg-signal', warn: 'bg-amber-500', info: 'bg-sky-500' } as const;
const SHOWN = 8;

/**
 * The bell in the header. Click it and a menu drops down with what needs
 * attention, each one a link straight to the thing itself — "See everything"
 * goes to the full page. The count on the bell comes from the page (already
 * worked out server-side); the list is fetched when the menu opens. It's a
 * real link to /alerts underneath, so opening it in a new tab or with
 * scripts off still works.
 */
export function NotificationBell({ count }: { count: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLAnchorElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    fetch('/api/alerts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { if (!cancelled) setItems(data.alerts ?? []); })
      .catch(() => { if (!cancelled) setFailed(true); });

    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Link
        ref={button}
        href="/alerts"
        onClick={(e) => {
          // Let a modified click (new tab, new window) go to the page as normal.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="relative block rounded-xl bg-white/10 hover:bg-white/15 p-2.5"
        aria-label={`Notifications, ${count} needing attention`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-signal text-[10px] font-bold grid place-items-center">
            {count}
          </span>
        )}
      </Link>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-white text-ink shadow-pop z-30 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-hairline font-bold">Notifications</div>

          <div className="max-h-[60vh] overflow-y-auto">
            {failed ? (
              <p className="px-4 py-6 text-sm text-ink-muted">Couldn&apos;t load them just now — try again in a moment.</p>
            ) : items === null ? (
              <p className="px-4 py-6 text-sm text-ink-muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden /> Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-700" aria-hidden /> Nothing needs attention.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {items.slice(0, SHOWN).map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-canvas">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.severity]}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{a.title}</span>
                        {a.detail && <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2">{a.detail}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 border-t border-hairline text-sm font-semibold text-brand-700 hover:bg-canvas"
          >
            {items && items.length > SHOWN ? `See all ${items.length} notifications` : 'See everything'}
          </Link>
        </div>
      )}
    </div>
  );
}

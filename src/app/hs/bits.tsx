import Link from 'next/link';
import type { ReactNode } from 'react';
import { chip } from '@/lib/hs';

/** A small coloured status chip — tone is one of the *_TONE classes in lib/hs. */
export function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`${chip} ${tone}`}>{children}</span>;
}

/** The row of tabs over a register — All, Incidents, Near misses and so on. */
export function TabLinks({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-4">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium border transition-colors ${
            active === t.key ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'
          }`}
        >
          {t.label}{t.count != null && <span className={`ml-1.5 ${active === t.key ? 'text-white/75' : 'text-ink-faint'}`}>{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** A day-and-month badge, red when it's already gone. */
export function DateBadge({ date, overdue }: { date: Date; overdue?: boolean }) {
  return (
    <span className={`${chip} ${overdue ? 'bg-signal/10 text-signal' : 'bg-amber-50 text-amber-800'} w-[62px] justify-center tabular-nums`}>
      {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
    </span>
  );
}

/** A label/value pair in a details panel. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-ink-faint">—</span>}</dd>
    </div>
  );
}

/** UTC-midnight dates (review dates, due dates, expiry dates) shown without a timezone shift. */
export const dayLabel = (d?: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

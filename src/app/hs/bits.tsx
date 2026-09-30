import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { chip } from '@/lib/hs';

/** A small coloured status chip — tone is one of the *_TONE classes in lib/hs. */
export function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`${chip} ${tone}`}>{children}</span>;
}

const ICON_TONE = {
  good: 'bg-brand-100 text-forest',
  bad: 'bg-signal/10 text-signal',
  warn: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
} as const;

/** The dashboard's stat card: an icon in a soft circle, the number, what it counts, and a line under it. */
export function IconStat({
  icon: Icon, tone, value, label, sub, href,
}: { icon: LucideIcon; tone: keyof typeof ICON_TONE; value: ReactNode; label: string; sub?: string; href?: string }) {
  const body = (
    <div className="card p-5 flex items-center gap-4 h-full">
      <span className={`grid place-items-center h-12 w-12 rounded-full shrink-0 ${ICON_TONE[tone]}`}><Icon size={22} /></span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-sm font-medium mt-1.5">{label}</p>
        {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full hover:shadow-pop rounded-card transition-shadow">{body}</Link> : body;
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

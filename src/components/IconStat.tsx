import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const ICON_TONE = {
  good: 'bg-brand-100 text-forest',
  bad: 'bg-signal/10 text-signal',
  warn: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
} as const;

/** A dashboard tile: an icon in a soft circle, the number, what it counts, and a line under it. */
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

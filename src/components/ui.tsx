import Link from 'next/link';
import type { ReactNode } from 'react';
import type { OrderStage } from '@prisma/client';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

// ---------------------------------------------------------------- stages

export const STAGE_LABEL: Record<OrderStage, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In production',
  READY_FOR_DELIVERY: 'Ready for delivery',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STAGE_STYLE: Record<OrderStage, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  IN_PRODUCTION: 'bg-violet-100 text-violet-800',
  READY_FOR_DELIVERY: 'bg-brand-100 text-forest',
  OUT_FOR_DELIVERY: 'bg-sky-100 text-sky-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-brand text-white',
  CANCELLED: 'bg-signal/10 text-signal',
};

/** The order journey, in the sequence the yard actually works it. */
export const STAGE_FLOW: OrderStage[] = [
  'DRAFT', 'APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED',
];

export function StagePill({ stage }: { stage: OrderStage }) {
  return (
    <span className={`pill ${STAGE_STYLE[stage]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const styles = {
    neutral: 'bg-slate-100 text-slate-600',
    good: 'bg-brand-100 text-forest',
    warn: 'bg-amber-100 text-amber-800',
    bad: 'bg-signal/10 text-signal',
    info: 'bg-sky-100 text-sky-800',
  } as const;
  return <span className={`pill ${styles[tone]}`}>{children}</span>;
}

// ------------------------------------------------------------------ bits

export function PageHeader({ title, blurb, actions }: { title: string; blurb?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {blurb && <p className="text-ink-muted mt-1.5">{blurb}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  value, label, tone = 'default', href,
}: { value: ReactNode; label: string; tone?: 'default' | 'warn' | 'bad' | 'good'; href?: string }) {
  const numTone = { default: 'text-ink', warn: 'text-amber-700', bad: 'text-signal', good: 'text-brand-700' }[tone];
  const body = (
    <div className="stat h-full">
      <div className={`stat-num ${numTone}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full hover:opacity-90 transition-opacity">{body}</Link> : body;
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">{children}</div>;
}

export function Section({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-pad mb-6">
      {(title || aside) && (
        <header className="flex items-center justify-between gap-4 mb-4">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="text-ink-muted">{title}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Avatar({ name, colour, size = 28 }: { name: string; colour?: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
      style={{ width: size, height: size, background: colour || '#16A085' }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 100 ? 'bg-signal' : pct >= 80 ? 'bg-amber-500' : 'bg-brand';
  return (
    <div className="h-2 w-full rounded-full bg-hairline overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
    </div>
  );
}

// -------------------------------------------------------------- sorting

/**
 * A clickable column header for `<Table>` pages. Preserves every other
 * query param, toggles `sort=<field>&dir=asc|desc` (unsorted -> asc -> desc
 * -> asc...), and shows which column and direction is active.
 */
export function SortTh({
  label, field, basePath, searchParams, align,
}: {
  label: string;
  field: string;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  align?: 'right';
}) {
  const isActive = searchParams.sort === field;
  const dir: 'asc' | 'desc' = searchParams.dir === 'desc' ? 'desc' : 'asc';
  const nextDir: 'asc' | 'desc' = isActive && dir === 'asc' ? 'desc' : 'asc';

  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (v && k !== 'sort' && k !== 'dir') params.set(k, v);
  });
  params.set('sort', field);
  params.set('dir', nextDir);

  const Icon = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={`th ${align === 'right' ? 'text-right' : ''}`}>
      <Link
        href={`${basePath}?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-ink transition-colors ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon size={12} className={isActive ? 'text-brand' : 'opacity-30'} aria-hidden />
      </Link>
    </th>
  );
}

/** A plain `<select name="sort">` for list pages that aren't `<Table>` rows. */
export function SortSelect({
  value, options, label = 'Sort',
}: { value?: string; options: { value: string; label: string }[]; label?: string }) {
  return (
    <select name="sort" defaultValue={value ?? options[0]?.value} className="input w-auto" aria-label={label}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full min-w-[640px]">
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="banner-bad mb-4">{message}</p>;
}

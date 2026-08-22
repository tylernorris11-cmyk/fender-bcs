export const money = (v: unknown) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
    .format(Number(v ?? 0));

export const money0 = (v: unknown) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
    .format(Number(v ?? 0));

export const tonnes = (kg: unknown) => `${(Number(kg ?? 0) / 1000).toFixed(3)} t`;

export const qty = (v: unknown, unit = 't') =>
  unit === 't' ? `${Number(v ?? 0).toFixed(3)} t` : `${Number(v ?? 0).toLocaleString('en-GB')} ${unit}`;

export const shortDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const longDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const clock = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

export const daysUntil = (d?: Date | string | null) => {
  if (!d) return null;
  const ms = new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
};

/** Turn "James Ward" into "JW" for the avatar chips. */
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const num = (v: unknown) => Number(v ?? 0);

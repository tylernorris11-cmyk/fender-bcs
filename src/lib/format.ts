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

/** 6 ft + 3 in -> 6'3" — feet on its own still reads fine as 6'0". */
export const feetInches = (ft?: number | null, inches?: number | null) =>
  ft == null && inches == null ? '' : `${ft ?? 0}'${inches ?? 0}"`;

/** A short spec line for products sized by length — empty string if none of it is set. */
export const productSpec = (p: { lengthFt?: number | null; lengthIn?: number | null; thicknessMm?: unknown; bundleWeightKg?: unknown }) => {
  const parts: string[] = [];
  if (p.lengthFt != null || p.lengthIn != null) parts.push(feetInches(p.lengthFt, p.lengthIn));
  if (p.thicknessMm != null) parts.push(`${Number(p.thicknessMm)}mm`);
  if (p.bundleWeightKg != null) parts.push(`${Number(p.bundleWeightKg)}kg/bundle`);
  return parts.join(' · ');
};

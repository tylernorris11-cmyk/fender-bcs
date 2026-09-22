export const money = (v: unknown) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
    .format(Number(v ?? 0));

export const money0 = (v: unknown) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
    .format(Number(v ?? 0));

export const tonnes = (kg: unknown) => `${(Number(kg ?? 0) / 1000).toFixed(3)} t`;

export const qty = (v: unknown, unit = 't') =>
  unit === 't' ? `${Number(v ?? 0).toFixed(3)} t` : `${Number(v ?? 0).toLocaleString('en-GB')} ${unit}`;

// Every one of these renders on the server, which on Vercel always runs in
// UTC regardless of deploy region — never the visitor's own browser
// timezone. Without an explicit timeZone, that's fine for the date-only
// helpers most of the year but silently wrong for clock() specifically:
// Britain is UTC+1 (BST) roughly late March to late October, so any time
// rendered against the server's UTC clock reads exactly one hour behind
// for most of the year. Pin all three to Europe/London explicitly — it
// already knows about the BST/GMT switch, so this needs no seasonal logic.
const UK_TZ = 'Europe/London';

export const shortDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: UK_TZ }) : '—';

export const longDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: UK_TZ }) : '—';

export const clock = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: UK_TZ }) : '';

/**
 * The inverse of clock() — converts a UK wall-clock date+time (what someone
 * typed into a <input type="date"> and <input type="time">) into the
 * correct UTC instant to store. A bare "yyyy-mm-dd" on its own is safely
 * UTC-midnight already, per the date-string spec, but as soon as a time is
 * added it becomes a local-time string — on Vercel's UTC server that would
 * take "14:00" to mean 14:00 UTC, an hour out during BST, rather than the
 * 14:00 in London someone actually typed. Works out the UK's current
 * offset from the date itself (BST vs GMT), rather than a hardcoded date
 * range, so it stays right whichever side of the clock change it's on.
 */
export function ukTimeToUtc(dateStr: string, timeStr: string): Date {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`); // treat the wall-clock string as if it were already UTC
  // Read that same instant back out in Europe/London — the gap between what
  // was asked for and what comes back is exactly the UK's current offset.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return new Date(guess.getTime() + (guess.getTime() - asIfUtc));
}

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

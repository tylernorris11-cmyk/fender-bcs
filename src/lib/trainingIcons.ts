import {
  AlertTriangle, ArrowUpFromLine, Boxes, Brush, ClipboardCheck, ClipboardList, Compass, Flame, Footprints,
  HandMetal, RotateCw, Scissors, Settings, ShieldCheck, Siren, Truck, Weight, MoveVertical, XOctagon,
  type LucideIcon,
} from 'lucide-react';

// Full literal class strings, not interpolated ones — Tailwind's JIT scanner
// only picks up classes it can see written out in the source (same reason
// MODULE_COLORS/TONES elsewhere in this app are plain string lookups rather
// than `bg-${color}-100` built at runtime).
const VIOLET = 'bg-violet-100 text-violet-700';
const SIGNAL = 'bg-signal/10 text-signal';
const BRAND = 'bg-brand-100 text-brand-700';
const AMBER = 'bg-amber-100 text-amber-700';
const TEAL = 'bg-teal-100 text-teal-700';
const INDIGO = 'bg-indigo-100 text-indigo-700';
const ORANGE = 'bg-orange-100 text-orange-700';

/** Picks an icon and accent colour for one line of training content, purely
 * from its wording — content stays a flat string[] (no schema change, and
 * every existing module's content "just works" through this), but the
 * training page can still render each point as its own icon row instead of
 * a plain bullet. Order matters: more specific topics are checked first so
 * a line mentioning both, say, PPE and forklifts still lands on the more
 * relevant icon for what it's actually about. */
const RULES: { test: RegExp; icon: LucideIcon; tone: string; warning?: boolean }[] = [
  { test: /golden rule|stop and ask/i, icon: Compass, tone: VIOLET },
  { test: /never take shortcuts|^never:/i, icon: XOctagon, tone: SIGNAL, warning: true },
  { test: /ten steel yard safety rules|key rules to remember/i, icon: ClipboardCheck, tone: BRAND },
  { test: /main .*hazards|typical hazards/i, icon: AlertTriangle, tone: AMBER },
  { test: /\bppe\b|safety footwear|hi-vis|gloves\b|eye protection|hearing protection|personal protective/i, icon: ShieldCheck, tone: TEAL },
  { test: /forklift/i, icon: Truck, tone: INDIGO },
  { test: /\bhgv\b|lorr(y|ies)|deliveries/i, icon: Truck, tone: INDIGO },
  { test: /crane|suspended load/i, icon: MoveVertical, tone: VIOLET },
  { test: /storage|stacking|\bstack/i, icon: Boxes, tone: AMBER },
  { test: /banding/i, icon: Scissors, tone: ORANGE },
  { test: /rolling|round bar|wire coil/i, icon: RotateCw, tone: ORANGE },
  { test: /sharp edges|cut ends/i, icon: HandMetal, tone: SIGNAL },
  { test: /manual handling/i, icon: Weight, tone: INDIGO },
  { test: /machinery|guard/i, icon: Settings, tone: VIOLET },
  { test: /housekeeping/i, icon: Brush, tone: TEAL },
  { test: /slips, trips|trip hazard/i, icon: Footprints, tone: AMBER },
  { test: /working at height|climb/i, icon: ArrowUpFromLine, tone: SIGNAL },
  { test: /loading and unloading/i, icon: Boxes, tone: INDIGO },
  { test: /grinding, cutting and hot work|welding/i, icon: Flame, tone: SIGNAL },
  { test: /emergency procedures|raise the alarm/i, icon: Siren, tone: SIGNAL },
  { test: /accidents|near misses/i, icon: ClipboardList, tone: AMBER },
];

const DEFAULT = { icon: ShieldCheck, tone: BRAND, warning: false };

/** Matches against the heading first (e.g. "Emergency procedures") and only
 * falls back to the full line if that misses — otherwise a line like
 * "Emergency procedures: ...stop the machinery involved and raise the
 * alarm" matches "machinery" from deep in its own body text instead of the
 * topic its heading actually names. */
export function iconForTrainingLine(line: string, heading: string | null): { icon: LucideIcon; tone: string; warning: boolean } {
  const match = (heading && RULES.find((r) => r.test.test(heading))) || RULES.find((r) => r.test.test(line));
  return match ? { icon: match.icon, tone: match.tone, warning: !!match.warning } : DEFAULT;
}

/** Splits "Heading: the rest of the point" (or "Heading — the rest") into
 * a short bold lead-in and the remaining detail, for lines written that
 * way — content authored without that shape just renders as plain body
 * text, no heading forced onto it. */
export function splitTrainingLine(line: string): { heading: string | null; body: string } {
  const match = line.match(/^(.{3,60}?)(?::|—)\s+(.*)$/s);
  if (!match) return { heading: null, body: line };
  return { heading: match[1].trim(), body: match[2].trim() };
}

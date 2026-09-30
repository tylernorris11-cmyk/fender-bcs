import type { HsAssessmentKind, HsIncidentStatus, HsIncidentType, HsRiskLevel } from '@prisma/client';
import { isoDateUk } from './format';

/** Suggestions for the area fields — typed freely, these just save typing. */
export const HS_AREAS = ['Yard', 'Machine shop', 'Workshop', 'Warehouse', 'Office', 'Site', 'Maintenance', 'Vehicles', 'All areas'];

/** Suggestions for the course field on a training record. */
export const HS_COURSES = [
  'Forklift (counterbalance)', 'Overhead crane', 'Slinger / signaller', 'Lorry loader (hiab)', 'MEWP / access platform',
  'Abrasive wheels', 'First aid at work', 'Emergency first aid at work', 'Fire warden', 'Manual handling',
  'Site induction', 'Driver CPC', 'IOSH Managing Safely', 'NEBOSH General Certificate',
];

export const ASSESSMENT_KIND: Record<HsAssessmentKind, { label: string; plural: string; path: string; prefix: string; blurb: string }> = {
  RISK_ASSESSMENT: {
    label: 'Risk assessment', plural: 'Risk Assessments', path: '/hs/risk-assessments', prefix: 'RA',
    blurb: 'Identifying hazards, managing risks, and keeping everyone safe on site.',
  },
  METHOD_STATEMENT: {
    label: 'Method statement', plural: 'Method Statements', path: '/hs/method-statements', prefix: 'MS',
    blurb: 'How each job is done safely, step by step.',
  },
};

export const RISK_LEVEL_LABEL: Record<HsRiskLevel, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
export const RISK_LEVEL_TONE: Record<HsRiskLevel, string> = {
  LOW: 'bg-brand-100 text-forest',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-signal/10 text-signal',
};

/** The usual 5 × 5 matrix: 1–4 low, 5–12 medium, 15–25 high. */
export function riskLevelFor(score: number): HsRiskLevel {
  if (score >= 15) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

export const LIKELIHOOD_LABEL = ['', 'Very unlikely', 'Unlikely', 'Possible', 'Likely', 'Very likely'];
export const SEVERITY_LABEL = ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Fatal'];

export const INCIDENT_TYPE_LABEL: Record<HsIncidentType, string> = { INCIDENT: 'Incident', NEAR_MISS: 'Near miss', HAZARD: 'Hazard' };
export const INCIDENT_TYPE_TONE: Record<HsIncidentType, string> = {
  INCIDENT: 'bg-signal/10 text-signal',
  NEAR_MISS: 'bg-amber-100 text-amber-800',
  HAZARD: 'bg-sky-100 text-sky-800',
};
export const INCIDENT_STATUS_LABEL: Record<HsIncidentStatus, string> = {
  UNDER_REVIEW: 'Under review', INVESTIGATION: 'Investigation', CLOSED: 'Closed',
};
export const INCIDENT_STATUS_TONE: Record<HsIncidentStatus, string> = {
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  INVESTIGATION: 'bg-signal/10 text-signal',
  CLOSED: 'bg-slate-100 text-slate-600',
};

/** Whole days from today (UK) to a date stored as UTC midnight. Negative = past. */
export function daysFromToday(d: Date, today = isoDateUk()) {
  return Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(today)) / 86_400_000);
}

/** A yyyy-mm-dd from a date input, stored as UTC midnight. Null when blank. */
export function parseDay(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The yyyy-mm-dd a date input wants for a date stored as UTC midnight. */
export const dayInput = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

/** Reviews are flagged a month before they fall due. */
export const REVIEW_WARNING_DAYS = 30;
export type ReviewStatus = 'LIVE' | 'DUE' | 'OVERDUE' | 'ARCHIVED';
export function reviewStatus(a: { reviewDue: Date; archived: boolean }, today = isoDateUk()): ReviewStatus {
  if (a.archived) return 'ARCHIVED';
  const days = daysFromToday(a.reviewDue, today);
  if (days < 0) return 'OVERDUE';
  if (days <= REVIEW_WARNING_DAYS) return 'DUE';
  return 'LIVE';
}
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = { LIVE: 'Live', DUE: 'Review due', OVERDUE: 'Overdue', ARCHIVED: 'Archived' };
export const REVIEW_STATUS_TONE: Record<ReviewStatus, string> = {
  LIVE: 'bg-brand-100 text-forest',
  DUE: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-signal/10 text-signal',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

/** Certificates are flagged two months out, time enough to book a refresher. */
export const EXPIRY_WARNING_DAYS = 60;
export type TicketStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';
export function ticketStatus(r: { expiresOn: Date | null }, today = isoDateUk()): TicketStatus {
  if (!r.expiresOn) return 'NO_EXPIRY';
  const days = daysFromToday(r.expiresOn, today);
  if (days < 0) return 'EXPIRED';
  if (days <= EXPIRY_WARNING_DAYS) return 'EXPIRING';
  return 'VALID';
}
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { VALID: 'Valid', EXPIRING: 'Expiring soon', EXPIRED: 'Expired', NO_EXPIRY: 'No expiry' };
export const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  VALID: 'bg-brand-100 text-forest',
  EXPIRING: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-signal/10 text-signal',
  NO_EXPIRY: 'bg-slate-100 text-slate-600',
};

export type ActionStatus = 'OPEN' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETE';
export function actionStatus(a: { dueOn: Date; completedAt: Date | null }, today = isoDateUk()): ActionStatus {
  if (a.completedAt) return 'COMPLETE';
  const days = daysFromToday(a.dueOn, today);
  if (days < 0) return 'OVERDUE';
  if (days <= 7) return 'DUE_SOON';
  return 'OPEN';
}
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { OPEN: 'Open', DUE_SOON: 'Due this week', OVERDUE: 'Overdue', COMPLETE: 'Complete' };
export const ACTION_STATUS_TONE: Record<ActionStatus, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  DUE_SOON: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-signal/10 text-signal',
  COMPLETE: 'bg-brand-100 text-forest',
};

/** A small coloured status chip, the same shape everywhere in H&S. */
export const chip = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

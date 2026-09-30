'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { HsIncidentStatus, HsIncidentType } from '@prisma/client';
import { db } from '@/lib/db';
import { assertPermission, logActivity } from '@/lib/auth';
import { assertCompanyAccess, getActiveCompany } from '@/lib/company';
import { isoDateUk, ukTimeToUtc } from '@/lib/format';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL } from '@/lib/hs';
import { postedPhotoData, storeHsPhoto } from '@/lib/hsFiles';

const MAX_PHOTOS = 8;
const TYPES: HsIncidentType[] = ['INCIDENT', 'NEAR_MISS', 'HAZARD'];
const STATUSES: HsIncidentStatus[] = ['UNDER_REVIEW', 'INVESTIGATION', 'CLOSED'];

function storePhotos(photos: string[], ref: string, startAt = 0) {
  return Promise.all(photos.map((p, i) => storeHsPhoto(p, 'incidents', `${ref}-photo-${startAt + i + 1}.jpg`)));
}

/** The details every incident form shares — reporting one and editing one. */
function parseDetails(formData: FormData) {
  const type = String(formData.get('type')) as HsIncidentType;
  if (!TYPES.includes(type)) throw new Error('Choose incident, near miss or hazard.');
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '') || '12:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Enter when it happened.');
  const occurredAt = ukTimeToUtc(date, time);
  if (occurredAt.getTime() > Date.now() + 5 * 60_000) throw new Error('When it happened can\'t be in the future.');
  const description = String(formData.get('description') ?? '').trim();
  if (!description) throw new Error('Describe what happened.');
  return {
    type, occurredAt, description,
    area: String(formData.get('area') ?? '').trim(),
    injuredPerson: String(formData.get('injuredPerson') ?? '').trim(),
    injury: String(formData.get('injury') ?? '').trim(),
    immediateAction: String(formData.get('immediateAction') ?? '').trim(),
    riddor: formData.get('riddor') === 'on',
  };
}

/** INC-2026-008: the year it was reported, then a running number for that year. */
async function nextIncidentRef() {
  const prefix = `INC-${isoDateUk().slice(0, 4)}-`;
  const refs = await db.hsIncident.findMany({ where: { ref: { startsWith: prefix } }, select: { ref: true } });
  const n = Math.max(0, ...refs.map((r) => Number(r.ref.slice(prefix.length)) || 0)) + 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

export async function reportIncident(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const details = parseDetails(formData);
  const photos = postedPhotoData(formData);
  if (photos.length > MAX_PHOTOS) throw new Error(`Add up to ${MAX_PHOTOS} photos.`);
  const ref = await nextIncidentRef();
  const stored = await storePhotos(photos, ref);

  const incident = await db.hsIncident.create({
    data: {
      ...details,
      company: getActiveCompany(user),
      ref,
      reportedById: user.id,
      photos: { create: stored.map((s) => ({ fileUrl: s.url })) },
    },
  });
  await logActivity('HsIncident', incident.id, 'Reported', `${incident.ref} ${INCIDENT_TYPE_LABEL[incident.type]}: ${details.description.slice(0, 120)}`, user.id);
  revalidatePath('/hs/incidents');
  revalidatePath('/hs');
  redirect(`/hs/incidents/${incident.id}`);
}

/** Edits the details and the investigation: status, investigator, findings. */
export async function updateIncident(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const existing = await db.hsIncident.findUniqueOrThrow({ where: { id } });
  assertCompanyAccess(user, existing.company);

  const details = parseDetails(formData);
  const status = String(formData.get('status')) as HsIncidentStatus;
  if (!STATUSES.includes(status)) throw new Error('Choose a status.');
  const investigatorId = String(formData.get('investigatorId') ?? '') || null;
  const findings = String(formData.get('findings') ?? '').trim();
  if (status === 'CLOSED' && !findings) throw new Error('Write up what was found before closing it.');

  const closedAt = status === 'CLOSED' ? (existing.closedAt ?? new Date()) : null;
  await db.hsIncident.update({ where: { id }, data: { ...details, status, investigatorId, findings, closedAt } });
  const change = status !== existing.status ? `, ${INCIDENT_STATUS_LABEL[existing.status]} → ${INCIDENT_STATUS_LABEL[status]}` : '';
  await logActivity('HsIncident', id, 'Updated', `${existing.ref}${change}`, user.id);
  revalidatePath('/hs/incidents');
  revalidatePath(`/hs/incidents/${id}`);
  revalidatePath('/hs');
  redirect(`/hs/incidents/${id}`);
}

export async function addIncidentPhotos(formData: FormData) {
  const user = await assertPermission('hs.edit');
  const id = String(formData.get('id') ?? '');
  const incident = await db.hsIncident.findUniqueOrThrow({ where: { id }, include: { _count: { select: { photos: true } } } });
  assertCompanyAccess(user, incident.company);

  const photos = postedPhotoData(formData);
  if (photos.length === 0) throw new Error('Choose a photo to add.');
  if (incident._count.photos + photos.length > MAX_PHOTOS) throw new Error(`An incident can have up to ${MAX_PHOTOS} photos.`);
  const stored = await storePhotos(photos, incident.ref, incident._count.photos);
  await db.hsIncidentPhoto.createMany({ data: stored.map((s) => ({ incidentId: id, fileUrl: s.url })) });
  await logActivity('HsIncident', id, 'Photos added', `${incident.ref}, ${photos.length} photo${photos.length === 1 ? '' : 's'}`, user.id);
  revalidatePath(`/hs/incidents/${id}`);
}

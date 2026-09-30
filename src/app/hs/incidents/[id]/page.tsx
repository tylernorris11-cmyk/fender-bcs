import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { clock, shortDate } from '@/lib/format';
import { INCIDENT_STATUS_LABEL, INCIDENT_STATUS_TONE, INCIDENT_TYPE_LABEL, INCIDENT_TYPE_TONE } from '@/lib/hs';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { ActionsPanel } from '../../ActionsPanel';
import { Chip, Detail } from '../../bits';
import { AddPhotosForm } from '../AddPhotosForm';

export default async function IncidentPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const incident = await db.hsIncident.findUnique({
    where: { id: params.id },
    include: {
      reportedBy: { select: { name: true } },
      investigator: { select: { name: true } },
      photos: { orderBy: { addedAt: 'asc' } },
      actions: { include: { owner: { select: { name: true } } }, orderBy: [{ completedAt: 'asc' }, { dueOn: 'asc' }] },
    },
  });
  if (!incident || incident.company !== company) notFound();
  const people = await hsPeople(company);

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/incidents" alerts={alerts.length}>
      <Link href="/hs/incidents" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
        <ArrowLeft size={15} /> Back to incidents
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight tabular-nums">{incident.ref}</h1>
            <Chip tone={INCIDENT_TYPE_TONE[incident.type]}>{INCIDENT_TYPE_LABEL[incident.type]}</Chip>
            <Chip tone={INCIDENT_STATUS_TONE[incident.status]}>{INCIDENT_STATUS_LABEL[incident.status]}</Chip>
            {incident.riddor && <Chip tone="bg-signal text-white">RIDDOR</Chip>}
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Reported {shortDate(incident.reportedAt)}{incident.reportedBy ? ` by ${incident.reportedBy.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/hs/incidents/${incident.id}/edit`} className="btn-secondary"><Pencil size={16} /> Edit</Link>
          <Link href={`/hs/incidents/${incident.id}/print`} className="btn-secondary"><Printer size={16} /> Print report</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-2">Details</h2>
          <dl>
            <Detail label="Date">{shortDate(incident.occurredAt)}</Detail>
            <Detail label="Time">{clock(incident.occurredAt)}</Detail>
            <Detail label="Type">{INCIDENT_TYPE_LABEL[incident.type]}</Detail>
            <Detail label="Area">{incident.area}</Detail>
            <Detail label="Description"><span className="whitespace-pre-line">{incident.description}</span></Detail>
            {incident.type === 'INCIDENT' && (
              <>
                <Detail label="Who was hurt">{incident.injuredPerson}</Detail>
                <Detail label="Injury or damage">{incident.injury}</Detail>
              </>
            )}
            <Detail label="Immediate action"><span className="whitespace-pre-line">{incident.immediateAction}</span></Detail>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="card card-pad">
            <h2 className="text-lg font-bold mb-2">Investigation</h2>
            <dl>
              <Detail label="Status">{INCIDENT_STATUS_LABEL[incident.status]}{incident.closedAt ? `, ${shortDate(incident.closedAt)}` : ''}</Detail>
              <Detail label="Investigator">{incident.investigator?.name ?? ''}</Detail>
              <Detail label="Findings"><span className="whitespace-pre-line">{incident.findings}</span></Detail>
            </dl>
            {incident.status !== 'CLOSED' && (
              <Link href={`/hs/incidents/${incident.id}/edit#status`} className="inline-block text-sm font-medium text-brand-700 hover:underline mt-2">
                Update the investigation
              </Link>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="text-lg font-bold mb-3">Photos</h2>
            {incident.photos.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {incident.photos.map((p, i) => (
                  <PhotoLightbox key={p.id} src={blobFileHref(p.fileUrl)} alt={`Photo ${i + 1}`} buttonClassName="block" thumbClassName="h-24 w-24" />
                ))}
              </div>
            )}
            <AddPhotosForm incidentId={incident.id} room={8 - incident.photos.length} />
          </section>
        </div>
      </div>

      <ActionsPanel actions={incident.actions} people={people} incidentId={incident.id} canEdit userId={user.id} />
    </Shell>
  );
}

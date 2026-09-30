import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { clock, isoDateUk } from '@/lib/format';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { IncidentForm } from '../../IncidentForm';

export default async function EditIncidentPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const i = await db.hsIncident.findUnique({ where: { id: params.id } });
  if (!i || i.company !== company) notFound();
  const people = await hsPeople(company);

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/incidents" alerts={alerts.length}>
      <div className="max-w-3xl">
        <Link href={`/hs/incidents/${i.id}`} className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
          <ArrowLeft size={15} /> Back to {i.ref}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Edit {i.ref}</h1>
        <IncidentForm
          people={people}
          defaultDate={isoDateUk()}
          defaultTime={clock(new Date())}
          cancelHref={`/hs/incidents/${i.id}`}
          initial={{
            id: i.id, type: i.type, date: isoDateUk(i.occurredAt), time: clock(i.occurredAt), area: i.area,
            description: i.description, injuredPerson: i.injuredPerson, injury: i.injury, immediateAction: i.immediateAction,
            riddor: i.riddor, status: i.status, investigatorId: i.investigatorId ?? '', findings: i.findings,
          }}
        />
      </div>
    </Shell>
  );
}

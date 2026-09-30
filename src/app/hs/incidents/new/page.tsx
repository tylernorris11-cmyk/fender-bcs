import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { clock, isoDateUk } from '@/lib/format';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { IncidentForm } from '../IncidentForm';

export default async function ReportIncidentPage() {
  const user = await requirePermission('hs.edit');
  const alerts = await getAlerts(user);
  const people = await hsPeople(getActiveCompany(user));
  const now = new Date();

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/incidents" alerts={alerts.length}>
      <div className="max-w-3xl">
        <Link href="/hs/incidents" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline mb-3">
          <ArrowLeft size={15} /> Back to incidents
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Report an incident</h1>
        <IncidentForm people={people} defaultDate={isoDateUk(now)} defaultTime={clock(now)} cancelHref="/hs/incidents" />
      </div>
    </Shell>
  );
}

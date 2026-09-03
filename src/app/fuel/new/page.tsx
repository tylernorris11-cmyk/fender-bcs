import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { FuelEntryForm } from './FuelEntryForm';

export default async function NewFuelEntryPage() {
  const user = await requirePermission('fuel.create');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const assets = await db.asset.findMany({
    where: { type: 'VEHICLE', retired: false, OR: [{ company: null }, { company }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, ref: true },
  });

  return (
    <Shell user={user} module="fuel" nav={NAV.fuel} current="/fuel/new" alerts={alerts.length}>
      <Link href="/fuel" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to fuel log
      </Link>

      <PageHeader title="Add fuel entry" blurb="Readings off the yard tank meter — litres used works itself out." />

      <FuelEntryForm assets={assets} defaultDriverName={user.name} />
    </Shell>
  );
}

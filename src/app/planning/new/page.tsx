import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { ensureDriverRecords } from '@/lib/drivers';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { NewDeliveryForm } from './NewDeliveryForm';

export default async function NewDeliveryPage({ searchParams }: { searchParams: { date?: string } }) {
  const user = await requirePermission('planning.edit');
  const alerts = await getAlerts(user);
  await ensureDriverRecords();

  const [towns, drivers] = await Promise.all([
    db.town.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { name: true } }),
    db.driver.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <Shell user={user} module="planning" nav={NAV.planning} current="/planning" alerts={alerts.length}>
      <Link href="/planning" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to Deliveries
      </Link>

      <PageHeader
        title="Add a delivery"
        blurb="For the odd job that needs planning in without a full sales order — just enough to put it on the board."
      />

      <NewDeliveryForm towns={towns.map((t) => t.name)} drivers={drivers} defaultDate={searchParams.date} />
    </Shell>
  );
}

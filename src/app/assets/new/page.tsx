import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { NewAssetForm } from './NewAssetForm';

export default async function NewAssetPage() {
  const user = await requirePermission('assets.edit');
  const alerts = await getAlerts(user);

  const locations = await db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return (
    <Shell user={user} module="assets" nav={NAV.assets} current="/assets" alerts={alerts.length}>
      <Link href="/assets" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to assets
      </Link>

      <PageHeader title="Add a vehicle or machine" blurb="Give it a reference number automatically — fill in statutory dates now or log them later." />

      <NewAssetForm locations={locations.map((l) => l.name)} />
    </Shell>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { NewCheckForm } from './NewCheckForm';

export default async function NewCheckPage({ searchParams }: { searchParams: { assetId?: string } }) {
  const user = await requirePermission('checks.create');
  const alerts = await getAlerts(user);

  const assets = await db.asset.findMany({
    where: { retired: false },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, ref: true, type: true,
      checklistItems: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { label: true } },
    },
  });

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks/new" alerts={alerts.length}>
      <Link href="/checks" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to checks
      </Link>

      <PageHeader title="Run a check" blurb="Saved with your name and the time, so it's there to look back on." />

      <NewCheckForm assets={assets} initialAssetId={searchParams.assetId} />
    </Shell>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { CurrentJobView } from '../../CurrentJobView';

/**
 * One job's own page — add rows, finish for today, finish the job. Reached
 * by clicking a job from /production rather than every open job showing in
 * full there, which on BCS (where a job is shared and everyone's open jobs
 * all show up) could mean a lot of jobs' worth of rows on one page.
 */
export default async function ProductionJobPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);

  const job = await db.productionJob.findUnique({
    where: { id: params.id },
    include: { rows: { orderBy: { sortOrder: 'asc' } }, order: true, user: true },
  });
  if (!job) notFound();
  if (!user.companies.includes(job.company)) notFound();

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production" alerts={alerts.length}>
      <Link href="/production" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to production
      </Link>
      <CurrentJobView job={job} viewerId={user.id} />
    </Shell>
  );
}

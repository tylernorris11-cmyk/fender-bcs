import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { resolveAssetCheck } from '../../actions';

export default async function ResolveCheckPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('checks.create');
  const alerts = await getAlerts(user);

  const check = await db.assetCheck.findUnique({
    where: { id: params.id },
    include: { asset: true, items: true },
  });
  if (!check) notFound();
  if (check.asset.company && !user.companies.includes(check.asset.company)) notFound();
  if (check.result !== 'FAIL' || check.resolved) redirect(`/checks/${check.id}`);

  const failedItems = check.items.filter((i) => !i.ok);

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks" alerts={alerts.length}>
      <Link href={`/checks/${check.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to check
      </Link>

      <PageHeader
        title={`Resolve — ${check.asset.name}`}
        blurb={`${check.asset.ref} · flagged ${shortDate(check.performedAt)} at ${clock(check.performedAt)}`}
      />

      {(failedItems.length > 0 || check.notes) && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">What was flagged</h2>
          <ul className="text-sm space-y-2">
            {failedItems.map((i) => (
              <li key={i.id}>
                <span className="font-medium">{i.label}</span>
                {i.note && <span className="text-ink-muted"> — {i.note}</span>}
              </li>
            ))}
          </ul>
          {check.notes && <p className="text-sm mt-3">{check.notes}</p>}
        </section>
      )}

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-3">What was done</h2>
        <form action={resolveAssetCheck} className="space-y-3">
          <input type="hidden" name="checkId" value={check.id} />
          <textarea
            name="resolutionNote"
            required
            rows={4}
            className="input w-full"
            placeholder="e.g. Replaced faulty tail light bulb"
            aria-label="What was done to fix it"
          />
          <div className="flex gap-2">
            <button className="btn-primary">Mark resolved</button>
            <Link href={`/checks/${check.id}`} className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </section>
    </Shell>
  );
}

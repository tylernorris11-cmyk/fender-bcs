import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { resolveAssetCheckItems } from '../../actions';

export default async function ResolveCheckPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('checks.create');
  const alerts = await getAlerts(user);

  const check = await db.assetCheck.findUnique({
    where: { id: params.id },
    include: { asset: true, items: true },
  });
  if (!check) notFound();
  if (check.asset.company && !user.companies.includes(check.asset.company)) notFound();

  const failedItems = check.items.filter((i) => !i.ok);
  const openItems = failedItems.filter((i) => !i.resolved);
  const fixedItems = failedItems.filter((i) => i.resolved);
  if (check.result !== 'FAIL' || openItems.length === 0) redirect(`/checks/${check.id}`);

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks" alerts={alerts.length}>
      <Link href={`/checks/${check.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to check
      </Link>

      <PageHeader
        title={`Resolve — ${check.asset.name}`}
        blurb={`${check.asset.ref} · flagged ${shortDate(check.performedAt)} at ${clock(check.performedAt)}`}
      />

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-1">What was fixed?</h2>
        <p className="text-sm text-ink-muted mb-4">Tick off whatever's actually done — leave the rest unticked and it'll stay flagged.</p>
        <form action={resolveAssetCheckItems} className="space-y-4">
          <input type="hidden" name="checkId" value={check.id} />
          <ul className="divide-y divide-hairline">
            {openItems.map((i) => (
              <li key={i.id} className="py-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name={`fixed_${i.id}`} value="1" className="mt-1 h-4 w-4" />
                  <span className="flex-1">
                    <span className="font-medium">{i.label}</span>
                    {i.note && <span className="text-ink-muted"> — {i.note}</span>}
                    <input
                      name={`note_${i.id}`}
                      className="input w-full mt-2"
                      placeholder="What was done (optional)"
                      aria-label={`What was done to fix ${i.label}`}
                    />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {check.notes && <p className="text-sm text-ink-muted">Overall notes on the check: {check.notes}</p>}
          <button className="btn-primary">Save</button>
        </form>
      </section>

      {fixedItems.length > 0 && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Already fixed</h2>
          <ul className="text-sm divide-y divide-hairline">
            {fixedItems.map((i) => (
              <li key={i.id} className="py-3">
                <span className="font-medium">{i.label}</span>
                {i.resolutionNote && <p className="text-ink-muted mt-0.5">{i.resolutionNote}</p>}
                <p className="text-xs text-ink-faint mt-0.5">
                  {i.resolvedAt ? `${shortDate(i.resolvedAt)} ${clock(i.resolvedAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill } from '@/components/ui';
import { PhotoLightbox } from '@/components/PhotoLightbox';

export default async function CheckDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('checks.view');
  const alerts = await getAlerts(user);

  const check = await db.assetCheck.findUnique({
    where: { id: params.id },
    include: { asset: true, user: true, resolvedBy: true, items: true },
  });
  if (!check) notFound();
  if (check.asset.company && !user.companies.includes(check.asset.company)) notFound();

  const needsResolving = check.result === 'FAIL' && !check.resolved;
  const resultPill = <Pill tone={check.result === 'PASS' || check.resolved ? 'good' : 'bad'}>{check.result === 'PASS' ? 'Pass' : check.resolved ? 'Resolved' : 'Issue flagged'}</Pill>;

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks" alerts={alerts.length}>
      <Link href="/checks" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to check history
      </Link>

      <PageHeader
        title={check.asset.name}
        blurb={`${check.asset.ref} · ${shortDate(check.performedAt)} at ${clock(check.performedAt)}${check.user ? ` · ${check.user.name}` : ''}`}
        actions={(
          <>
            <a href={`/checks/${check.id}/print`} className="btn-secondary"><Printer size={16} /> Print</a>
            {needsResolving && can(user, 'checks.create')
              ? <Link href={`/checks/${check.id}/resolve`} className="hover:opacity-80">{resultPill}</Link>
              : resultPill}
          </>
        )}
      />

      {check.resolved && (
        <section className="card card-pad mb-6 border-2 border-brand/30">
          <h2 className="text-lg font-bold mb-2">Resolved</h2>
          <p className="text-sm">{check.resolutionNote}</p>
          <p className="text-xs text-ink-faint mt-2">
            {check.resolvedBy?.name ?? 'Unknown'} · {check.resolvedAt ? `${shortDate(check.resolvedAt)} ${clock(check.resolvedAt)}` : ''}
          </p>
        </section>
      )}

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Checklist</h2>
        <ul className="divide-y divide-hairline">
          {check.items.map((i) => (
            <li key={i.id} className="py-4 flex flex-wrap gap-4">
              <div
                className={`h-6 w-6 shrink-0 rounded-md border-2 grid place-items-center font-bold text-xs ${
                  i.ok ? 'bg-brand border-brand text-white' : 'bg-signal/10 border-signal text-signal'
                }`}
                aria-hidden
              >
                {i.ok ? '✓' : '!'}
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium">{i.label}</p>
                {i.note && <p className="text-sm text-ink-muted mt-0.5">{i.note}</p>}
                {!i.ok && !i.note && <p className="text-sm text-ink-faint mt-0.5">Not confirmed — no note left.</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(check.notes || check.photo) && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-2">Overall notes</h2>
          {check.notes && <p className="text-sm">{check.notes}</p>}
          {check.photo && <PhotoLightbox src={check.photo} alt="Photo attached to this check" />}
        </section>
      )}

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-3">Logged by</h2>
        {check.user ? (
          <span className="flex items-center gap-2.5">
            <Avatar name={check.user.name} colour={check.user.colour} size={30} />
            <span className="text-sm font-medium">{check.user.name}</span>
          </span>
        ) : (
          <p className="text-sm text-ink-muted">Unknown</p>
        )}
      </section>
    </Shell>
  );
}

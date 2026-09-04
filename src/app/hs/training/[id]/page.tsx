import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate, clock } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { acknowledgeTraining } from '../../actions';

export default async function TrainingModulePage({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);

  const trainingModule = await db.trainingModule.findUnique({ where: { id: params.id } });
  if (!trainingModule || !trainingModule.active) notFound();
  if (trainingModule.company && !user.companies.includes(trainingModule.company)) notFound();

  const completion = await db.trainingCompletion.findUnique({
    where: { userId_moduleId: { userId: user.id, moduleId: trainingModule.id } },
  });

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/training" alerts={alerts.length}>
      <PageHeader
        title={trainingModule.title}
        blurb={trainingModule.machineName ? `Machine-specific — ${trainingModule.machineName}` : undefined}
      />

      {trainingModule.summary && <p className="text-ink-muted mb-6">{trainingModule.summary}</p>}

      <section className="card card-pad mb-6">
        <ul className="list-disc pl-5 space-y-2">
          {trainingModule.content.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </section>

      {trainingModule.category === 'MACHINE' && (
        <div className="banner-warn mb-6 items-start">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            <strong>This supplements, not replaces, the manufacturer&apos;s manual.</strong> Operating this machine
            also requires a site-specific risk assessment signed off by a competent health and safety person, and
            any legally required certified training, before working unsupervised.
          </span>
        </div>
      )}

      <section className="card card-pad">
        {completion ? (
          <>
            <p className="flex items-center gap-2 font-semibold text-forest mb-4">
              <CheckCircle2 size={18} aria-hidden /> Completed {shortDate(completion.completedAt)} {clock(completion.completedAt)}
            </p>
            <form action={acknowledgeTraining}>
              <input type="hidden" name="moduleId" value={trainingModule.id} />
              <button className="btn-secondary">Confirm I&apos;ve read this again</button>
            </form>
          </>
        ) : (
          <form action={acknowledgeTraining} className="flex items-center gap-4">
            <input type="hidden" name="moduleId" value={trainingModule.id} />
            <button className="btn-primary">I have read and understood this</button>
          </form>
        )}
      </section>
    </Shell>
  );
}

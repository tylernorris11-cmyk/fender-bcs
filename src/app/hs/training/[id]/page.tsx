import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Factory, HardHat, ShieldCheck } from 'lucide-react';
import type { TrainingCategory } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate, clock } from '@/lib/format';
import { iconForTrainingLine, splitTrainingLine } from '@/lib/trainingIcons';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { acknowledgeTraining } from '../../actions';

const CATEGORY_HERO: Record<TrainingCategory, { icon: typeof HardHat; tone: string }> = {
  GENERAL: { icon: HardHat, tone: 'bg-forest text-white' },
  PPE: { icon: ShieldCheck, tone: 'bg-teal-600 text-white' },
  MACHINE: { icon: Factory, tone: 'bg-violet-600 text-white' },
};

export default async function TrainingModulePage({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);

  const trainingModule = await db.trainingModule.findUnique({ where: { id: params.id } });
  if (!trainingModule || !trainingModule.active) notFound();
  if (trainingModule.company && !user.companies.includes(trainingModule.company)) notFound();

  const completion = await db.trainingCompletion.findUnique({
    where: { userId_moduleId: { userId: user.id, moduleId: trainingModule.id } },
  });

  const hero = CATEGORY_HERO[trainingModule.category];
  const HeroIcon = hero.icon;

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/training" alerts={alerts.length}>
      <PageHeader title={trainingModule.title} />

      <div className="card overflow-hidden mb-6">
        <div className={`${hero.tone} px-6 py-8 flex items-center gap-5`}>
          <span className="inline-grid place-items-center h-16 w-16 rounded-2xl bg-white/15 shrink-0">
            <HeroIcon size={32} aria-hidden />
          </span>
          <div>
            {trainingModule.machineName && (
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
                Machine-specific — {trainingModule.machineName}
              </p>
            )}
            {trainingModule.summary && <p className="text-white/90 leading-snug">{trainingModule.summary}</p>}
          </div>
        </div>

        <ul className="divide-y divide-hairline">
          {trainingModule.content.map((line, i) => {
            const { heading, body } = splitTrainingLine(line);
            const { icon: Icon, tone, warning } = iconForTrainingLine(line, heading);
            return (
              <li key={i} className={`flex items-start gap-4 px-6 py-4 ${warning ? 'bg-signal/5' : ''}`}>
                <span className={`inline-grid place-items-center h-10 w-10 rounded-xl shrink-0 ${tone}`} aria-hidden>
                  <Icon size={18} />
                </span>
                <p className="text-sm leading-relaxed pt-1.5">
                  {heading && <span className="font-semibold text-ink">{heading}: </span>}
                  <span className={warning ? 'text-signal' : 'text-ink-muted'}>{body}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>

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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Factory, HardHat, Printer, ShieldCheck } from 'lucide-react';
import type { TrainingCategory, TrainingCompletion } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate, clock } from '@/lib/format';
import { iconForTrainingLine, splitTrainingLine } from '@/lib/trainingIcons';
import { isStructuredTraining, parseTrainingContent } from '@/lib/trainingContent';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { acknowledgeTraining } from '../../actions';
import { TrainingBlockView } from '../TrainingBlocks';

const CATEGORY_HERO: Record<TrainingCategory, { icon: typeof HardHat; tone: string }> = {
  GENERAL: { icon: HardHat, tone: 'bg-forest text-white' },
  PPE: { icon: ShieldCheck, tone: 'bg-teal-600 text-white' },
  MACHINE: { icon: Factory, tone: 'bg-violet-600 text-white' },
};

const Completed = ({ completion }: { completion: TrainingCompletion }) => (
  <p className="flex items-center gap-2 font-semibold text-forest">
    <CheckCircle2 size={18} aria-hidden /> Completed {shortDate(completion.completedAt)} {clock(completion.completedAt)}
  </p>
);

/** The declaration points, each to tick before the module can be completed. */
function DeclarationForm({ moduleId, points, completion }: { moduleId: string; points: string[]; completion: TrainingCompletion | null }) {
  return (
    <form action={acknowledgeTraining} className="space-y-3">
      <input type="hidden" name="moduleId" value={moduleId} />
      <ul className="space-y-2">
        {points.map((p, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 rounded-xl border border-hairline px-4 py-3 cursor-pointer transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-50">
              <input type="checkbox" name="declaration" value={i} required className="h-5 w-5 mt-0.5 accent-brand shrink-0" />
              <span className="text-sm">{p}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <SubmitButton pendingLabel="Saving…" className={completion ? 'btn-secondary' : 'btn-primary'}>
          {completion ? 'Confirm it again' : 'I confirm — complete my induction'}
        </SubmitButton>
        {completion && <Completed completion={completion} />}
      </div>
    </form>
  );
}

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
  const structured = isStructuredTraining(trainingModule.content);
  const parsed = structured ? parseTrainingContent(trainingModule.content) : null;
  const hasDeclaration = !!parsed?.declarations.length;

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/training" alerts={alerts.length}>
      <PageHeader
        title={trainingModule.title}
        actions={<Link href={`/hs/training/${trainingModule.id}/print`} className="btn-secondary"><Printer size={16} /> Print</Link>}
      />

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

        {parsed ? (
          <nav className="px-6 py-5" aria-label="Contents">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Contents</p>
            <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {parsed.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#s${i + 1}`} className="flex gap-2 text-sm py-0.5 hover:text-brand-700">
                    <span className="text-ink-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span> {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
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
        )}
      </div>

      {parsed && (
        <div className="space-y-6 mb-6">
          {parsed.intro.length > 0 && <div className="space-y-4">{parsed.intro.map((b, i) => <TrainingBlockView key={i} block={b} />)}</div>}
          {parsed.sections.map((s, i) => {
            const declarationHere = parsed.declarationSection === i;
            const before = declarationHere ? s.blocks.slice(0, parsed.declarationAt) : s.blocks;
            const after = declarationHere ? s.blocks.slice(parsed.declarationAt) : [];
            return (
              <section key={i} id={`s${i + 1}`} className="card overflow-hidden scroll-mt-4">
                <header className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-hairline">
                  <span className="grid place-items-center h-11 w-11 rounded-xl bg-forest text-white font-bold tabular-nums shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{s.title}</h2>
                    {s.subtitle && <p className="text-sm text-ink-muted mt-0.5">{s.subtitle}</p>}
                  </div>
                </header>
                <div className="px-6 py-5 space-y-4">
                  {before.map((b, j) => <TrainingBlockView key={j} block={b} />)}
                  {declarationHere && <DeclarationForm moduleId={trainingModule.id} points={parsed.declarations} completion={completion} />}
                  {after.map((b, j) => <TrainingBlockView key={`a${j}`} block={b} />)}
                </div>
              </section>
            );
          })}
          {hasDeclaration && parsed.declarationSection == null && (
            <section className="card card-pad">
              <DeclarationForm moduleId={trainingModule.id} points={parsed.declarations} completion={completion} />
            </section>
          )}
        </div>
      )}

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

      {!hasDeclaration && (
        <section className="card card-pad">
          {completion ? (
            <>
              <div className="mb-4"><Completed completion={completion} /></div>
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
      )}
    </Shell>
  );
}

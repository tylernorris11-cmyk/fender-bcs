import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { shortDate } from '@/lib/format';
import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE, ticketStatus } from '@/lib/hs';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';
import { Chip, dayLabel } from '../bits';

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: 'Yard induction',
  PPE: 'Personal protective equipment',
  MACHINE: 'Machine-specific',
};

export default async function MyTrainingPage() {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [modules, completions, assignments, tickets] = await Promise.all([
    db.trainingModule.findMany({
      where: { active: true, OR: [{ company: null }, { company }] },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    }),
    db.trainingCompletion.findMany({ where: { userId: user.id }, select: { moduleId: true, completedAt: true } }),
    db.userTrainingAssignment.findMany({ where: { userId: user.id }, select: { moduleId: true } }),
    db.hsTrainingRecord.findMany({ where: { userId: user.id }, orderBy: { course: 'asc' } }),
  ]);

  const completedAt = new Map(completions.map((c) => [c.moduleId, c.completedAt]));
  const assignedIds = new Set(assignments.map((a) => a.moduleId));

  const byCategory = new Map<string, typeof modules>();
  for (const m of modules) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, []);
    byCategory.get(m.category)!.push(m);
  }

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/training" alerts={alerts.length}>
      <PageHeader title="My training" blurb="Yard induction, PPE and machine-specific training, and the tickets you hold." />

      <div className="banner-warn mb-6 items-start">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          <strong>This content is a supplement, not a substitute.</strong> It does not replace a manufacturer&apos;s
          operating manual, a site-specific risk assessment signed off by a competent person, or any legally required
          certified training.
        </span>
      </div>

      {tickets.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">My tickets and certificates</h2>
          <ul className="divide-y divide-hairline">
            {tickets.map((t) => {
              const status = ticketStatus(t);
              return (
                <li key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                  <p className="flex-1 min-w-[180px] font-semibold">
                    {t.course}
                    {t.certificateUrl && (
                      <a href={blobFileHref(t.certificateUrl)} target="_blank" rel="noreferrer" className="inline-block ml-2 text-sm font-medium text-brand-700 hover:underline">
                        <FileText size={13} className="inline -mt-0.5" /> Certificate
                      </a>
                    )}
                  </p>
                  <span className="text-sm text-ink-muted">{t.expiresOn ? `Expires ${dayLabel(t.expiresOn)}` : 'Doesn\'t expire'}</span>
                  <Chip tone={TICKET_STATUS_TONE[status]}>{TICKET_STATUS_LABEL[status]}</Chip>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {modules.length === 0 ? <Empty title="No training modules set up yet." /> : (
        <div className="space-y-6">
          {['GENERAL', 'PPE', 'MACHINE'].map((category) => {
            const items = byCategory.get(category);
            if (!items || items.length === 0) return null;
            return (
              <section key={category} className="card card-pad">
                <h2 className="text-lg font-bold mb-4">{CATEGORY_LABEL[category]}</h2>
                <ul className="divide-y divide-hairline">
                  {items.map((m) => {
                    const required = m.category !== 'MACHINE' || assignedIds.has(m.id);
                    const done = completedAt.get(m.id);
                    return (
                      <li key={m.id}>
                        <Link href={`/hs/training/${m.id}`} className="py-3 flex items-center gap-4 hover:opacity-80">
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-semibold">{m.title}{m.machineName && ` — ${m.machineName}`}</p>
                            {m.summary && <p className="text-sm text-ink-muted mt-0.5">{m.summary}</p>}
                          </div>
                          {done ? (
                            <Pill tone="good"><CheckCircle2 size={12} className="inline -mt-0.5 mr-1" aria-hidden />Complete · {shortDate(done)}</Pill>
                          ) : required ? (
                            <Pill tone="warn">Required — incomplete</Pill>
                          ) : (
                            <Pill tone="neutral">Not required for you</Pill>
                          )}
                          <ChevronRight size={16} className="text-ink-faint shrink-0" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

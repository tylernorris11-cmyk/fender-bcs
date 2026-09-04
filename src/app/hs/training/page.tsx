import Link from 'next/link';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: 'Yard induction',
  PPE: 'Personal protective equipment',
  MACHINE: 'Machine-specific',
};

export default async function MyTrainingPage() {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [modules, completions, assignments] = await Promise.all([
    db.trainingModule.findMany({
      where: { active: true, OR: [{ company: null }, { company }] },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    }),
    db.trainingCompletion.findMany({ where: { userId: user.id }, select: { moduleId: true, completedAt: true } }),
    db.userTrainingAssignment.findMany({ where: { userId: user.id }, select: { moduleId: true } }),
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
      <PageHeader title="My training" blurb="Yard induction, PPE and machine-specific training." />

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

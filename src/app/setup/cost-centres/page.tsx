import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { addCostCentre, toggleCostCentre } from '../actions';

export default async function CostCentresPage() {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="setup" nav={NAV.setup} current="/setup/cost-centres" alerts={alerts.length}>
        <PageHeader title="Cost centres" />
        <div className="banner-warn">
          Cost centres are a BCS Products thing — switch to BCS Products up top to manage them.
        </div>
      </Shell>
    );
  }

  const costCentres = await db.costCentre.findMany({ where: { company }, orderBy: { name: 'asc' } });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/cost-centres" alerts={alerts.length}>
      <PageHeader title="Cost centres" blurb="Which internal budget a purchase order's spend gets tracked against." />
      <section className="card card-pad max-w-2xl">
        <ul className="divide-y divide-hairline mb-5">
          {costCentres.map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-3">
              <span className="font-semibold">{c.name}</span>
              <form action={toggleCostCentre} className="ml-auto flex items-center gap-2">
                <input type="hidden" name="costCentreId" value={c.id} />
                <Pill tone={c.active ? 'good' : 'neutral'}>{c.active ? 'In use' : 'Hidden'}</Pill>
                <button className="text-xs text-ink-faint hover:text-ink underline">{c.active ? 'hide' : 'use'}</button>
              </form>
            </li>
          ))}
          {costCentres.length === 0 && <li className="py-3 text-ink-muted">No cost centres yet.</li>}
        </ul>
        <form action={addCostCentre} className="flex flex-wrap gap-2">
          <input name="name" required className="input flex-1 min-w-[180px]" placeholder="e.g. BS Supplies" aria-label="Cost centre name" />
          <button className="btn-primary">Add</button>
        </form>
      </section>
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortSelect } from '@/components/ui';
import { addTown, toggleTown } from '../actions';

export default async function TownsPage({ searchParams }: { searchParams: { sort?: string } }) {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  const towns = await db.town.findMany({
    orderBy: searchParams.sort === 'region' ? { region: 'asc' } : { name: 'asc' },
  });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/towns" alerts={alerts.length}>
      <PageHeader title="Towns & cities" blurb="The delivery areas Planning groups runs by." />
      <section className="card card-pad max-w-2xl">
        <form className="flex justify-end gap-2 mb-3">
          <SortSelect value={searchParams.sort} options={[{ value: 'name', label: 'Name A-Z' }, { value: 'region', label: 'Region' }]} />
          <button className="btn-secondary btn-sm">Apply</button>
        </form>
        <ul className="divide-y divide-hairline mb-5">
          {towns.map((t) => (
            <li key={t.id} className="py-2 flex items-center gap-3">
              <span className="font-semibold">{t.name}</span>
              <span className="text-sm text-ink-muted">{t.region}</span>
              <form action={toggleTown} className="ml-auto flex items-center gap-2">
                <input type="hidden" name="townId" value={t.id} />
                <Pill tone={t.active ? 'good' : 'neutral'}>{t.active ? 'In use' : 'Hidden'}</Pill>
                <button className="text-xs text-ink-faint hover:text-ink underline">{t.active ? 'hide' : 'use'}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addTown} className="flex flex-wrap gap-2">
          <input name="name" required className="input flex-1 min-w-[180px]" placeholder="Town or city" aria-label="Town name" />
          <input name="region" className="input w-44" placeholder="Region" aria-label="Region" />
          <button className="btn-primary">Add</button>
        </form>
      </section>
    </Shell>
  );
}

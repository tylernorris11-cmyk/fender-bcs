import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { addLocation, setLocationCode, toggleLocation } from '../actions';

export default async function LocationsPage() {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  const locations = await db.location.findMany({ orderBy: { name: 'asc' } });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/locations" alerts={alerts.length}>
      <PageHeader
        title="Locations"
        blurb="Our own depots, shared by both companies since it's the same yard and the same lorries. Each has Exchequer's short location code."
      />
      <section className="card card-pad max-w-2xl">
        <ul className="divide-y divide-hairline mb-5">
          {locations.map((l) => (
            <li key={l.id} className="py-2 flex flex-wrap items-center gap-3">
              <form action={setLocationCode} className="flex items-center gap-2">
                <input type="hidden" name="locationId" value={l.id} />
                <input name="code" defaultValue={l.code ?? ''} maxLength={3} aria-label={`Code for ${l.name}`}
                       className="input w-20 py-1.5 font-mono uppercase" placeholder="—" />
                <button className="text-xs text-ink-faint hover:text-ink underline">save</button>
              </form>
              <span className="font-semibold">{l.name}</span>
              <form action={toggleLocation} className="ml-auto flex items-center gap-2">
                <input type="hidden" name="locationId" value={l.id} />
                <Pill tone={l.active ? 'good' : 'neutral'}>{l.active ? 'In use' : 'Hidden'}</Pill>
                <button className="text-xs text-ink-faint hover:text-ink underline">{l.active ? 'hide' : 'use'}</button>
              </form>
            </li>
          ))}
          {locations.length === 0 && <li className="py-3 text-ink-muted">No locations yet.</li>}
        </ul>
        <form action={addLocation} className="flex flex-wrap gap-2">
          <input name="code" maxLength={3} className="input w-20 font-mono uppercase" placeholder="HOU" aria-label="Location code" />
          <input name="name" required className="input flex-1 min-w-[180px]" placeholder="e.g. Houghton le Spring" aria-label="Location name" />
          <button className="btn-primary">Add</button>
        </form>
      </section>
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, Table } from '@/components/ui';
import { addDriver } from '../actions';

export default async function DriversPage() {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  const drivers = await db.driver.findMany({ orderBy: { name: 'asc' } });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/drivers" alerts={alerts.length}>
      <PageHeader title="Drivers" blurb="Who can be put on a run, and when their Driver CPC runs out." />

      <section className="card card-pad mb-6">
        <Table head={<><th className="th">Driver</th><th className="th">Phone</th><th className="th">Licence</th><th className="th">Depot</th><th className="th">CPC expiry</th></>}>
          {drivers.map((d) => {
            const days = d.cpcExpiry ? daysUntil(d.cpcExpiry)! : null;
            return (
              <tr key={d.id} className="row">
                <td className="td font-semibold">{d.name}</td>
                <td className="td text-ink-muted">{d.phone}</td>
                <td className="td text-ink-muted">{d.licence}</td>
                <td className="td text-ink-muted">{d.depot}</td>
                <td className="td">
                  {days === null ? '—'
                    : days < 0 ? <Pill tone="bad">Expired {shortDate(d.cpcExpiry)}</Pill>
                    : days <= 60 ? <Pill tone="warn">{shortDate(d.cpcExpiry)} · {days}d</Pill>
                    : shortDate(d.cpcExpiry)}
                </td>
              </tr>
            );
          })}
          {drivers.length === 0 && <tr><td colSpan={5} className="td text-ink-muted">No drivers on the list.</td></tr>}
        </Table>
      </section>

      <section className="card card-pad max-w-2xl">
        <h2 className="text-lg font-bold mb-4">Add a driver</h2>
        <form action={addDriver} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" /></div>
          <div><label className="label" htmlFor="licence">Licence number</label><input id="licence" name="licence" className="input" /></div>
          <div><label className="label" htmlFor="depot">Depot</label><input id="depot" name="depot" defaultValue="Scunthorpe" className="input" /></div>
          <div><label className="label" htmlFor="cpcExpiry">CPC expiry</label><input id="cpcExpiry" name="cpcExpiry" type="date" className="input" /></div>
          <div className="flex items-end"><button className="btn-primary">Add driver</button></div>
        </form>
      </section>
    </Shell>
  );
}

import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { daysUntil, shortDate } from '@/lib/format';
import { ensureDriverRecords } from '@/lib/drivers';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortTh, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addDriver, addUserAsDriver, removeDriver, updateDriverCpcExpiry } from '../actions';

export default async function DriversPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  await ensureDriverRecords();
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const [drivers, eligibleUsers] = await Promise.all([
    db.driver.findMany({ orderBy: { name: searchParams.sort === 'name' ? dir : 'asc' } }),
    // Anyone active who isn't already on the register — ensureDriverRecords
    // above already covers everyone with the Driver role, so this is really
    // for someone who occasionally runs a delivery without being one by role.
    db.user.findMany({ where: { active: true, driver: null }, select: { id: true, name: true, jobTitle: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/drivers" alerts={alerts.length}>
      <PageHeader title="Drivers" blurb="Who can be put on a run, and when their Driver CPC runs out." />

      <section className="card card-pad mb-6">
        <Table head={<>
          <SortTh label="Driver" field="name" basePath="/setup/drivers" searchParams={searchParams} />
          <th className="th">Licence</th>
          <th className="th">CPC expiry</th><th className="th sr-only">Remove</th>
        </>}>
          {drivers.map((d) => {
            const days = d.cpcExpiry ? daysUntil(d.cpcExpiry)! : null;
            const incomplete = d.userId && (!d.licence || !d.cpcExpiry);
            return (
              <tr key={d.id} className="row">
                <td className="td font-semibold">
                  <span className="inline-flex items-center gap-1.5" title={incomplete ? 'Added from their user account — details not on file yet' : undefined}>
                    {d.name}
                    {incomplete && <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden />}
                  </span>
                  {incomplete && <span className="block text-[11px] font-normal text-amber-600">Not on file yet</span>}
                </td>
                <td className="td text-ink-muted">{d.licence}</td>
                <td className="td">
                  <form action={updateDriverCpcExpiry} className="flex items-center gap-2">
                    <input type="hidden" name="driverId" value={d.id} />
                    <input
                      type="date" name="cpcExpiry" defaultValue={d.cpcExpiry ? d.cpcExpiry.toISOString().slice(0, 10) : ''}
                      className="input py-1.5 w-40" aria-label={`CPC expiry for ${d.name}`}
                    />
                    <button type="submit" className="btn-secondary btn-sm">Save</button>
                  </form>
                  {days !== null && (
                    <span className="block mt-1">
                      {days < 0 ? <Pill tone="bad">Expired {shortDate(d.cpcExpiry)}</Pill>
                        : days <= 60 ? <Pill tone="warn">{days} day{days === 1 ? '' : 's'} left</Pill>
                        : null}
                    </span>
                  )}
                </td>
                <td className="td">
                  <form action={removeDriver}>
                    <input type="hidden" name="driverId" value={d.id} />
                    <button type="submit" className="text-xs text-ink-faint hover:text-signal underline" title={d.userId ? 'Comes back automatically if they still have the Driver role' : undefined}>
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          {drivers.length === 0 && <tr><td colSpan={4} className="td text-ink-muted">No drivers on the list.</td></tr>}
        </Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Add a user as a driver</h2>
          <p className="text-sm text-ink-muted mb-4">For someone already in the system who occasionally runs a delivery.</p>
          {eligibleUsers.length === 0 ? (
            <p className="text-sm text-ink-muted">Everyone active is already on the register.</p>
          ) : (
            <form action={addUserAsDriver} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="label" htmlFor="userId">Person</label>
                <select id="userId" name="userId" required className="input">
                  <option value="">Choose someone…</option>
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}{u.jobTitle ? ` — ${u.jobTitle}` : ''}</option>
                  ))}
                </select>
              </div>
              <SubmitButton pendingLabel="Adding…">Add to Drivers</SubmitButton>
            </form>
          )}
          <p className="hint mt-3">Their licence and CPC expiry start blank — fill those in above once they&apos;re added, or they&apos;ll be prompted for their CPC expiry themselves next time they sign in.</p>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Add a driver</h2>
          <p className="text-sm text-ink-muted mb-4">For someone with no account here — an agency or subcontracted driver.</p>
          <form action={addDriver} className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
            <div><label className="label" htmlFor="licence">Licence number</label><input id="licence" name="licence" className="input" /></div>
            <div><label className="label" htmlFor="cpcExpiry">CPC expiry</label><input id="cpcExpiry" name="cpcExpiry" type="date" className="input" /></div>
            <div className="flex items-end"><button className="btn-primary">Add driver</button></div>
          </form>
        </section>
      </div>
    </Shell>
  );
}

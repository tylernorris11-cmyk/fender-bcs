import type { Role } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { PERMISSIONS, ROLE_BLURBS, ROLE_LABELS } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill, Table } from '@/components/ui';
import { createUser, resetPassword, toggleUserActive, updateUserRole } from '../actions';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default async function UsersPage() {
  const user = await requirePermission('setup.users');
  const alerts = await getAlerts(user);
  const users = await db.user.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/users" alerts={alerts.length}>
      <PageHeader title="Users & roles" blurb="Who can get in, and what each of them can reach." />

      <section className="card card-pad mb-6">
        <Table head={<>
          <th className="th">Person</th><th className="th">Role</th><th className="th">Last signed in</th>
          <th className="th">Status</th><th className="th sr-only">Reset password</th>
        </>}>
          {users.map((u) => (
            <tr key={u.id} className="row">
              <td className="td">
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} colour={u.colour} size={34} />
                  <span>
                    <span className="block font-semibold">{u.name}</span>
                    <span className="block text-xs text-ink-faint">{u.email}{u.jobTitle && ` · ${u.jobTitle}`}</span>
                  </span>
                </span>
              </td>
              <td className="td">
                <form action={updateUserRole} className="flex gap-2 items-center">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className="input w-44 py-1.5" aria-label={`Role for ${u.name}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button className="btn-secondary btn-sm">Save</button>
                </form>
              </td>
              <td className="td text-ink-muted whitespace-nowrap">{u.lastLoginAt ? shortDate(u.lastLoginAt) : 'Never'}</td>
              <td className="td">
                <form action={toggleUserActive} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  {u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>}
                  <button className="text-xs text-ink-faint hover:text-ink underline">
                    {u.active ? 'suspend' : 'reactivate'}
                  </button>
                </form>
              </td>
              <td className="td">
                <form action={resetPassword} className="flex gap-2 justify-end">
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="password" type="text" className="input w-44 py-1.5" placeholder="New password"
                         aria-label={`New password for ${u.name}`} />
                  <button className="btn-secondary btn-sm">Reset</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Add someone</h2>
          <form action={createUser} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" placeholder="name@fendersteel.co.uk" />
            </div>
            <div>
              <label className="label" htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" name="jobTitle" className="input" placeholder="Yard manager" />
            </div>
            <div>
              <label className="label" htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="YARD" className="input">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="password">Starting password</label>
              <input id="password" name="password" type="text" required className="input" />
              <p className="hint">At least ten characters with a number. They will be asked to change it.</p>
            </div>
            <div><button className="btn-primary">Create account</button></div>
          </form>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">What each role can reach</h2>
          <ul className="space-y-4 text-sm">
            {ROLES.map((r) => (
              <li key={r}>
                <div className="flex items-center gap-2">
                  <strong>{ROLE_LABELS[r]}</strong>
                  <Pill tone={r === 'ADMIN' ? 'bad' : 'neutral'}>{PERMISSIONS[r].length} permissions</Pill>
                </div>
                <p className="text-ink-muted mt-0.5">{ROLE_BLURBS[r]}</p>
              </li>
            ))}
          </ul>
          <p className="hint mt-5">
            Permissions are set in <code>src/lib/rbac.ts</code>. Change the matrix there and every screen and action follows,
            because nothing in the app decides access on its own.
          </p>
        </section>
      </div>
    </Shell>
  );
}

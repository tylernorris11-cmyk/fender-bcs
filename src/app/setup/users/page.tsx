import type { Role } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { PERMISSIONS, ROLE_BLURBS, ROLE_LABELS, TOGGLEABLE_MODULES } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { COMPANY_LABEL } from '@/lib/company';
import { Avatar, PageHeader, Pill, SortTh, Table } from '@/components/ui';
import {
  createUser, resetPassword, toggleUserActive, updateHiddenModules, updateHolidayAllowance, updateUserCompanies, updateUserRole,
} from '../actions';

const COMPANIES = ['FENDER', 'BS_SUPPLIES'] as const;

const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

export default async function UsersPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('setup.users');
  const alerts = await getAlerts(user);
  const isMaster = user.role === 'MASTER_ADMIN';
  // A company-scoped Administrator only sees, and can only grant, their own
  // company — and can never hand out the Master Administrator role.
  const ROLES = isMaster ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'MASTER_ADMIN');
  const grantableCompanies = isMaster ? COMPANIES : COMPANIES.filter((c) => user.companies.includes(c));
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const users = await db.user.findMany({
    where: isMaster ? undefined : { companies: { hasSome: user.companies } },
    orderBy:
      searchParams.sort === 'role' ? [{ role: dir }]
      : searchParams.sort === 'lastLogin' ? [{ lastLoginAt: dir }]
      : searchParams.sort === 'name' ? [{ name: dir }]
      : [{ active: 'desc' }, { name: 'asc' }],
  });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/users" alerts={alerts.length}>
      <PageHeader title="Users & roles" blurb="Who can get in, and what each of them can reach." />

      <section className="card card-pad mb-6">
        <Table head={<>
          <SortTh label="Person" field="name" basePath="/setup/users" searchParams={searchParams} />
          <SortTh label="Role" field="role" basePath="/setup/users" searchParams={searchParams} />
          <SortTh label="Last signed in" field="lastLogin" basePath="/setup/users" searchParams={searchParams} />
          <th className="th">Company access</th>
          <th className="th">Holiday days/yr</th>
          <th className="th">Status</th><th className="th sr-only">Reset password</th>
        </>}>
          {users.map((u) => {
            const locked = !isMaster && u.role === 'MASTER_ADMIN';
            return (
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
                {locked ? (
                  <span className="text-sm text-ink-muted">{ROLE_LABELS[u.role]}</span>
                ) : (
                  <form action={updateUserRole} className="flex gap-2 items-center">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="role" defaultValue={u.role} className="input w-44 py-1.5" aria-label={`Role for ${u.name}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button className="btn-secondary btn-sm">Save</button>
                  </form>
                )}
              </td>
              <td className="td text-ink-muted whitespace-nowrap">{u.lastLoginAt ? shortDate(u.lastLoginAt) : 'Never'}</td>
              <td className="td">
                {locked ? (
                  <span className="text-xs text-ink-faint">Every company</span>
                ) : (
                  <form action={updateUserCompanies} className="flex flex-col gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    {grantableCompanies.map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name="companies" value={c} defaultChecked={u.companies.includes(c)}
                               disabled={u.role === 'MASTER_ADMIN'} className="h-3.5 w-3.5 accent-brand" />
                        {COMPANY_LABEL[c]}
                      </label>
                    ))}
                    {u.companies.filter((c) => !grantableCompanies.includes(c)).map((c) => (
                      <span key={c} className="text-xs text-ink-faint">{COMPANY_LABEL[c]} (not yours to grant)</span>
                    ))}
                    {u.role !== 'MASTER_ADMIN' && <button className="btn-secondary btn-sm mt-1 self-start">Save</button>}
                  </form>
                )}
              </td>
              <td className="td">
                <form action={updateHolidayAllowance} className="flex gap-2 items-center">
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="holidayAllowanceDays" type="number" min="0" step="1" defaultValue={u.holidayAllowanceDays}
                         className="input w-16 py-1.5" aria-label={`Holiday days a year for ${u.name}`} />
                  <button className="btn-secondary btn-sm">Save</button>
                </form>
              </td>
              <td className="td">
                {locked ? (
                  u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>
                ) : (
                  <form action={toggleUserActive} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    {u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>}
                    <button className="text-xs text-ink-faint hover:text-ink underline">
                      {u.active ? 'suspend' : 'reactivate'}
                    </button>
                  </form>
                )}
              </td>
              <td className="td">
                {locked ? null : (
                <form action={resetPassword} className="flex gap-2 justify-end">
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="password" type="text" className="input w-44 py-1.5" placeholder="New password"
                         aria-label={`New password for ${u.name}`} />
                  <button className="btn-secondary btn-sm">Reset</button>
                </form>
                )}
              </td>
            </tr>
            );
          })}
        </Table>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-1">Who can see what</h2>
        <p className="text-sm text-ink-muted mb-4">
          Untick a module and it disappears for that person everywhere — home screen, menus, search, and the page itself
          if they go straight to the address. A Master Administrator can always see everything, so they aren&apos;t listed here.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="th text-left">Person</th>
                {TOGGLEABLE_MODULES.map((m) => <th key={m.key} className="th text-center whitespace-nowrap px-2">{m.label}</th>)}
                <th className="th sr-only">Save</th>
              </tr>
            </thead>
            <tbody>
              {users.filter((u) => u.role !== 'MASTER_ADMIN').map((u) => (
                <tr key={u.id} className="row">
                  <td className="td font-semibold whitespace-nowrap">{u.name}</td>
                  {TOGGLEABLE_MODULES.map((m) => (
                    <td key={m.key} className="td text-center">
                      <input type="checkbox" form={`vis-${u.id}`} name="visible" value={m.key}
                             defaultChecked={!u.hiddenModules.includes(m.key)}
                             className="h-4 w-4 accent-brand" aria-label={`${u.name} can see ${m.label}`} />
                    </td>
                  ))}
                  <td className="td">
                    <form id={`vis-${u.id}`} action={updateHiddenModules}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn-secondary btn-sm">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
              {users.filter((u) => u.role !== 'MASTER_ADMIN').length === 0 && (
                <tr><td colSpan={TOGGLEABLE_MODULES.length + 2} className="td text-ink-muted">Nobody else to set this for yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <Pill tone={r === 'ADMIN' || r === 'MASTER_ADMIN' ? 'bad' : 'neutral'}>{PERMISSIONS[r].length} permissions</Pill>
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

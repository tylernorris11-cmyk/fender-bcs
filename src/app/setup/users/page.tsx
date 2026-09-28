import Link from 'next/link';
import type { Role } from '@prisma/client';
import { UserPlus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { GRANTABLE_EXTRA_PERMISSIONS, PERMISSIONS, ROLE_BLURBS, ROLE_LABELS, TOGGLEABLE_MODULES } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { COMPANY_LABEL } from '@/lib/company';
import { Avatar, PageHeader, Pill, SortTh, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { UrlModal } from '@/components/UrlModal';
import {
  resetPassword, setAdminEmails, setStaysSignedIn, toggleUserActive, updateAllHiddenModules, updateExtraPermissions, updateHolidayAllowance, updateUserCompanies, updateUserRole,
} from '../actions';
import { AddUserForm } from './AddUserForm';

const COMPANIES = ['FENDER', 'BS_SUPPLIES'] as const;

const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

type SearchParams = { sort?: string; dir?: string; user?: string; add?: string };

/** The page address with the sort kept and the pop-up changed. */
function hrefWith(searchParams: SearchParams, patch: { user?: string; add?: string }) {
  const params = new URLSearchParams();
  if (searchParams.sort) params.set('sort', searchParams.sort);
  if (searchParams.dir) params.set('dir', searchParams.dir);
  if (patch.user) params.set('user', patch.user);
  if (patch.add) params.set('add', patch.add);
  const qs = params.toString();
  return `/setup/users${qs ? `?${qs}` : ''}`;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
      <h3 className="font-bold mb-1">{title}</h3>
      {hint && <p className="text-xs text-ink-muted mb-3">{hint}</p>}
      {children}
    </section>
  );
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
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

  const selected = users.find((u) => u.id === searchParams.user);
  const closeHref = hrefWith(searchParams, {});

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/users" alerts={alerts.length}>
      <PageHeader
        title="Users & roles"
        blurb="Who can get in. Click someone to change their role, access, holidays or password."
        actions={<Link href={hrefWith(searchParams, { add: '1' })} scroll={false} className="btn-primary"><UserPlus size={16} /> Add someone</Link>}
      />

      <section className="card card-pad mb-6">
        <Table head={<>
          <SortTh label="Person" field="name" basePath="/setup/users" searchParams={searchParams} />
          <SortTh label="Role" field="role" basePath="/setup/users" searchParams={searchParams} />
          <th className="th">Companies</th>
          <SortTh label="Last signed in" field="lastLogin" basePath="/setup/users" searchParams={searchParams} />
          <th className="th">Status</th>
        </>}>
          {users.map((u) => (
            <tr key={u.id} className="row">
              <td className="td">
                <Link href={hrefWith(searchParams, { user: u.id })} scroll={false} className="flex items-center gap-3 group">
                  <Avatar name={u.name} colour={u.colour} size={34} />
                  <span>
                    <span className="block font-semibold text-brand-700 group-hover:underline">{u.name}</span>
                    <span className="block text-xs text-ink-faint">{u.jobTitle || u.email}</span>
                  </span>
                </Link>
              </td>
              <td className="td text-ink-muted">{ROLE_LABELS[u.role]}</td>
              <td className="td text-ink-muted text-sm">{u.companies.map((c) => COMPANY_LABEL[c]).join(', ')}</td>
              <td className="td text-ink-muted whitespace-nowrap">{u.lastLoginAt ? shortDate(u.lastLoginAt) : 'Never'}</td>
              <td className="td">{u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>}</td>
            </tr>
          ))}
        </Table>
      </section>

      <details className="card card-pad">
        <summary className="font-bold cursor-pointer">What each role can reach</summary>
        <ul className="space-y-4 text-sm mt-4">
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
      </details>

      {searchParams.add && (
        <UrlModal closeHref={closeHref} title={<h2 className="text-xl font-bold">Add someone</h2>}>
          <AddUserForm roles={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        </UrlModal>
      )}

      {selected && (() => {
        const u = selected;
        const locked = !isMaster && u.role === 'MASTER_ADMIN';
        const isTargetMaster = u.role === 'MASTER_ADMIN';
        return (
          <UrlModal
            closeHref={closeHref}
            title={
              <div className="flex items-center gap-3">
                <Avatar name={u.name} colour={u.colour} size={44} />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{u.name}</h2>
                  <p className="text-sm text-ink-muted truncate">{u.email}{u.jobTitle && ` · ${u.jobTitle}`}</p>
                  <p className="text-xs text-ink-faint">Last signed in {u.lastLoginAt ? shortDate(u.lastLoginAt) : 'never'}</p>
                </div>
              </div>
            }
          >
            {locked && (
              <p className="banner-warn mb-4">Only a Master Administrator can change another Master Administrator&apos;s account.</p>
            )}

            <Section title="Role">
              {locked ? (
                <p className="text-sm">{ROLE_LABELS[u.role]}</p>
              ) : (
                <form key={`role-${u.role}`} action={updateUserRole} className="flex flex-wrap gap-2 items-center">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className="input w-56 py-1.5" aria-label={`Role for ${u.name}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                </form>
              )}
              <p className="text-xs text-ink-muted mt-2">{ROLE_BLURBS[u.role]}</p>
              {isMaster && isTargetMaster && (
                <form key={`emails-${u.adminEmails}`} action={setAdminEmails} className="mt-3 flex items-center gap-3 text-sm">
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="adminEmails" value={u.adminEmails ? '0' : '1'} />
                  <span>Admin emails: <strong>{u.adminEmails ? 'on' : 'off'}</strong></span>
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">{u.adminEmails ? 'Turn off' : 'Turn on'}</SubmitButton>
                </form>
              )}
            </Section>

            <Section title="Company access" hint={isTargetMaster ? 'Master Administrators always have every company.' : undefined}>
              {locked || isTargetMaster ? (
                <p className="text-sm">{u.companies.map((c) => COMPANY_LABEL[c]).join(', ')}</p>
              ) : (
                <form key={`companies-${u.companies.join()}`} action={updateUserCompanies} className="flex flex-wrap items-center gap-4">
                  <input type="hidden" name="userId" value={u.id} />
                  {grantableCompanies.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="companies" value={c} defaultChecked={u.companies.includes(c)} className="h-4 w-4 accent-brand" />
                      {COMPANY_LABEL[c]}
                    </label>
                  ))}
                  {u.companies.filter((c) => !grantableCompanies.includes(c)).map((c) => (
                    <span key={c} className="text-xs text-ink-faint">{COMPANY_LABEL[c]} (not yours to grant)</span>
                  ))}
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                </form>
              )}
            </Section>

            <Section title="Holidays" hint="The full year total, including bank holidays, not on top of them.">
              <form key={`hol-${u.holidayAllowanceDays}-${u.bankHolidaysComeOff}`} action={updateHolidayAllowance} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="userId" value={u.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input name="holidayAllowanceDays" type="number" min="0" step="1" defaultValue={u.holidayAllowanceDays}
                         className="input w-20 py-1.5" aria-label={`Holiday days a year for ${u.name}`} />
                  days a year
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="bankHolidaysComeOff" defaultChecked={u.bankHolidaysComeOff} className="h-4 w-4 accent-brand" />
                  Bank holidays come off
                </label>
                <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
              </form>
            </Section>

            {!isTargetMaster && (
              <Section title="What they can see" hint="Untick an area and it disappears for them everywhere: home screen, menus, search, and the page itself.">
                <form key={`vis-${u.hiddenModules.join()}`} action={updateAllHiddenModules}>
                  <input type="hidden" name="userIds" value={u.id} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                    {TOGGLEABLE_MODULES.map((m) => (
                      <label key={m.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`visible_${u.id}`} value={m.key} defaultChecked={!u.hiddenModules.includes(m.key)}
                               className="h-4 w-4 accent-brand" />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  <SubmitButton className="btn-secondary btn-sm mt-3" pendingLabel="Saving…">Save</SubmitButton>
                </form>
              </Section>
            )}

            {!isTargetMaster && (
              <Section title="Extra access" hint="One narrow extra on top of their role, without changing the role.">
                <form key={`extra-${u.extraPermissions.join()}`} action={updateExtraPermissions}>
                  <input type="hidden" name="userIds" value={u.id} />
                  <div className="grid gap-2">
                    {GRANTABLE_EXTRA_PERMISSIONS.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`extra_${u.id}`} value={p.key} defaultChecked={u.extraPermissions.includes(p.key)}
                               className="h-4 w-4 accent-brand" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <SubmitButton className="btn-secondary btn-sm mt-3" pendingLabel="Saving…">Save</SubmitButton>
                </form>
              </Section>
            )}

            {!locked && (
              <Section title="Account">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>}
                  <form key={`active-${u.active}`} action={toggleUserActive}>
                    <input type="hidden" name="userId" value={u.id} />
                    <SubmitButton className={u.active ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'} pendingLabel="Saving…">
                      {u.active ? 'Suspend' : 'Reactivate'}
                    </SubmitButton>
                  </form>
                </div>
                <form action={resetPassword} className="flex flex-wrap gap-2 items-center">
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="password" type="text" className="input w-56 py-1.5" placeholder="New password" aria-label={`New password for ${u.name}`} />
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Resetting…">Reset password</SubmitButton>
                </form>
                {isMaster && (
                  <form key={`signed-in-${u.staysSignedIn}`} action={setStaysSignedIn} className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="staysSignedIn" value={u.staysSignedIn ? '0' : '1'} />
                    <span>
                      Stays signed in: <strong>{u.staysSignedIn ? 'yes, for a year' : 'no, 12 hours'}</strong>
                      <span className="block text-xs text-ink-muted">For a shared screen like the delivery board. Turning it off signs it out straight away.</span>
                    </span>
                    <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">{u.staysSignedIn ? 'Turn off' : 'Turn on'}</SubmitButton>
                  </form>
                )}
              </Section>
            )}
          </UrlModal>
        );
      })()}
    </Shell>
  );
}

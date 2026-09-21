import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { ROLE_LABELS } from '@/lib/rbac';
import { COMPANY_LABEL } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { updateTimesheetPeople } from '../actions';

export default async function TimesheetPeoplePage() {
  const user = await requirePermission('setup.users');
  const alerts = await getAlerts(user);
  const isMaster = user.role === 'MASTER_ADMIN';

  // Same reach as Users & roles: a company-scoped Administrator only sees,
  // and only sets, people in their own company — and never a Master Administrator.
  const users = await db.user.findMany({
    where: {
      active: true,
      ...(isMaster ? {} : { companies: { hasSome: user.companies }, role: { not: 'MASTER_ADMIN' } }),
    },
    orderBy: { name: 'asc' },
  });
  const onCount = users.filter((u) => u.onTimesheets).length;

  return (
    <Shell user={user} module="timesheets" nav={NAV.timesheets} current="/timesheets/people" alerts={alerts.length}>
      <PageHeader
        title="Who fills one in"
        blurb="Tick everyone who fills in a timesheet. Leave anyone who clocks in unticked — they won't see Timesheets at all."
      />

      <section className="card card-pad">
        <form action={updateTimesheetPeople}>
          <ul className="divide-y divide-hairline">
            {users.map((u) => (
              <li key={u.id}>
                <label className="flex items-center gap-4 py-3 cursor-pointer">
                  <input type="hidden" name="userIds" value={u.id} />
                  <input type="checkbox" name="onTimesheets" value={u.id} defaultChecked={u.onTimesheets} className="h-4 w-4 accent-brand" />
                  <Avatar name={u.name} colour={u.colour} size={34} />
                  <span className="flex-1">
                    <span className="block font-semibold">{u.name}</span>
                    <span className="block text-xs text-ink-faint">{ROLE_LABELS[u.role]}{u.jobTitle && ` · ${u.jobTitle}`}</span>
                  </span>
                  <span className="flex gap-1.5">
                    {u.companies.map((c) => <Pill key={c} tone="neutral">{COMPANY_LABEL[c]}</Pill>)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-hairline">
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
            <span className="text-sm text-ink-muted">{onCount} of {users.length} on timesheets right now.</span>
          </div>
        </form>
      </section>
    </Shell>
  );
}

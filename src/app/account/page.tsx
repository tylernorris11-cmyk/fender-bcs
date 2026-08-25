import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { PERMISSIONS, ROLE_BLURBS, ROLE_LABELS } from '@/lib/rbac';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { changeOwnPassword } from '../setup/actions';

export default async function AccountPage() {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const [record, activity] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.activityLog.findMany({ where: { userId: user.id }, orderBy: { at: 'desc' }, take: 20 }),
  ]);

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders" alerts={alerts.length}>
      <PageHeader title="Your account" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={user.name} colour={user.colour} size={56} />
            <div>
              <p className="text-xl font-bold">{user.name}</p>
              <p className="text-ink-muted">{user.email}</p>
            </div>
          </div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-ink-muted">Role</dt><dd className="font-semibold">{ROLE_LABELS[user.role]}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Job title</dt><dd className="font-semibold">{user.jobTitle || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Last signed in</dt><dd className="font-semibold">{record.lastLoginAt ? `${shortDate(record.lastLoginAt)} ${clock(record.lastLoginAt)}` : 'First time'}</dd></div>
          </dl>
          <p className="text-sm text-ink-muted mt-4">{ROLE_BLURBS[user.role]}</p>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {PERMISSIONS[user.role].map((p) => <Pill key={p}>{p}</Pill>)}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Change your password</h2>
          {record.mustReset && <p className="banner-warn my-3">Your password was set by someone else. Change it now.</p>}
          <form action={changeOwnPassword} className="space-y-4 mt-4">
            <div>
              <label className="label" htmlFor="current">Current password</label>
              <PasswordInput id="current" name="current" required autoComplete="current-password" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="next">New password</label>
              <PasswordInput id="next" name="next" required autoComplete="new-password" className="input" />
              <p className="hint">At least ten characters with a number in it.</p>
            </div>
            <button className="btn-primary">Change password</button>
          </form>

          <form action="/api/sign-out" method="post" className="mt-6 pt-6 border-t border-hairline">
            <button className="btn-secondary w-full">Sign out</button>
          </form>
        </section>
      </div>

      <section className="card card-pad mt-6">
        <h2 className="text-lg font-bold mb-3">What you have done recently</h2>
        <ul className="text-sm divide-y divide-hairline">
          {activity.map((a) => (
            <li key={a.id} className="py-2.5 flex flex-wrap gap-3">
              <span className="text-ink-muted w-40">{shortDate(a.at)} {clock(a.at)}</span>
              <span className="font-medium">{a.action}</span>
              <span className="text-ink-muted">{a.detail}</span>
            </li>
          ))}
          {activity.length === 0 && <li className="py-2.5 text-ink-muted">Nothing yet.</li>}
        </ul>
      </section>
    </Shell>
  );
}

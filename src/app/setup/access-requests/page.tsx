import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { ROLE_LABELS } from '@/lib/rbac';
import { COMPANY_LABEL } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { approveAccessRequest, rejectAccessRequest } from '../actions';

const COMPANIES = ['FENDER', 'BS_SUPPLIES'] as const;
const ROLES = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

export default async function AccessRequestsPage() {
  const user = await requirePermission('setup.users');
  const alerts = await getAlerts(user);

  if (user.role !== 'MASTER_ADMIN') {
    return (
      <Shell user={user} module="setup" nav={NAV.setup} current="/setup/access-requests" alerts={alerts.length}>
        <PageHeader title="Access requests" />
        <div className="banner-warn">
          Only a Master Administrator can review access requests.
        </div>
      </Shell>
    );
  }

  const [pending, decided] = await Promise.all([
    db.accessRequest.findMany({ where: { status: 'PENDING' }, orderBy: { requestedAt: 'asc' } }),
    db.accessRequest.findMany({
      where: { status: { not: 'PENDING' } },
      include: { decidedBy: true },
      orderBy: { decidedAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/access-requests" alerts={alerts.length}>
      <PageHeader title="Access requests" blurb="Self-service sign-up requests from the login page, waiting on approval." />

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Waiting for a decision ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {pending.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-sm text-ink-muted">{r.email}{r.jobTitle && ` · ${r.jobTitle}`}</span>
                  <Pill>{r.companies.map((c) => COMPANY_LABEL[c]).join(' & ') || 'No company chosen'}</Pill>
                  <span className="text-xs text-ink-faint ml-auto">Asked {shortDate(r.requestedAt)}</span>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <form action={approveAccessRequest} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="requestId" value={r.id} />
                    <div>
                      <label className="label text-xs" htmlFor={`role-${r.id}`}>Role</label>
                      <select id={`role-${r.id}`} name="role" defaultValue="VIEWER" className="input py-1.5 w-44">
                        {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="label text-xs">Company access</span>
                      <div className="flex gap-3">
                        {COMPANIES.map((c) => (
                          <label key={c} className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" name="companies" value={c} defaultChecked={r.companies.includes(c)} className="h-3.5 w-3.5 accent-brand" />
                            {COMPANY_LABEL[c]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <button className="btn-primary btn-sm">Approve</button>
                  </form>

                  <form action={rejectAccessRequest} className="flex items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <div>
                      <label className="label text-xs" htmlFor={`note-${r.id}`}>Reason (optional)</label>
                      <input id={`note-${r.id}`} name="note" className="input py-1.5 w-52" placeholder="Why not" />
                    </div>
                    <button className="btn-danger btn-sm">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">Recently decided</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-hairline text-sm">
            {decided.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="text-ink-muted">{r.email}</span>
                <Pill tone={r.status === 'APPROVED' ? 'good' : 'bad'}>{r.status === 'APPROVED' ? 'Approved' : 'Rejected'}</Pill>
                <span className="text-ink-faint ml-auto">
                  {r.decidedAt && shortDate(r.decidedAt)}{r.decidedBy && ` · ${r.decidedBy.name}`}
                </span>
                {r.note && <span className="w-full text-ink-muted text-xs mt-0.5">{r.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';

export default async function BugReportsPage() {
  const user = await requirePermission('setup.bugs');
  const alerts = await getAlerts(user);
  const reports = await db.bugReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/bugs" alerts={alerts.length}>
      <PageHeader
        title="Bug reports"
        blurb={`Emailed to ${process.env.BUG_REPORT_TO_EMAIL || 'tyler@fendersteel.co.uk'} as they come in, and kept here either way.`}
      />

      {reports.length === 0 ? <Empty title="Nothing reported yet." /> : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="card card-pad">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold">{r.userName || 'Unknown'}</span>
                <span className="text-ink-faint text-sm">{r.userEmail}</span>
                {r.company && <Pill>{r.company === 'BS_SUPPLIES' ? 'BCS Products' : 'Fender Steel'}</Pill>}
                {r.emailSent ? <Pill tone="good">Emailed</Pill> : <Pill tone="warn">Not emailed</Pill>}
                <span className="text-ink-faint text-sm ml-auto">{shortDate(r.createdAt)} {clock(r.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{r.description}</p>
              {r.page && <p className="text-xs text-ink-faint mt-2">Reported from <code className="text-ink-muted">{r.page}</code></p>}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';
import type { Lead } from '@prisma/client';
import { db } from '@/lib/db';

const STATUS_TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  NEW: 'neutral', CONTACT_FOUND: 'info', NO_CONTACT_FOUND: 'warn', DRAFTED: 'info', APPROVED: 'info',
  SENT: 'good', REPLIED: 'good', BOUNCED: 'bad', OPTED_OUT: 'bad', REJECTED: 'bad',
};

export default async function OutreachLeadsPage() {
  const user = await requirePermission('outreach.view');
  const alerts = await getAlerts(user);
  if (getActiveCompany(user) !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="outreach" nav={NAV.outreach} current="/outreach/leads" alerts={alerts.length}>
        <PageHeader title="Sales outreach" />
        <div className="banner-warn">
          Sales outreach is only available in the BCS Products view for now.
        </div>
      </Shell>
    );
  }

  const leads = await db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });

  return (
    <Shell user={user} module="outreach" nav={NAV.outreach} current="/outreach/leads" alerts={alerts.length}>
      <PageHeader title="All leads" blurb={`${leads.length} companies found so far, from Companies House.`} />

      {leads.length === 0 ? (
        <Empty title="No leads yet — the daily discovery job hasn't run, or hasn't found anything new." />
      ) : (
        <section className="card">
          <Table
            head={(
              <>
                <th className="th">Company</th>
                <th className="th">Type</th>
                <th className="th">Contact</th>
                <th className="th">Status</th>
                <th className="th">Found</th>
              </>
            )}
          >
            {leads.map((lead: Lead) => (
              <tr key={lead.id} className="border-t border-hairline">
                <td className="td font-medium">{lead.companyName}</td>
                <td className="td text-ink-muted">{lead.companyType || '—'}</td>
                <td className="td text-ink-muted">{lead.contactEmail || '—'}</td>
                <td className="td"><Pill tone={STATUS_TONE[lead.status] ?? 'neutral'}>{lead.status.replace(/_/g, ' ')}</Pill></td>
                <td className="td text-ink-muted">{lead.createdAt.toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </Shell>
  );
}

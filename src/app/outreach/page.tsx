import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';
import type { OutreachEmail, Lead } from '@prisma/client';
import { db } from '@/lib/db';
import { outreachSetupProblems } from '@/lib/outreach/config';
import { approveOutreachEmail, rejectOutreachEmail } from './actions';

const STATUS_TONE = {
  DRAFT: 'neutral', APPROVED: 'info', SENT: 'good', REJECTED: 'bad', FAILED: 'bad',
} as const;

export default async function OutreachQueuePage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requirePermission('outreach.view');
  const alerts = await getAlerts(user);
  if (getActiveCompany(user) !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="outreach" nav={NAV.outreach} current="/outreach" alerts={alerts.length}>
        <PageHeader title="Sales outreach" />
        <div className="banner-warn">
          Sales outreach is only available in the BCS Products view for now.
        </div>
      </Shell>
    );
  }
  const canManage = can(user, 'outreach.manage');
  const setupProblems = outreachSetupProblems();

  const status = searchParams.status && ['DRAFT', 'APPROVED', 'SENT', 'REJECTED', 'FAILED'].includes(searchParams.status)
    ? searchParams.status
    : 'DRAFT';

  const emails = await db.outreachEmail.findMany({
    where: { status },
    include: { lead: true },
    orderBy: { draftedAt: 'desc' },
    take: 100,
  });

  const counts = await db.outreachEmail.groupBy({ by: ['status'], _count: true });
  const countFor = (s: string) => counts.find((c: { status: string; _count: number }) => c.status === s)?._count ?? 0;

  return (
    <Shell user={user} module="outreach" nav={NAV.outreach} current="/outreach" alerts={alerts.length}>
      <PageHeader
        title="Sales outreach — review queue"
        blurb="Introductory emails the agent has drafted for BCS Products / BS Supplies. Nothing sends until it's approved here."
      />

      {setupProblems.length > 0 && (
        <div className="banner-warn mb-6">
          <div>
            <strong>Setup isn&apos;t finished, so nothing will send yet.</strong> Still to add in Vercel → Settings → Environment Variables:
            <ul className="list-disc pl-5 mt-1">
              {setupProblems.map((p) => <li key={p.name}><code>{p.name}</code> — {p.purpose}</li>)}
            </ul>
            <p className="mt-1">Step-by-step in <code>docs/OUTREACH_SETUP.md</code>.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {(['DRAFT', 'APPROVED', 'SENT', 'REJECTED', 'FAILED'] as const).map((s) => (
          <Link
            key={s}
            href={`/outreach?status=${s}`}
            className={`pill ${status === s ? 'bg-forest text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {s === 'DRAFT' ? 'Awaiting review' : s.charAt(0) + s.slice(1).toLowerCase()} ({countFor(s)})
          </Link>
        ))}
        <Link href="/outreach/leads" className="pill bg-slate-100 text-slate-600">All leads →</Link>
      </div>

      {emails.length === 0 ? (
        <Empty title={status === 'DRAFT' ? "Nothing waiting on you right now." : 'Nothing here yet.'} />
      ) : (
        <div className="space-y-4">
          {emails.map((email: OutreachEmail & { lead: Lead }) => (
            <section key={email.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">{email.lead.companyName}</p>
                  <p className="text-sm text-ink-muted">
                    {email.lead.contactEmail || 'no contact email'}
                    {email.lead.website && <> · <a href={email.lead.website} target="_blank" rel="noreferrer" className="underline">{email.lead.website}</a></>}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[status as keyof typeof STATUS_TONE] ?? 'neutral'}>{status}</Pill>
              </div>

              <p className="text-sm font-medium mb-1">{email.subject}</p>
              <p className="text-sm text-ink-muted whitespace-pre-wrap mb-4">{email.bodyText}</p>

              {status === 'DRAFT' && canManage && (
                <div className="flex gap-2">
                  <form action={approveOutreachEmail}>
                    <input type="hidden" name="id" value={email.id} />
                    <button className="btn-primary">Approve to send</button>
                  </form>
                  <form action={rejectOutreachEmail}>
                    <input type="hidden" name="id" value={email.id} />
                    <button className="btn-secondary">Reject</button>
                  </form>
                </div>
              )}

              {status === 'SENT' && email.repliedAt && (
                <div className="banner-ok mt-2">Replied — forwarded to your inbox.</div>
              )}
              {status === 'FAILED' && email.failReason && (
                <p className="text-sm text-signal mt-2">{email.failReason}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}

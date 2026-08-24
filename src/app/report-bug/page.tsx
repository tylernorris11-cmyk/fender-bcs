import { CheckCircle2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { reportBug } from './actions';

export default async function ReportBugPage({ searchParams }: { searchParams: { from?: string; sent?: string; description?: string } }) {
  const user = await requireUser();
  const alerts = await getAlerts(user);

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/report-bug" alerts={alerts.length}>
      <PageHeader title="Report a bug" blurb="Tell us what happened — it's saved here and emailed straight through." />

      {searchParams.sent === '1' && (
        <div className="banner-ok mb-6">
          <CheckCircle2 size={20} className="shrink-0" aria-hidden />
          <span>Thanks — that's been logged and sent through.</span>
        </div>
      )}

      <section className="card card-pad max-w-2xl">
        <form action={reportBug} className="space-y-4">
          <input type="hidden" name="page" value={searchParams.from ?? ''} />
          <div>
            <label className="label" htmlFor="description">What happened?</label>
            <textarea
              id="description" name="description" rows={6} required className="input"
              defaultValue={searchParams.description ?? ''}
              placeholder="What you were doing, what you expected, and what actually happened. The more detail the faster it gets fixed."
            />
          </div>
          {searchParams.from && (
            <p className="hint">Reported from <code className="text-ink">{searchParams.from}</code> — that's sent along automatically.</p>
          )}
          <button className="btn-primary">Send report</button>
        </form>
      </section>
    </Shell>
  );
}

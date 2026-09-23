import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { isoDateUk } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { JournalForm } from './JournalForm';

export default async function NewJournalPage() {
  const user = await requirePermission('accounts.post');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const codes = await db.nominalCode.findMany({
    where: { company, active: true },
    orderBy: { code: 'asc' },
    select: { code: true, name: true },
  });

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/journals/new" alerts={alerts.length}>
      <PageHeader title="New journal" blurb="A nominal journal, numbered on from Exchequer's. Once posted it can't be edited, only reversed." />
      {codes.length < 2 ? (
        <section className="card card-pad">
          <Empty
            title="A journal needs at least two nominal codes to post between. Add them to the chart of accounts first."
            action={<Link href="/accounts/nominal" className="btn-primary">Chart of accounts</Link>}
          />
        </section>
      ) : (
        <JournalForm codes={codes} today={isoDateUk()} />
      )}
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';

const EXPORTS = [
  { href: '/orders/export', label: 'All orders', blurb: 'Every order with stage, value, weight and delivery date.' },
  { href: '/setup/backups/export?table=batches', label: 'Batches and certificates', blurb: 'Cast numbers, suppliers, mill certificate references and remaining quantities.' },
  { href: '/setup/backups/export?table=movements', label: 'Stock movements', blurb: 'Every tonne in and out with cast and operator.' },
  { href: '/setup/backups/export?table=ncrs', label: 'Non-conformances', blurb: 'The full NCR register with corrective actions.' },
  { href: '/setup/backups/export?table=customers', label: 'Customers', blurb: 'Accounts, contacts, terms and credit limits.' },
];

export default async function BackupsPage() {
  const user = await requirePermission('setup.backups');
  const alerts = await getAlerts(user);
  const companies = user.companies;

  const [orders, batches, movements, ncrs, customers] = await Promise.all([
    db.order.count({ where: { company: { in: companies } } }),
    db.batch.count({ where: { company: { in: companies } } }),
    db.stockMovement.count({ where: { product: { company: { in: companies } } } }),
    db.ncr.count({ where: { company: { in: companies } } }),
    db.customer.count({ where: { company: { in: companies } } }),
  ]);

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/backups" alerts={alerts.length}>
      <PageHeader title="Backups" blurb="Pull the records out as spreadsheets whenever you want them." />

      <StatRow>
        <Stat value={orders} label="Orders" />
        <Stat value={batches} label="Batches" />
        <Stat value={movements} label="Stock movements" />
        <Stat value={ncrs} label="Non-conformances" />
      </StatRow>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Download</h2>
        <ul className="divide-y divide-hairline">
          {EXPORTS.map((e) => (
            <li key={e.href} className="py-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <p className="font-semibold">{e.label}</p>
                <p className="text-sm text-ink-muted">{e.blurb}</p>
              </div>
              <a href={e.href} className="btn-secondary">Download CSV</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-2">The real backup</h2>
        <p className="text-sm text-ink-muted mb-3">
          These downloads are handy, but they are not a disaster plan. The database itself is where everything lives.
          Turn on automatic point-in-time backups with whoever hosts it — Neon, Supabase and Vercel Postgres all offer this —
          and check once a quarter that a restore actually works.
        </p>
        <p className="text-sm text-ink-muted">
          CARES expects records to be kept and retained. Agree a retention period with your quality manager, write it down,
          and make sure the hosting retention setting matches it. {customers} customer records are in the system today.
        </p>
      </section>
    </Shell>
  );
}

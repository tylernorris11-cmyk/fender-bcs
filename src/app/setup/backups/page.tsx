import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getBackupStats } from '@/lib/backupSync';
import { isDriveConnected } from '@/lib/googleDrive';
import { shortDate, clock } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { disconnectGoogleDrive, syncDriveNow } from './actions';

const EXPORTS = [
  { href: '/orders/export', label: 'All orders', blurb: 'Every order with stage, value, weight and delivery date.' },
  { href: '/setup/backups/export?table=batches', label: 'Batches and certificates', blurb: 'Cast numbers, suppliers, mill certificate references and remaining quantities.' },
  { href: '/setup/backups/export?table=movements', label: 'Stock movements', blurb: 'Every tonne in and out with cast and operator.' },
  { href: '/setup/backups/export?table=ncrs', label: 'Non-conformances', blurb: 'The full NCR register with corrective actions.' },
  { href: '/setup/backups/export?table=customers', label: 'Customers', blurb: 'Accounts, contacts, terms and credit limits.' },
];

export default async function BackupsPage({
  searchParams,
}: {
  searchParams: { driveError?: string; driveConnected?: string; syncResult?: string };
}) {
  const user = await requirePermission('setup.backups');
  const alerts = await getAlerts(user);
  const companies = user.companies;

  const [orders, batches, movements, ncrs, customers, driveConnected, backupStats] = await Promise.all([
    db.order.count({ where: { company: { in: companies } } }),
    db.batch.count({ where: { company: { in: companies } } }),
    db.stockMovement.count({ where: { product: { company: { in: companies } } } }),
    db.ncr.count({ where: { company: { in: companies } } }),
    db.customer.count({ where: { company: { in: companies } } }),
    isDriveConnected(),
    getBackupStats(),
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

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-1">Google Drive backup</h2>
        <p className="text-sm text-ink-muted mb-3">
          Copies every mill certificate, compliance/H&amp;S document and photo out to a Google Drive folder once a
          day, so they survive even if this system or its file storage was ever lost.
        </p>

        {searchParams.driveError && (
          <p className="banner-bad mb-4" role="alert">{decodeURIComponent(searchParams.driveError)}</p>
        )}
        {searchParams.driveConnected && <p className="banner-ok mb-4">Google Drive connected.</p>}
        {searchParams.syncResult && <p className="banner-ok mb-4">Synced — {decodeURIComponent(searchParams.syncResult)}.</p>}

        {!driveConnected ? (
          <a href="/api/setup/backups/drive/auth" className="btn-primary">Connect Google Drive</a>
        ) : (
          <>
            <StatRow>
              <Stat value={backupStats.totalBackedUp} label="Files backed up" />
              <Stat value={backupStats.pendingCount} label="Waiting to sync" tone={backupStats.pendingCount ? 'warn' : 'default'} />
            </StatRow>
            <p className="text-sm text-ink-muted mb-4">
              {backupStats.lastBackupAt
                ? `Last file synced ${shortDate(backupStats.lastBackupAt)} at ${clock(backupStats.lastBackupAt)}.`
                : 'Nothing synced yet — the first run happens tonight, or use Sync now below.'}
              {' '}Runs automatically overnight, up to 25 files a night, so a big backlog catches up over a few days.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={syncDriveNow}>
                <SubmitButton className="btn-secondary" pendingLabel="Syncing…">Sync now</SubmitButton>
              </form>
              <form action={disconnectGoogleDrive}>
                <SubmitButton className="btn-danger" pendingLabel="Disconnecting…">Disconnect</SubmitButton>
              </form>
            </div>
          </>
        )}
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

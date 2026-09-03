import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Stat, StatRow, Table } from '@/components/ui';

export default async function FuelPage() {
  const user = await requirePermission('fuel.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const entries = await db.fuelEntry.findMany({
    where: { asset: { OR: [{ company: null }, { company }] } },
    include: { asset: true, loggedBy: true },
    orderBy: { loggedAt: 'desc' },
    take: 200,
  });

  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const thisMonth = entries.filter((e) => e.loggedAt >= startOfMonth);
  const litresThisMonth = thisMonth.reduce((s, e) => s + (Number(e.litresAfter) - Number(e.litresBefore)), 0);

  return (
    <Shell user={user} module="fuel" nav={NAV.fuel} current="/fuel" alerts={alerts.length}>
      <PageHeader
        title="Fuel"
        blurb="Fill-ups against the yard tank meter, by vehicle."
        actions={
          can(user, 'fuel.create') && (
            <Link href="/fuel/new" className="btn-primary"><Plus size={16} /> Add entry</Link>
          )
        }
      />

      <StatRow>
        <Stat value={entries.length} label="Entries logged" />
        <Stat value={thisMonth.length} label="This month" />
        <Stat value={`${litresThisMonth.toLocaleString('en-GB', { maximumFractionDigits: 1 })} L`} label="Litres this month" />
        <Stat value={entries[0] ? shortDate(entries[0].loggedAt) : '—'} label="Last entry" />
      </StatRow>

      <section className="card card-pad">
        {entries.length === 0 ? (
          <Empty title="No fuel entries logged yet." action={can(user, 'fuel.create') && <Link href="/fuel/new" className="btn-primary">Add entry</Link>} />
        ) : (
          <Table
            head={
              <>
                <th className="th">Vehicle</th>
                <th className="th">Mileage</th>
                <th className="th">Driver</th>
                <th className="th text-right">Current reading</th>
                <th className="th text-right">New reading</th>
                <th className="th text-right">Litres used</th>
                <th className="th">Logged</th>
              </>
            }
          >
            {entries.map((e) => (
              <tr key={e.id} className="row">
                <td className="td">
                  <Link href={`/assets/${e.assetId}`} className="font-semibold text-brand-700 hover:underline">{e.asset.name}</Link>
                  <span className="block text-xs text-ink-faint">{e.asset.ref}</span>
                </td>
                <td className="td">{e.mileage.toLocaleString('en-GB')}</td>
                <td className="td">{e.driverName}</td>
                <td className="td text-right">{Number(e.litresBefore).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className="td text-right">{Number(e.litresAfter).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className="td text-right font-semibold">
                  {(Number(e.litresAfter) - Number(e.litresBefore)).toLocaleString('en-GB', { minimumFractionDigits: 2 })} L
                </td>
                <td className="td text-ink-muted whitespace-nowrap">
                  {shortDate(e.loggedAt)} {clock(e.loggedAt)}{e.loggedBy && ` · ${e.loggedBy.name}`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

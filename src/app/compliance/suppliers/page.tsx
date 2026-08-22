import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, Table } from '@/components/ui';

export default async function SuppliersPage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);

  const suppliers = await db.supplier.findMany({
    orderBy: { name: 'asc' },
    include: { certificates: { where: { scheme: 'Supplier' }, orderBy: { expiresOn: 'desc' } }, batches: true },
  });

  const unapproved = suppliers.filter(
    (s) => s.batches.length > 0 && !s.certificates.some((c) => c.expiresOn > new Date()),
  );

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/suppliers" alerts={alerts.length}>
      <PageHeader title="Suppliers" />

      <p className="text-ink-muted max-w-2xl mb-6">
        CARES rules say reinforcement may only be bought from <strong className="text-ink">CARES-approved manufacturers</strong>.
        This register cross-checks every supplier we have actually received steel from against the approval certificates on file.
      </p>

      {unapproved.map((s) => (
        <div key={s.id} className="banner-bad mb-4">
          <AlertTriangle size={20} className="shrink-0" aria-hidden />
          <p><strong>{s.name}</strong> — no in-date CARES approval on file. Add the certificate, or stop buying until it is verified.</p>
        </div>
      ))}

      <section className="card card-pad">
        <Table head={<>
          <th className="th">Supplier</th><th className="th text-right">Batches</th><th className="th text-right">Tonnage received</th>
          <th className="th">Last delivery</th><th className="th">CARES approval</th>
        </>}>
          {suppliers.map((s) => {
            const latest = s.certificates[0];
            const days = latest ? daysUntil(latest.expiresOn)! : null;
            const lastDelivery = s.batches.reduce<Date | null>(
              (max, b) => (!max || b.receivedAt > max ? b.receivedAt : max), null,
            );
            return (
              <tr key={s.id} className="row">
                <td className="td font-semibold">{s.name}<span className="block text-xs font-normal text-ink-faint">{s.approvedFor}</span></td>
                <td className="td text-right tabular-nums">{s.batches.length}</td>
                <td className="td text-right tabular-nums">{s.batches.reduce((t, b) => t + Number(b.qtyReceived), 0).toFixed(0)} t</td>
                <td className="td text-ink-muted whitespace-nowrap">{shortDate(lastDelivery)}</td>
                <td className="td">
                  {!latest ? <Pill tone="bad">Not on file</Pill>
                    : days! < 0 ? <Pill tone="bad">Expired {shortDate(latest.expiresOn)}</Pill>
                    : days! <= 90 ? <Pill tone="warn">{shortDate(latest.expiresOn)} · {days}d</Pill>
                    : <span className="text-ink-muted">{shortDate(latest.expiresOn)}</span>}
                </td>
              </tr>
            );
          })}
        </Table>
        <p className="hint mt-4">
          Supplier approvals live in the certificate register with scheme &ldquo;Supplier&rdquo; — add one there and it appears here.
        </p>
      </section>
    </Shell>
  );
}

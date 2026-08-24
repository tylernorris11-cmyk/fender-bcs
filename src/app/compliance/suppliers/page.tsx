import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortTh, Table } from '@/components/ui';

export default async function SuppliersPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const company = getActiveCompany(user);

  const suppliers = await db.supplier.findMany({
    where: { company },
    orderBy: { name: 'asc' },
    include: { certificates: { where: { scheme: 'Supplier' }, orderBy: { expiresOn: 'desc' } }, batches: true },
  });

  const unapproved = suppliers.filter(
    (s) => s.batches.length > 0 && !s.certificates.some((c) => c.expiresOn > new Date()),
  );

  const rows = suppliers.map((s) => {
    const latest = s.certificates[0];
    const lastDelivery = s.batches.reduce<Date | null>(
      (max, b) => (!max || b.receivedAt > max ? b.receivedAt : max), null,
    );
    return { s, latest, lastDelivery, tonnage: s.batches.reduce((t, b) => t + Number(b.qtyReceived), 0) };
  });

  if (searchParams.sort) {
    const mul = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (searchParams.sort) {
        case 'batches': return mul * (a.s.batches.length - b.s.batches.length);
        case 'tonnage': return mul * (a.tonnage - b.tonnage);
        case 'lastDelivery': return mul * ((a.lastDelivery?.getTime() ?? 0) - (b.lastDelivery?.getTime() ?? 0));
        case 'approval': return mul * ((a.latest?.expiresOn.getTime() ?? 0) - (b.latest?.expiresOn.getTime() ?? 0));
        default: return mul * a.s.name.localeCompare(b.s.name);
      }
    });
  }

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
          <SortTh label="Supplier" field="name" basePath="/compliance/suppliers" searchParams={searchParams} />
          <SortTh label="Batches" field="batches" basePath="/compliance/suppliers" searchParams={searchParams} align="right" />
          <SortTh label="Tonnage received" field="tonnage" basePath="/compliance/suppliers" searchParams={searchParams} align="right" />
          <SortTh label="Last delivery" field="lastDelivery" basePath="/compliance/suppliers" searchParams={searchParams} />
          <SortTh label="CARES approval" field="approval" basePath="/compliance/suppliers" searchParams={searchParams} />
        </>}>
          {rows.map(({ s, latest, lastDelivery, tonnage }) => {
            const days = latest ? daysUntil(latest.expiresOn)! : null;
            return (
              <tr key={s.id} className="row">
                <td className="td font-semibold">{s.name}<span className="block text-xs font-normal text-ink-faint">{s.approvedFor}</span></td>
                <td className="td text-right tabular-nums">{s.batches.length}</td>
                <td className="td text-right tabular-nums">{tonnage.toFixed(0)} t</td>
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

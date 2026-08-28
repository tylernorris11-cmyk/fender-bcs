import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill, SortTh, Table } from '@/components/ui';
import { saveCertificate } from '../actions';

const SCHEMES = ['CARES SRC', 'Supplier', 'ISO 9001', 'ISO 14001', 'ISO 45001', 'Calibration', 'Insurance', 'Other'];

export default async function SuppliersPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/suppliers" alerts={alerts.length}>
        <PageHeader title="Suppliers" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const [suppliers, certificates] = await Promise.all([
    db.supplier.findMany({
      where: { company },
      orderBy: { name: 'asc' },
      include: { certificates: { where: { scheme: 'Supplier' }, orderBy: { expiresOn: 'desc' } }, batches: true },
    }),
    db.certificate.findMany({ where: { company }, include: { supplier: true }, orderBy: { expiresOn: 'asc' } }),
  ]);

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
      <PageHeader title="Suppliers" blurb="Approvals we rely on, and every certificate on file — the register warns ninety days ahead of expiry." />

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
          Supplier approvals live in the certificate register below with scheme &ldquo;Supplier&rdquo; — add one there and it appears here.
        </p>
      </section>

      <section className="card card-pad mt-6">
        <h2 className="text-lg font-bold mb-1">Certificates</h2>
        <p className="text-sm text-ink-muted mb-4">Our own approvals and every supplier approval we rely on. Warns ninety days ahead.</p>
        <Table head={<>
          <th className="th">Certificate</th>
          <th className="th">Scheme</th>
          <th className="th">Held by</th>
          <th className="th">Issued</th>
          <th className="th">Expires</th>
          <th className="th">File</th>
        </>}>
          {certificates.map((c) => {
            const days = daysUntil(c.expiresOn)!;
            return (
              <tr key={c.id} className="row">
                <td className="td">
                  <span className="font-semibold">{c.title}</span>
                  {c.reference && <span className="block text-xs text-ink-faint">{c.reference}</span>}
                </td>
                <td className="td text-ink-muted">{c.scheme}</td>
                <td className="td">{c.supplier?.name ?? c.holder}</td>
                <td className="td text-ink-muted whitespace-nowrap">{shortDate(c.issuedOn)}</td>
                <td className="td whitespace-nowrap">
                  {days < 0 ? <Pill tone="bad">Expired {shortDate(c.expiresOn)}</Pill>
                    : days <= 90 ? <Pill tone="warn">{shortDate(c.expiresOn)} · {days}d</Pill>
                    : <span className="text-ink-muted">{shortDate(c.expiresOn)}</span>}
                </td>
                <td className="td">
                  {c.fileUrl ? <a href={c.fileUrl} className="text-brand-700 hover:underline">Open</a> : <Pill tone="bad">Not on file</Pill>}
                </td>
              </tr>
            );
          })}
        </Table>
      </section>

      {can(user, 'compliance.edit') && (
        <section className="card card-pad mt-6">
          <h2 className="text-lg font-bold mb-1">Add a certificate</h2>
          <p className="text-sm text-ink-muted mb-4">
            Pick the scheme &ldquo;Supplier&rdquo; and choose the supplier to record their CARES approval — it then shows in the register above.
          </p>
          <form action={saveCertificate} className="grid gap-4 sm:grid-cols-2 max-w-3xl">
            <div>
              <label className="label" htmlFor="scheme">Scheme</label>
              <select id="scheme" name="scheme" className="input">{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" name="title" required className="input" placeholder="CARES approval — SRC Appendix 02" />
            </div>
            <div>
              <label className="label" htmlFor="holder">Held by</label>
              <input id="holder" name="holder" defaultValue={COMPANY_LABEL[company]} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="supplierId">Supplier (if a supplier approval)</label>
              <select id="supplierId" name="supplierId" className="input">
                <option value="">Not a supplier certificate</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reference">Certificate number</label>
              <input id="reference" name="reference" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="fileUrl">File link</label>
              <input id="fileUrl" name="fileUrl" type="url" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="issuedOn">Issued</label>
              <input id="issuedOn" name="issuedOn" type="date" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="expiresOn">Expires</label>
              <input id="expiresOn" name="expiresOn" type="date" required className="input" />
            </div>
            <div className="sm:col-span-2"><button className="btn-primary">Add certificate</button></div>
          </form>
        </section>
      )}
    </Shell>
  );
}

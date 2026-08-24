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

export default async function CertificatesPage({ searchParams }: { searchParams: { sort?: string; dir?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/certificates" alerts={alerts.length}>
        <PageHeader title="Certificates" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const [certificates, suppliers] = await Promise.all([
    db.certificate.findMany({
      where: { company },
      include: { supplier: true },
      orderBy:
        searchParams.sort === 'title' ? { title: dir }
        : searchParams.sort === 'scheme' ? { scheme: dir }
        : searchParams.sort === 'issued' ? { issuedOn: dir }
        : { expiresOn: searchParams.sort === 'expires' ? dir : 'asc' },
    }),
    db.supplier.findMany({ where: { company }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/certificates" alerts={alerts.length}>
      <PageHeader title="Certificates" blurb="Our own approvals and every supplier approval we rely on. Warns ninety days ahead." />

      <section className="card card-pad mb-6">
        <Table head={<>
          <SortTh label="Certificate" field="title" basePath="/compliance/certificates" searchParams={searchParams} />
          <SortTh label="Scheme" field="scheme" basePath="/compliance/certificates" searchParams={searchParams} />
          <th className="th">Held by</th>
          <SortTh label="Issued" field="issued" basePath="/compliance/certificates" searchParams={searchParams} />
          <SortTh label="Expires" field="expires" basePath="/compliance/certificates" searchParams={searchParams} />
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
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Add a certificate</h2>
          <p className="text-sm text-ink-muted mb-4">
            Pick the scheme &ldquo;Supplier&rdquo; and choose the supplier to record their CARES approval — it then shows on the Suppliers register.
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

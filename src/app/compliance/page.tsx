import Link from 'next/link';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';

/**
 * The six things the CARES fabricator scheme is built around, and where each
 * one is evidenced in this system. Written for the person who has to stand next
 * to the auditor, not for a compliance consultant.
 */
const EXPECTATIONS = [
  {
    title: 'Buy only from CARES-approved manufacturers',
    body: 'The Suppliers register cross-checks everyone we have actually received steel from against the approval certificates on file.',
    href: '/compliance/suppliers',
  },
  {
    title: 'Full traceability for each cast and each supplier',
    body: 'Every delivery in is booked as a batch with its cast number and mill certificate. Deliveries out pick oldest-first so the right certificate prints on the note. Trace a batch follows any cast number both ways.',
    href: '/compliance/trace',
  },
  {
    title: 'Cut and bend to BS 8666 and the customer\u2019s schedule',
    body: 'Bending schedules on orders carry the shape code and every dimension, and the bending ticket prints the tolerance the operator is working to.',
    href: '/production',
  },
  {
    title: 'Control of non-conforming steel and complaints',
    body: 'Anything wrong \u2014 a customer complaint, an internal catch, a problem with a supplier \u2014 gets a record with the corrective action taken. Auditors read this register first.',
    href: '/compliance/ncr',
  },
  {
    title: 'Control of measuring devices',
    body: 'Bender and cropper calibration dates live on each machine in Assets and roll forward when a calibration is logged.',
    href: '/assets',
  },
  {
    title: 'Certificates in date and returns submitted',
    body: 'The register warns ninety days ahead. Tonnage returns are ticked off under Returns and actions. Audits are twice yearly and can be unannounced, so the aim is simple: green banner every day.',
    href: '/compliance/suppliers',
  },
];

export default async function CompliancePage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance" alerts={alerts.length}>
        <PageHeader title="Compliance" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const in90 = new Date(Date.now() + 90 * 86_400_000);

  const [inDate, expiring, openActions, batches, tracedBatches, openNcrs] = await Promise.all([
    db.certificate.count({ where: { company, expiresOn: { gt: in90 } } }),
    db.certificate.count({ where: { company, expiresOn: { lte: in90, gt: new Date() } } }),
    db.auditAction.count({ where: { company, closedAt: null } }),
    db.batch.count({ where: { company, status: { in: ['Available', 'Quarantined'] } } }),
    db.batch.count({ where: { company, status: { in: ['Available', 'Quarantined'] }, millCertUrl: { not: '' }, heatNumber: { not: '' } } }),
    db.ncr.count({ where: { company, status: 'OPEN' } }),
  ]);

  const expired = await db.certificate.count({ where: { company, expiresOn: { lte: new Date() } } });
  const ready = expired === 0 && tracedBatches === batches && alerts.filter((a) => a.severity === 'bad').length === 0;

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance" alerts={alerts.length}>
      <PageHeader title="Compliance" blurb="CARES approval, certificates and full steel traceability." />

      {ready ? (
        <div className="banner-ok mb-6">
          <ShieldCheck size={22} className="shrink-0" aria-hidden />
          <div>
            <p className="font-bold text-base">Audit-ready</p>
            <p className="mt-0.5">Certificates in date, every live batch has its mill certificate, no overdue actions.</p>
          </div>
        </div>
      ) : (
        <div className="banner-bad mb-6">
          <AlertTriangle size={22} className="shrink-0" aria-hidden />
          <div>
            <p className="font-bold text-base">Not audit-ready</p>
            <ul className="mt-1.5 space-y-1">
              {alerts.filter((a) => a.severity === 'bad').slice(0, 5).map((a) => (
                <li key={a.id}><Link href={a.href} className="underline">{a.title}</Link></li>
              ))}
              {expired > 0 && <li>{expired} certificate{expired === 1 ? '' : 's'} out of date.</li>}
            </ul>
          </div>
        </div>
      )}

      <StatRow>
        <Stat value={inDate} label="Certificates in date" tone="good" href="/compliance/suppliers" />
        <Stat value={expiring} label="Expiring within 90 days" tone={expiring ? 'warn' : 'default'} href="/compliance/suppliers" />
        <Stat value={openActions + openNcrs} label="Open actions and NCRs" tone={openActions + openNcrs ? 'warn' : 'default'} href="/compliance/ncr" />
        <Stat value={`${tracedBatches}/${batches}`} label="Batches fully traceable" tone={tracedBatches === batches ? 'good' : 'bad'} href="/compliance/trace" />
      </StatRow>

      <section className="card card-pad">
        <h2 className="text-xl font-bold mb-1">What the CARES fabricator scheme expects — and where it lives here</h2>
        <p className="text-sm text-ink-muted mb-5">
          The scheme requires a management system meeting ISO 9001 covering receipt, in-process and final inspection,
          stock control, cutting and bending to BS 8666, control of non-conforming steel, control of measuring devices,
          purchasing from certified suppliers, traceability for each cast, record keeping and complaint handling.
        </p>
        <ol className="space-y-4">
          {EXPECTATIONS.map((e, i) => (
            <li key={e.title} className="flex gap-4">
              <span className="shrink-0 h-7 w-7 rounded-full bg-brand-100 text-forest grid place-items-center text-sm font-bold">{i + 1}</span>
              <div>
                <Link href={e.href} className="font-semibold hover:underline">{e.title}</Link>
                <p className="text-sm text-ink-muted mt-0.5">{e.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="hint mt-6">
          This is a working summary, not the scheme document. The binding requirements are in the CARES Scheme Manual
          and the Quality and Operations Assessment Schedules for your appendices — keep a current copy with the audit file.
        </p>
      </section>
    </Shell>
  );
}

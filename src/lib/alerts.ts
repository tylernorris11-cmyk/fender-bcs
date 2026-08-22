import 'server-only';
import { db } from './db';
import { daysUntil } from './format';
import { can, type SessionUser } from './rbac';

export type Alert = {
  id: string;
  severity: 'bad' | 'warn' | 'info';
  title: string;
  detail: string;
  href: string;
  perm: Parameters<typeof can>[1];
};

/**
 * One place that answers "what would embarrass us at an unannounced audit, or
 * put a lorry on the road it shouldn't be on". Everything here is derived, so
 * an alert clears itself the moment the underlying record is fixed.
 */
export async function getAlerts(user: SessionUser): Promise<Alert[]> {
  const out: Alert[] = [];
  const in90 = new Date(Date.now() + 90 * 86_400_000);
  const in21 = new Date(Date.now() + 21 * 86_400_000);

  const [certs, openNcrs, quarantined, suppliers, assets, overCredit, pending, missingCert] = await Promise.all([
    db.certificate.findMany({ where: { expiresOn: { lte: in90 } }, orderBy: { expiresOn: 'asc' } }),
    db.ncr.findMany({ where: { status: 'OPEN' }, orderBy: { raisedAt: 'asc' } }),
    db.batch.findMany({ where: { status: 'Quarantined' }, include: { product: true, supplier: true } }),
    db.supplier.findMany({ where: { blocked: false }, include: { certificates: true, batches: { take: 1 } } }),
    db.asset.findMany({ where: { retired: false } }),
    db.customer.findMany({ include: { orders: { where: { paymentStatus: 'UNPAID', stage: { notIn: ['CANCELLED'] } } } } }),
    db.order.count({ where: { stage: 'PENDING_APPROVAL', archived: false } }),
    db.batch.count({ where: { millCertUrl: '', status: { not: 'Rejected' } } }),
  ]);

  for (const c of certs) {
    const days = daysUntil(c.expiresOn)!;
    out.push({
      id: `cert-${c.id}`,
      severity: days < 0 ? 'bad' : days <= 30 ? 'bad' : 'warn',
      title: days < 0 ? `${c.title} has expired` : `${c.title} expires in ${days} days`,
      detail: `${c.scheme} · ${c.holder}${c.reference ? ` · ${c.reference}` : ''}`,
      href: '/compliance/certificates',
      perm: 'compliance.view',
    });
  }

  // A supplier we have taken steel from with no in-date CARES approval on file
  // is the single worst finding an auditor can hand you.
  for (const s of suppliers) {
    if (s.batches.length === 0) continue;
    const approval = s.certificates.find((c) => c.scheme === 'Supplier' && c.expiresOn > new Date());
    if (!approval) {
      out.push({
        id: `supplier-${s.id}`,
        severity: 'bad',
        title: `${s.name} has no in-date CARES approval on file`,
        detail: 'Add the certificate, or stop buying from them until it is verified.',
        href: '/compliance/suppliers',
        perm: 'compliance.view',
      });
    }
  }

  if (missingCert > 0) {
    out.push({
      id: 'batches-no-cert',
      severity: 'bad',
      title: `${missingCert} live ${missingCert === 1 ? 'batch has' : 'batches have'} no mill certificate`,
      detail: 'Traceability is broken until the certificate is attached. Quarantine the steel or chase the mill.',
      href: '/compliance/trace',
      perm: 'compliance.view',
    });
  }

  for (const b of quarantined) {
    out.push({
      id: `quar-${b.id}`,
      severity: 'warn',
      title: `Batch ${b.heatNumber} is quarantined`,
      detail: `${b.product.name} from ${b.supplier.name} — not for issue.`,
      href: '/stock',
      perm: 'stock.view',
    });
  }

  for (const n of openNcrs) {
    const age = -daysUntil(n.raisedAt)!;
    out.push({
      id: `ncr-${n.id}`,
      severity: age > 21 ? 'bad' : 'warn',
      title: `${n.ref} still open${age > 21 ? ` after ${age} days` : ''}`,
      detail: n.description.slice(0, 110),
      href: '/compliance/ncr',
      perm: 'compliance.view',
    });
  }

  for (const a of assets) {
    const checks: [string, Date | null][] = [
      ['MOT', a.motDue], ['Road tax', a.taxDue], ['Safety inspection', a.weeklyCheckDue],
      ['PUWER inspection', a.puwerDue], ['LOLER exam', a.lolerDue], ['Service', a.serviceDue],
      ['Measurement calibration', a.calibrationDue],
    ];
    for (const [label, due] of checks) {
      if (!due || due > in21) continue;
      const days = daysUntil(due)!;
      out.push({
        id: `asset-${a.id}-${label}`,
        severity: days < 0 ? 'bad' : 'warn',
        title: `${a.name} — ${label} ${days < 0 ? `overdue by ${-days} days` : `due in ${days} days`}`,
        detail: `${a.ref} · ${a.category} · ${a.depot}`,
        href: `/assets/${a.id}`,
        perm: 'assets.view',
      });
    }
  }

  const balances = await creditBalances();
  for (const c of overCredit) {
    const used = balances.get(c.id) ?? 0;
    const limit = Number(c.creditLimit);
    if (limit > 0 && used > limit) {
      out.push({
        id: `credit-${c.id}`,
        severity: 'bad',
        title: `${c.name} is over its credit limit`,
        detail: `£${used.toLocaleString('en-GB')} unpaid against a £${limit.toLocaleString('en-GB')} limit.`,
        href: `/customers/${c.id}`,
        perm: 'customers.view',
      });
    }
  }

  if (pending > 0) {
    out.push({
      id: 'pending-approval',
      severity: 'warn',
      title: `${pending} ${pending === 1 ? 'order is' : 'orders are'} waiting for approval`,
      detail: 'Nothing gets cut until these are approved.',
      href: '/orders?stage=PENDING_APPROVAL',
      perm: 'orders.view',
    });
  }

  return out
    .filter((a) => can(user, a.perm))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'bad' ? -1 : 1));
}

/** Unpaid value per customer — the number the credit limit is checked against. */
export async function creditBalances(): Promise<Map<string, number>> {
  const rows = await db.order.findMany({
    where: { paymentStatus: 'UNPAID', archived: false, stage: { notIn: ['CANCELLED', 'DRAFT'] } },
    select: { customerId: true, lines: { select: { lineTotal: true } }, barMarks: { select: { lineTotal: true } } },
  });
  const map = new Map<string, number>();
  for (const o of rows) {
    const total =
      o.lines.reduce((s, l) => s + Number(l.lineTotal), 0) +
      o.barMarks.reduce((s, b) => s + Number(b.lineTotal), 0);
    map.set(o.customerId, (map.get(o.customerId) ?? 0) + total);
  }
  return map;
}

export async function alertCount(user: SessionUser): Promise<number> {
  return (await getAlerts(user)).length;
}

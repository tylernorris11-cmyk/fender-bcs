import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n');
};

export async function GET(request: Request) {
  await requirePermission('setup.backups');
  const table = new URL(request.url).searchParams.get('table') ?? 'customers';

  let rows: Record<string, unknown>[] = [];

  if (table === 'batches') {
    const data = await db.batch.findMany({ include: { product: true, supplier: true }, orderBy: { receivedAt: 'desc' } });
    rows = data.map((b) => ({
      Cast: b.heatNumber, Product: b.product.name, Code: b.product.code, Supplier: b.supplier.name,
      Certificate: b.certNumber, 'Mill cert file': b.millCertUrl, Received: b.receivedAt.toISOString().slice(0, 10),
      'Qty received': Number(b.qtyReceived), 'Qty remaining': Number(b.qtyRemaining), Status: b.status, Location: b.location,
    }));
  } else if (table === 'movements') {
    const data = await db.stockMovement.findMany({ include: { product: true, batch: true, user: true }, orderBy: { at: 'desc' } });
    rows = data.map((m) => ({
      When: m.at.toISOString(), Type: m.type, Product: m.product.name, Cast: m.batch?.heatNumber ?? '',
      Qty: Number(m.qty), Reference: m.reference, Reason: m.reason, By: m.user?.name ?? '',
    }));
  } else if (table === 'ncrs') {
    const data = await db.ncr.findMany({ include: { order: true, customer: true, supplier: true, batch: true, raisedBy: true }, orderBy: { raisedAt: 'desc' } });
    rows = data.map((n) => ({
      Ref: n.ref, Type: n.type, Status: n.status, Raised: n.raisedAt.toISOString().slice(0, 10),
      'Raised by': n.raisedBy?.name ?? '', Order: n.order?.number ?? '', Customer: n.customer?.name ?? '',
      Supplier: n.supplier?.name ?? '', Cast: n.batch?.heatNumber ?? '', Description: n.description,
      'Root cause': n.rootCause, 'Corrective action': n.correctiveAction,
      Closed: n.closedAt?.toISOString().slice(0, 10) ?? '', 'Closed by': n.closedBy,
    }));
  } else {
    const data = await db.customer.findMany({ include: { accountManager: true }, orderBy: { name: 'asc' } });
    rows = data.map((c) => ({
      Code: c.code, Name: c.name, Contact: c.contactName, Phone: c.phone, Email: c.email,
      Address: c.address, Town: c.town, Terms: c.paymentTerms, 'Credit limit': Number(c.creditLimit),
      Status: c.status, 'Account manager': c.accountManager?.name ?? '',
    }));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${toCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fender-${table}-${stamp}.csv"`,
    },
  });
}

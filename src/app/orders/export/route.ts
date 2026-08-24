import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { orderTotals } from '@/lib/orders';
import { getActiveCompany } from '@/lib/company';

const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET() {
  const user = await requirePermission('orders.export');

  const orders = await db.order.findMany({
    where: { company: getActiveCompany(user) },
    include: { customer: true, raisedBy: true, lines: true, barMarks: true },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'Order', 'Customer', 'Town', 'Depot', 'Stage', 'Payment', 'Weight (t)', 'Net (ex VAT)', 'VAT', 'Gross',
    'Delivery date', 'Customer PO', 'Raised by', 'Created', 'Archived',
  ];

  const rows = orders.map((o) => {
    const t = orderTotals(o);
    return [
      o.number, o.customer.name, o.town, o.depot, o.stage, o.paymentStatus,
      (t.weightKg / 1000).toFixed(3), t.net.toFixed(2), t.vat.toFixed(2), t.gross.toFixed(2),
      o.deliveryDate?.toISOString().slice(0, 10) ?? '', o.poNumber, o.raisedBy?.name ?? '',
      o.createdAt.toISOString().slice(0, 10), o.archived ? 'Yes' : 'No',
    ].map(escape).join(',');
  });

  const csv = [header.map(escape).join(','), ...rows].join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fender-orders-${stamp}.csv"`,
    },
  });
}

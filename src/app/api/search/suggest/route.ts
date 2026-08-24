import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';

export type Suggestion = { type: string; label: string; sublabel?: string; href: string };

/**
 * Backs the predictive dropdown under the header search box. Same entities,
 * permissions and company scoping as /search — just a handful of rows per
 * type instead of a full results page, so it's cheap enough to call on
 * every keystroke.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] satisfies Suggestion[] }, { status: 401 });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] satisfies Suggestion[] });

  const like = { contains: q, mode: 'insensitive' as const };
  const company = getActiveCompany(user);
  const take = 5;

  const [orders, customers, batches, assets, suppliers, certificates, ncrs, products, purchaseOrders] = await Promise.all([
    can(user, 'orders.view')
      ? db.order.findMany({ where: { company, OR: [{ number: like }, { poNumber: like }, { customer: { name: like } }] }, include: { customer: true }, take })
      : [],
    can(user, 'customers.view')
      ? db.customer.findMany({ where: { company, OR: [{ name: like }, { contactName: like }, { town: like }, { code: like }] }, take })
      : [],
    can(user, 'stock.view')
      ? db.batch.findMany({ where: { company, OR: [{ heatNumber: like }, { certNumber: like }] }, include: { product: true }, take })
      : [],
    can(user, 'assets.view')
      ? db.asset.findMany({ where: { OR: [{ ref: like }, { name: like }, { category: like }] }, take })
      : [],
    can(user, 'compliance.view')
      ? db.supplier.findMany({ where: { company, name: like }, take })
      : [],
    can(user, 'compliance.view')
      ? db.certificate.findMany({ where: { company, OR: [{ title: like }, { reference: like }] }, take })
      : [],
    can(user, 'compliance.view')
      ? db.ncr.findMany({ where: { company, OR: [{ ref: like }, { description: like }] }, take })
      : [],
    can(user, 'stock.view')
      ? db.product.findMany({ where: { company, OR: [{ code: like }, { name: like }] }, take })
      : [],
    can(user, 'purchaseOrders.view')
      ? db.purchaseOrder.findMany({ where: { company, number: like }, include: { supplier: true }, take })
      : [],
  ]);

  const results: Suggestion[] = [
    ...orders.map((o) => ({ type: 'Order', label: o.number, sublabel: o.customer.name, href: `/orders/${o.id}` })),
    ...customers.map((c) => ({ type: 'Customer', label: c.name, sublabel: c.town, href: `/customers/${c.id}` })),
    ...purchaseOrders.map((po) => ({ type: 'Purchase order', label: po.number, sublabel: po.supplier.name, href: `/purchase-orders/${po.id}` })),
    ...products.map((p) => ({ type: 'Product', label: p.code, sublabel: p.name, href: `/stock/${p.id}` })),
    ...batches.map((b) => ({ type: 'Cast', label: b.heatNumber, sublabel: b.product.name, href: `/compliance/trace?q=${b.heatNumber}` })),
    ...suppliers.map((s) => ({ type: 'Supplier', label: s.name, sublabel: s.approvedFor || undefined, href: '/compliance/suppliers' })),
    ...certificates.map((c) => ({ type: 'Certificate', label: c.title, sublabel: c.holder, href: '/compliance/certificates' })),
    ...ncrs.map((n) => ({ type: 'NCR', label: n.ref, sublabel: n.description.slice(0, 60), href: '/compliance/ncr' })),
    ...assets.map((a) => ({ type: 'Asset', label: a.ref, sublabel: a.name, href: `/assets/${a.id}` })),
  ].slice(0, 8);

  return NextResponse.json({ results });
}

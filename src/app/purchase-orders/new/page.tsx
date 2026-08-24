import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { NewPurchaseOrderForm } from './NewPurchaseOrderForm';

export default async function NewPurchaseOrderPage() {
  const user = await requirePermission('purchaseOrders.create');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ where: { company, blocked: false }, orderBy: { name: 'asc' } }),
    db.product.findMany({ where: { company, active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
  ]);

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders/new" alerts={alerts.length}>
      <Link href="/purchase-orders" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to purchase orders
      </Link>

      <PageHeader title="New purchase order" blurb="Starts as a draft — nothing is sent to the supplier until you mark it sent." />

      <NewPurchaseOrderForm
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        products={products.map((p) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit }))}
        showCosts={can(user, 'finance.costs')}
      />
    </Shell>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { creditBalances, getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { NewOrderForm } from './NewOrderForm';

export default async function NewOrderPage() {
  const user = await requirePermission('orders.create');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [customers, products, towns, balances] = await Promise.all([
    db.customer.findMany({ where: { company, status: { not: 'Closed' } }, orderBy: { name: 'asc' } }),
    db.product.findMany({
      where: { company, active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { prices: { where: { minQty: 0 }, orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    }),
    db.town.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    creditBalances(company),
  ]);

  const cutBent = products.find((p) => p.code === 'CB-SERVICE');

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders/new" alerts={alerts.length}>
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to orders
      </Link>

      <PageHeader title="New order" blurb="Starts as a draft — nothing is committed until you submit it." />

      <NewOrderForm
        customers={customers.map((c) => ({
          id: c.id, name: c.name, address: c.address, town: c.town,
          creditLimit: String(c.creditLimit), used: balances.get(c.id) ?? 0,
        }))}
        products={products.map((p) => ({
          id: p.id, name: p.name, code: p.code, category: p.category, unit: p.unit,
          kgPerUnit: String(p.kgPerUnit), price: Number(p.prices[0]?.unitPrice ?? 0),
        }))}
        towns={towns.map((t) => t.name)}
        cutBentPrice={0}
      />
    </Shell>
  );
}

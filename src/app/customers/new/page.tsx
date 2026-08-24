import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { CustomerForm } from '../CustomerForm';
import { createCustomer } from '../actions';

export default async function NewCustomerPage() {
  const user = await requirePermission('customers.edit');
  const [alerts, managers, towns] = await Promise.all([
    getAlerts(user),
    db.user.findMany({ where: { active: true, role: { in: ['MASTER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'] } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.town.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <Shell user={user} module="customers" nav={NAV.customers} current="/customers" alerts={alerts.length}>
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to customers
      </Link>
      <PageHeader title="Add customer" blurb="Open an account. You can raise orders against it straight away." />
      <CustomerForm user={user} action={createCustomer} managers={managers} towns={towns.map((t) => t.name)} submitLabel="Open the account" />
    </Shell>
  );
}

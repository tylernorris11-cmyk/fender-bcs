import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { CustomerForm } from '../../CustomerForm';
import { updateCustomer } from '../../actions';

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('customers.edit');
  const [alerts, customer, managers, towns] = await Promise.all([
    getAlerts(user),
    db.customer.findUnique({ where: { id: params.id } }),
    db.user.findMany({ where: { active: true, role: { in: ['MASTER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'OFFICE'] } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.town.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!customer) notFound();
  if (!user.companies.includes(customer.company)) notFound();

  return (
    <Shell user={user} module="customers" nav={NAV.customers} current="/customers" alerts={alerts.length}>
      <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to {customer.name}
      </Link>
      <PageHeader title={`Edit ${customer.name}`} blurb={customer.code} />
      <CustomerForm
        user={user}
        action={updateCustomer}
        managers={managers}
        towns={towns.map((t) => t.name)}
        submitLabel="Save changes"
        values={{
          id: customer.id, name: customer.name, contactName: customer.contactName, phone: customer.phone,
          email: customer.email, address: customer.address, town: customer.town, postcode: customer.postcode,
          paymentTerms: customer.paymentTerms, status: customer.status, accountManagerId: customer.accountManagerId,
          creditLimit: String(customer.creditLimit), notes: customer.notes,
        }}
      />
    </Shell>
  );
}

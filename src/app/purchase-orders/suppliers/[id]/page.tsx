import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { codeOptions } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { SupplierForm } from '../SupplierForm';
import { updateSupplier } from '../actions';

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('purchaseOrders.edit');
  const [alerts, supplier] = await Promise.all([getAlerts(user), db.supplier.findUnique({ where: { id: params.id } })]);
  if (!supplier || !user.companies.includes(supplier.company)) notFound();
  const codes = await codeOptions(supplier.company);

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders/suppliers" alerts={alerts.length}>
      <Link href="/purchase-orders/suppliers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to suppliers
      </Link>
      <PageHeader title={`Edit ${supplier.name}`} blurb={supplier.code ?? 'No account code yet'} />
      <SupplierForm
        user={user}
        action={updateSupplier}
        codes={codes}
        submitLabel="Save changes"
        values={{
          id: supplier.id, code: supplier.code, name: supplier.name, contactName: supplier.contactName, email: supplier.email,
          phone: supplier.phone, country: supplier.country, notes: supplier.notes,
          vatCodeId: supplier.vatCodeId, nominalCodeId: supplier.nominalCodeId,
        }}
      />
    </Shell>
  );
}

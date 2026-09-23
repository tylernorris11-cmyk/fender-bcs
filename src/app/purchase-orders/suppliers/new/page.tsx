import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { codeOptions } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { SupplierForm } from '../SupplierForm';
import { createSupplier } from '../actions';

export default async function NewSupplierPage() {
  const user = await requirePermission('purchaseOrders.edit');
  const [alerts, codes] = await Promise.all([getAlerts(user), codeOptions(getActiveCompany(user))]);

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders/suppliers" alerts={alerts.length}>
      <Link href="/purchase-orders/suppliers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to suppliers
      </Link>
      <PageHeader title="New supplier" />
      <SupplierForm user={user} action={createSupplier} codes={codes} submitLabel="Open the account" />
    </Shell>
  );
}

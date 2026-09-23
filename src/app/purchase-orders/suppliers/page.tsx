import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Table } from '@/components/ui';

export default async function SuppliersPage() {
  const user = await requirePermission('purchaseOrders.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canEdit = can(user, 'purchaseOrders.edit');
  const showLedger = can(user, 'accounts.view');

  const suppliers = await db.supplier.findMany({
    where: { company },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    include: { vatCode: true, nominalCode: true, _count: { select: { purchaseOrders: true } } },
  });

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders/suppliers" alerts={alerts.length}>
      <PageHeader
        title="Suppliers"
        blurb={`${COMPANY_LABEL[company]}'s supplier accounts, by Exchequer account code.`}
        actions={canEdit && <Link href="/purchase-orders/suppliers/new" className="btn-primary"><Plus size={16} /> New supplier</Link>}
      />
      <section className="card card-pad">
        {suppliers.length === 0 ? (
          <Empty title="No suppliers yet. They'll come across with the Exchequer import, or add one now." />
        ) : (
          <Table head={<>
            <th className="th">A/C</th><th className="th">Name</th><th className="th">Contact</th>
            {showLedger && <th className="th">VAT</th>}
            {showLedger && <th className="th">Nominal</th>}
            <th className="th text-right">Purchase orders</th>
          </>}>
            {suppliers.map((s) => (
              <tr key={s.id} className="row">
                <td className="td font-mono font-semibold">
                  {canEdit
                    ? <Link href={`/purchase-orders/suppliers/${s.id}`} className="text-brand-700 hover:underline">{s.code ?? 'No code'}</Link>
                    : s.code ?? '—'}
                </td>
                <td className="td">{s.name}</td>
                <td className="td text-ink-muted">{[s.contactName, s.phone, s.email].filter(Boolean).join(' · ') || '—'}</td>
                {showLedger && <td className="td font-mono">{s.vatCode?.code ?? '—'}</td>}
                {showLedger && <td className="td font-mono">{s.nominalCode?.code ?? '—'}</td>}
                <td className="td text-right tabular-nums">{s._count.purchaseOrders}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

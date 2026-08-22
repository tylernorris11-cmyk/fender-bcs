import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { creditBalances, getAlerts } from '@/lib/alerts';
import { orderTotals } from '@/lib/orders';
import { can } from '@/lib/rbac';
import { money, money0, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Meter, PageHeader, Pill, StagePill, Table } from '@/components/ui';
import { markPaid } from '@/app/orders/actions';

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('customers.view');
  const alerts = await getAlerts(user);

  const customer = await db.customer.findUnique({
    where: { id: params.id },
    include: {
      accountManager: true,
      documents: { orderBy: { uploadedAt: 'desc' } },
      orders: { include: { lines: true, barMarks: true }, orderBy: { createdAt: 'desc' } },
      ncrs: { orderBy: { raisedAt: 'desc' } },
    },
  });
  if (!customer) notFound();

  const used = (await creditBalances()).get(customer.id) ?? 0;
  const limit = Number(customer.creditLimit);

  return (
    <Shell user={user} module="customers" nav={NAV.customers} current="/customers" alerts={alerts.length}>
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        blurb={`${customer.code} · customer since ${shortDate(customer.customerSince)}`}
        actions={can(user, 'customers.edit') && (
          <Link href={`/customers/${customer.id}/edit`} className="btn-secondary"><Pencil size={16} /> Edit details</Link>
        )}
      />

      <section className="card card-pad grid gap-6 lg:grid-cols-[1fr_1fr_280px] mb-6">
        <dl className="text-sm space-y-2">
          <div><dt className="inline text-ink-muted">Contact: </dt><dd className="inline font-semibold">{customer.contactName}</dd></div>
          <div><dt className="inline text-ink-muted">Email: </dt><dd className="inline font-semibold">{customer.email}</dd></div>
          <div><dt className="inline text-ink-muted">Address: </dt><dd className="inline font-semibold">{customer.address}</dd></div>
          <div><dt className="inline text-ink-muted">Payment terms: </dt><dd className="inline font-semibold">{customer.paymentTerms}</dd></div>
        </dl>
        <dl className="text-sm space-y-2">
          <div><dt className="inline text-ink-muted">Phone: </dt><dd className="inline font-semibold">{customer.phone}</dd></div>
          <div><dt className="inline text-ink-muted">Account manager: </dt><dd className="inline font-semibold">{customer.accountManager?.name ?? 'Unassigned'}</dd></div>
          <div><dt className="inline text-ink-muted">Status: </dt><dd className="inline"><Pill tone={customer.status === 'Active' ? 'good' : 'warn'}>{customer.status}</Pill></dd></div>
        </dl>
        <div className="bg-canvas rounded-xl p-4">
          <p className="font-semibold mb-3">Credit</p>
          <Meter used={used} limit={limit} />
          <p className="text-sm text-ink-muted mt-2">{money0(used)} unpaid of a {money0(limit)} limit</p>
        </div>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Orders</h2>
        <Table head={<>
          <th className="th">Order</th><th className="th">Created</th><th className="th">Stage</th>
          <th className="th text-right">Total (ex VAT)</th><th className="th">Payment</th>
        </>}>
          {customer.orders.map((o) => (
            <tr key={o.id} className="row">
              <td className="td"><Link href={`/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link></td>
              <td className="td text-ink-muted">{shortDate(o.createdAt)}</td>
              <td className="td"><StagePill stage={o.stage} /></td>
              <td className="td text-right font-semibold tabular-nums">{money(orderTotals(o).net)}</td>
              <td className="td">
                {o.paymentStatus === 'PAID' ? (
                  <span className="flex items-center gap-2">
                    <Pill tone="good">Paid {shortDate(o.paidAt)}</Pill>
                    {can(user, 'orders.markPaid') && (
                      <form action={markPaid}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="undo" value="1" />
                        <button className="text-xs text-ink-faint hover:text-ink underline">undo</button>
                      </form>
                    )}
                  </span>
                ) : <Pill>Unpaid</Pill>}
              </td>
            </tr>
          ))}
          {customer.orders.length === 0 && <tr><td colSpan={5} className="td text-ink-muted">No orders yet.</td></tr>}
        </Table>
      </section>

      {customer.ncrs.length > 0 && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Complaints and non-conformances</h2>
          <ul className="space-y-3 text-sm">
            {customer.ncrs.map((n) => (
              <li key={n.id} className="flex gap-3 items-start">
                <Pill tone={n.status === 'OPEN' ? 'warn' : 'good'}>{n.ref}</Pill>
                <div>
                  <p>{n.description}</p>
                  <p className="text-xs text-ink-faint mt-0.5">Raised {shortDate(n.raisedAt)}{n.closedAt && ` · closed ${shortDate(n.closedAt)}`}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

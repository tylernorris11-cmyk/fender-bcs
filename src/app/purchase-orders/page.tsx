import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { poTotal, PO_STATUS_LABEL } from '@/lib/purchaseOrders';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { money, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader, Pill, SortTh, Stat, StatRow, Table } from '@/components/ui';

const STATUS_TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  DRAFT: 'neutral', SENT: 'info', CONFIRMED: 'warn', RECEIVED: 'good', CANCELLED: 'bad',
};

const FILTERS: { label: string; status?: PurchaseOrderStatus }[] = [
  { label: 'All' },
  { label: 'Draft', status: 'DRAFT' },
  { label: 'Sent', status: 'SENT' },
  { label: 'Confirmed', status: 'CONFIRMED' },
  { label: 'Received', status: 'RECEIVED' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: { searchParams: { status?: string; q?: string; sort?: string; dir?: string } }) {
  const user = await requirePermission('purchaseOrders.view');
  const alerts = await getAlerts(user);
  const showCosts = can(user, 'finance.costs');
  const company = getActiveCompany(user);

  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status as PurchaseOrderStatus | undefined;
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';

  const where: Prisma.PurchaseOrderWhereInput = {
    company,
    ...(status ? { status } : {}),
    ...(q
      ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { supplier: { name: { contains: q, mode: 'insensitive' } } }] }
      : {}),
  };

  const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput =
    searchParams.sort === 'number' ? { number: dir }
    : searchParams.sort === 'supplier' ? { supplier: { name: dir } }
    : searchParams.sort === 'status' ? { status: dir }
    : searchParams.sort === 'expectedDate' ? { expectedDate: dir }
    : { createdAt: 'desc' };

  const [purchaseOrders, counts] = await Promise.all([
    db.purchaseOrder.findMany({ where, include: { supplier: true, raisedBy: true, lines: true }, orderBy, take: 200 }),
    db.purchaseOrder.groupBy({ by: ['status'], where: { company }, _count: true }),
  ]);

  const countOf = (s: PurchaseOrderStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  return (
    <Shell user={user} module="purchaseOrders" nav={NAV.purchaseOrders} current="/purchase-orders" alerts={alerts.length}>
      <PageHeader
        title="Purchase orders"
        blurb="Orders placed with suppliers to buy steel and materials."
        actions={
          can(user, 'purchaseOrders.create') && (
            <Link href="/purchase-orders/new" className="btn-primary"><Plus size={16} /> New purchase order</Link>
          )
        }
      />

      <StatRow>
        <Stat value={total} label="All purchase orders" href="/purchase-orders" />
        <Stat value={countOf('DRAFT')} label="Drafts" href="/purchase-orders?status=DRAFT" />
        <Stat value={countOf('SENT')} label="Sent" tone={countOf('SENT') ? 'warn' : 'default'} href="/purchase-orders?status=SENT" />
        <Stat value={countOf('CONFIRMED')} label="Confirmed" href="/purchase-orders?status=CONFIRMED" />
      </StatRow>

      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const active = (f.status ?? undefined) === status;
          const href = f.status ? `/purchase-orders?status=${f.status}` : '/purchase-orders';
          return (
            <Link key={f.label} href={href}
              className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${
                active ? 'bg-brand text-white border-brand' : 'bg-white border-hairline hover:bg-canvas'
              }`}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      <section className="card card-pad">
        <form className="flex flex-wrap gap-3 mb-5">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} className="input flex-1 min-w-[240px]"
                 placeholder="Search PO number or supplier…" aria-label="Search purchase orders" />
          <button className="btn-secondary">Search</button>
        </form>

        {purchaseOrders.length === 0 ? (
          <Empty title="No purchase orders match that." action={<Link href="/purchase-orders" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <Table
            head={
              <>
                <SortTh label="PO" field="number" basePath="/purchase-orders" searchParams={searchParams} />
                <SortTh label="Supplier" field="supplier" basePath="/purchase-orders" searchParams={searchParams} />
                <SortTh label="Status" field="status" basePath="/purchase-orders" searchParams={searchParams} />
                {showCosts && <th className="th text-right">Value</th>}
                <SortTh label="Expected" field="expectedDate" basePath="/purchase-orders" searchParams={searchParams} />
                <th className="th">Raised by</th>
              </>
            }
          >
            {purchaseOrders.map((po) => (
              <tr key={po.id} className="row">
                <td className="td">
                  <Link href={`/purchase-orders/${po.id}`} className="font-semibold text-brand-700 hover:underline">{po.number}</Link>
                </td>
                <td className="td">{po.supplier.name}</td>
                <td className="td"><Pill tone={STATUS_TONE[po.status]}>{PO_STATUS_LABEL[po.status]}</Pill></td>
                {showCosts && <td className="td text-right font-semibold tabular-nums">{money(poTotal(po))}</td>}
                <td className="td text-ink-muted whitespace-nowrap">{shortDate(po.expectedDate)}</td>
                <td className="td">
                  {po.raisedBy && (
                    <span className="flex items-center gap-2">
                      <Avatar name={po.raisedBy.name} colour={po.raisedBy.colour} size={26} />
                      <span className="text-ink-muted">{po.raisedBy.name}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </Shell>
  );
}

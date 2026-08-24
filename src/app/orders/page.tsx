import Link from 'next/link';
import { Archive, Download, Plus } from 'lucide-react';
import type { OrderStage, Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts, creditBalances } from '@/lib/alerts';
import { orderTotals } from '@/lib/orders';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { money, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader, Pill, SortTh, StagePill, Stat, StatRow, Table } from '@/components/ui';
import { archiveOrder } from './actions';

const FILTERS: { label: string; stage?: OrderStage }[] = [
  { label: 'All' },
  { label: 'Draft', stage: 'DRAFT' },
  { label: 'Pending approval', stage: 'PENDING_APPROVAL' },
  { label: 'Approved', stage: 'APPROVED' },
  { label: 'In production', stage: 'IN_PRODUCTION' },
  { label: 'Ready for delivery', stage: 'READY_FOR_DELIVERY' },
  { label: 'Out for delivery', stage: 'OUT_FOR_DELIVERY' },
  { label: 'Delivered', stage: 'DELIVERED' },
  { label: 'Completed', stage: 'COMPLETED' },
];

export default async function OrdersPage({
  searchParams,
}: { searchParams: { stage?: string; q?: string; archived?: string; sort?: string; dir?: string; depot?: string } }) {
  const user = await requirePermission('orders.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const locations = await db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  const showArchived = searchParams.archived === '1';
  const q = (searchParams.q ?? '').trim();
  const stage = searchParams.stage as OrderStage | undefined;
  const depot = searchParams.depot;

  const where: Prisma.OrderWhereInput = {
    company,
    ...(showArchived ? {} : { archived: false }),
    ...(stage ? { stage } : {}),
    ...(depot ? { depot } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { poNumber: { contains: q, mode: 'insensitive' } },
            { town: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.OrderOrderByWithRelationInput =
    searchParams.sort === 'number' ? { number: dir }
    : searchParams.sort === 'customer' ? { customer: { name: dir } }
    : searchParams.sort === 'town' ? { town: dir }
    : searchParams.sort === 'depot' ? { depot: dir }
    : searchParams.sort === 'stage' ? { stage: dir }
    : searchParams.sort === 'deliveryDate' ? { deliveryDate: dir }
    : searchParams.sort === 'raisedBy' ? { raisedBy: { name: dir } }
    : { createdAt: 'desc' };

  const [orders, counts, balances] = await Promise.all([
    db.order.findMany({
      where,
      include: { customer: true, raisedBy: true, lines: true, barMarks: true },
      orderBy,
      take: 200,
    }),
    db.order.groupBy({ by: ['stage'], where: { company, archived: false, ...(depot ? { depot } : {}) }, _count: true }),
    creditBalances(company),
  ]);

  // weight/total aren't real columns — they're summed from lines/barMarks — so
  // sort the fetched page in memory when one of those is asked for.
  if (searchParams.sort === 'weight' || searchParams.sort === 'total') {
    const key = searchParams.sort;
    orders.sort((a, b) => {
      const va = key === 'weight' ? orderTotals(a).weightKg : orderTotals(a).net;
      const vb = key === 'weight' ? orderTotals(b).weightKg : orderTotals(b).net;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }

  const countOf = (s: OrderStage) => counts.find((c) => c.stage === s)?._count ?? 0;
  const total = counts.reduce((sum, c) => sum + c._count, 0);
  const overLimit = new Set(
    (await db.customer.findMany({ where: { company }, select: { id: true, creditLimit: true } }))
      .filter((c) => Number(c.creditLimit) > 0 && (balances.get(c.id) ?? 0) > Number(c.creditLimit))
      .map((c) => c.id),
  );

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders" alerts={alerts.length}>
      <PageHeader
        title="Orders"
        blurb="Every order from draft through to completed."
        actions={
          <>
            {can(user, 'orders.export') && (
              <a href="/orders/export" className="btn-secondary"><Download size={16} /> Export all orders</a>
            )}
            {can(user, 'orders.create') && (
              <Link href="/orders/new" className="btn-primary"><Plus size={16} /> New order</Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6 mb-6">
        <Stat value={total} label="All orders" href="/orders" />
        <Stat value={countOf('DRAFT')} label="Drafts" href="/orders?stage=DRAFT" />
        <Stat value={countOf('PENDING_APPROVAL')} label="Awaiting approval" tone={countOf('PENDING_APPROVAL') ? 'warn' : 'default'} href="/orders?stage=PENDING_APPROVAL" />
        <Stat value={countOf('IN_PRODUCTION') + countOf('READY_FOR_DELIVERY')} label="In the yard" href="/orders?stage=READY_FOR_DELIVERY" />
        <Stat value={countOf('OUT_FOR_DELIVERY')} label="Out for delivery" href="/orders?stage=OUT_FOR_DELIVERY" />
        <Stat value={overLimit.size} label="Over credit limit" tone={overLimit.size ? 'bad' : 'default'} href="/customers" />
      </div>

      <nav className="flex flex-wrap gap-2 mb-3" aria-label="Filter by stage">
        {FILTERS.map((f) => {
          const active = (f.stage ?? undefined) === stage;
          const params = new URLSearchParams();
          if (f.stage) params.set('stage', f.stage);
          if (depot) params.set('depot', depot);
          const href = params.size ? `/orders?${params}` : '/orders';
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

      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Filter by depot">
        {(() => {
          const params = new URLSearchParams();
          if (stage) params.set('stage', stage);
          const href = params.size ? `/orders?${params}` : '/orders';
          return (
            <Link href={href} className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${!depot ? 'bg-forest text-white border-forest' : 'bg-white border-hairline hover:bg-canvas'}`}>
              Both depots
            </Link>
          );
        })()}
        {locations.map((l) => {
          const params = new URLSearchParams();
          if (stage) params.set('stage', stage);
          params.set('depot', l.name);
          return (
            <Link key={l.id} href={`/orders?${params}`}
              className={`rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${depot === l.name ? 'bg-forest text-white border-forest' : 'bg-white border-hairline hover:bg-canvas'}`}>
              {l.name}
            </Link>
          );
        })}
      </nav>

      <section className="card card-pad">
        <form className="flex flex-wrap gap-3 mb-5">
          {stage && <input type="hidden" name="stage" value={stage} />}
          {depot && <input type="hidden" name="depot" value={depot} />}
          <input name="q" defaultValue={q} className="input flex-1 min-w-[240px]"
                 placeholder="Search order number, customer, PO or town…" aria-label="Search orders" />
          <label className="flex items-center gap-2.5 text-sm font-medium px-4 rounded-xl border border-hairline bg-white cursor-pointer">
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived}
                   className="h-4 w-4 accent-brand" />
            Show archived
          </label>
          <button className="btn-secondary">Apply</button>
        </form>

        {orders.length === 0 ? (
          <Empty title="No orders match that." action={<Link href="/orders" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <Table
            head={
              <>
                <SortTh label="Order" field="number" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Customer" field="customer" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Town" field="town" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Depot" field="depot" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Stage" field="stage" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Weight" field="weight" basePath="/orders" searchParams={searchParams} align="right" />
                <SortTh label="Total (ex VAT)" field="total" basePath="/orders" searchParams={searchParams} align="right" />
                <SortTh label="Delivery" field="deliveryDate" basePath="/orders" searchParams={searchParams} />
                <SortTh label="Raised by" field="raisedBy" basePath="/orders" searchParams={searchParams} />
                <th className="th sr-only">Archive</th>
              </>
            }
          >
            {orders.map((o) => {
              const { net, weightKg } = orderTotals(o);
              return (
                <tr key={o.id} className={`row ${o.archived ? 'opacity-55' : ''}`}>
                  <td className="td">
                    <Link href={`/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link>
                    <div className="flex gap-1.5 mt-1">
                      {overLimit.has(o.customerId) && o.paymentStatus === 'UNPAID' && <Pill tone="bad">Over limit</Pill>}
                      {o.archived && <Pill>Archived</Pill>}
                    </div>
                  </td>
                  <td className="td">{o.customer.name}</td>
                  <td className="td text-ink-muted">{o.town || '—'}</td>
                  <td className="td text-ink-muted">{o.depot}</td>
                  <td className="td"><StagePill stage={o.stage} /></td>
                  <td className="td text-right tabular-nums">{tonnes(weightKg)}</td>
                  <td className="td text-right font-semibold tabular-nums">{money(net)}</td>
                  <td className="td text-ink-muted whitespace-nowrap">{shortDate(o.deliveryDate)}</td>
                  <td className="td">
                    {o.raisedBy && (
                      <span className="flex items-center gap-2">
                        <Avatar name={o.raisedBy.name} colour={o.raisedBy.colour} size={26} />
                        <span className="text-ink-muted">{o.raisedBy.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="td text-right">
                    {can(user, 'orders.archive') && (
                      <form action={archiveOrder}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button className="text-ink-faint hover:text-ink p-1.5" title={o.archived ? 'Restore order' : 'Archive order'}>
                          <Archive size={16} />
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </Shell>
  );
}

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { creditBalances, getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { money, money0 } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, Meter, PageHeader, SortTh, Stat, StatRow, Table } from '@/components/ui';

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string; sort?: string; dir?: string } }) {
  const user = await requirePermission('customers.view');
  const company = getActiveCompany(user);
  const [alerts, balances] = await Promise.all([getAlerts(user), creditBalances(company)]);
  const q = (searchParams.q ?? '').trim();
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';

  const customers = await db.customer.findMany({
    where: {
      company,
      ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
          { town: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ] } : {}),
    },
    orderBy:
      searchParams.sort === 'town' ? { town: dir }
      : searchParams.sort === 'limit' ? { creditLimit: dir }
      : { name: searchParams.sort === 'name' ? dir : 'asc' },
  });

  const totalUsed = [...balances.values()].reduce((a, b) => a + b, 0);
  const nearLimit = customers.filter((c) => {
    const limit = Number(c.creditLimit);
    const used = balances.get(c.id) ?? 0;
    return limit > 0 && used / limit >= 0.8;
  }).length;

  return (
    <Shell user={user} module="customers" nav={NAV.customers} current="/customers" alerts={alerts.length}>
      <PageHeader
        title="Customers"
        blurb="Accounts, contacts and credit."
        actions={can(user, 'customers.edit') && (
          <Link href="/customers/new" className="btn-primary"><Plus size={16} /> Add customer</Link>
        )}
      />

      <StatRow>
        <Stat value={customers.length} label="Customers" />
        <Stat value={customers.filter((c) => c.status === 'Active').length} label="Active accounts" tone="good" />
        <Stat value={money0(totalUsed)} label="Credit in use" />
        <Stat value={nearLimit} label="Near credit limit" tone={nearLimit ? 'warn' : 'default'} />
      </StatRow>

      <section className="card card-pad">
        <form className="mb-5">
          <input name="q" defaultValue={q} className="input max-w-md" placeholder="Search name, contact or town…" aria-label="Search customers" />
        </form>

        {customers.length === 0 ? <Empty title="No customers match that." /> : (
          <Table head={<>
            <SortTh label="Customer" field="name" basePath="/customers" searchParams={searchParams} />
            <th className="th">Contact</th>
            <SortTh label="Town" field="town" basePath="/customers" searchParams={searchParams} />
            <th className="th">Credit used</th>
            <SortTh label="Limit" field="limit" basePath="/customers" searchParams={searchParams} align="right" />
          </>}>
            {customers.map((c) => {
              const used = balances.get(c.id) ?? 0;
              const limit = Number(c.creditLimit);
              return (
                <tr key={c.id} className="row">
                  <td className="td">
                    <Link href={`/customers/${c.id}`} className="font-semibold text-brand-700 hover:underline">{c.name}</Link>
                    <span className="block text-xs text-ink-faint">{c.code}</span>
                  </td>
                  <td className="td">
                    {c.contactName}
                    <span className="block text-xs text-ink-faint">{c.phone}</span>
                  </td>
                  <td className="td text-ink-muted">{c.town}</td>
                  <td className="td w-64">
                    <Meter used={used} limit={limit} />
                    <span className="block text-xs text-ink-faint mt-1.5">{money0(used)} of {money0(limit)}</span>
                  </td>
                  <td className="td text-right font-semibold tabular-nums">{money0(limit)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </Shell>
  );
}

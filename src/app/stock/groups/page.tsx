import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { groupPaths } from '@/lib/stockGroups';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addStockGroup, updateStockGroup } from '../actions';

export default async function StockGroupsPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canEdit = can(user, 'stock.adjust');

  const groups = groupPaths(await db.stockGroup.findMany({
    where: { company },
    include: { _count: { select: { products: true } } },
  }));

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/groups" alerts={alerts.length}>
      <PageHeader
        title="Stock groups"
        blurb={`${COMPANY_LABEL[company]}'s stock groups, the same as Exchequer's. Groups can sit inside other groups.`}
      />

      {canEdit && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Add a group</h2>
          <form action={addStockGroup} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="new-code">Group code</label>
              <input id="new-code" name="code" maxLength={21} className="input w-36 font-mono uppercase" placeholder="Optional" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="new-name">Name</label>
              <input id="new-name" name="name" required className="input" placeholder="B500B straight bar" />
            </div>
            <div>
              <label className="label" htmlFor="new-parent">Inside</label>
              <select id="new-parent" name="parentId" defaultValue="" className="input w-64">
                <option value="">Top level</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.path}</option>)}
              </select>
            </div>
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {groups.length === 0 ? (
          <Empty title="No stock groups yet." />
        ) : (
          <ul className="divide-y divide-hairline">
            {groups.map((g) => (
              <li key={g.id} className="py-2.5" style={{ paddingLeft: `${g.depth * 1.5}rem` }}>
                {canEdit ? (
                  <form action={updateStockGroup} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="stockGroupId" value={g.id} />
                    <input name="code" defaultValue={g.code ?? ''} maxLength={21} aria-label={`Code for ${g.name}`}
                           className="input w-32 py-1.5 font-mono uppercase" placeholder="No code" />
                    <input name="name" defaultValue={g.name} required aria-label={`Name for ${g.name}`} className="input flex-1 min-w-[180px] py-1.5" />
                    <span className="text-xs text-ink-faint w-24 text-right">{g._count.products} {g._count.products === 1 ? 'item' : 'items'}</span>
                    <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-ink-muted w-32">{g.code ?? '—'}</span>
                    <span className="font-semibold flex-1">{g.name}</span>
                    <span className="text-xs text-ink-faint">{g._count.products} {g._count.products === 1 ? 'item' : 'items'}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { feetInches, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Stat, StatRow, Table } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { adjustStockLength } from './actions';

export default async function StockLengthsPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="stock" nav={NAV.stock} current="/stock/lengths" alerts={alerts.length}>
        <PageHeader title="Stock Lengths" />
        <div className="banner-warn">Stock lengths are a BCS Products thing — Fender doesn&apos;t use this.</div>
      </Shell>
    );
  }

  const lengths = await db.stockLength.findMany({
    where: { company },
    orderBy: [{ lengthFt: 'asc' }, { lengthIn: 'asc' }, { thicknessMm: 'asc' }],
  });

  const canAdjust = can(user, 'stock.adjust');
  const totalWeightKg = lengths.reduce((s, l) => s + Number(l.weightKg), 0);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/lengths" alerts={alerts.length}>
      <PageHeader
        title="Stock Lengths"
        blurb="Steel rod cut ahead of any specific order and held ready in the yard, by weight. Add to it from Production — Produce stock lengths."
      />

      <StatRow>
        <Stat value={lengths.length} label="Lengths in stock" />
        <Stat value={tonnes(totalWeightKg)} label="Total weight" />
      </StatRow>

      <section className="card card-pad mb-6">
        {lengths.length === 0 ? (
          <Empty title="Nothing in stock yet — produce some from Production." />
        ) : (
          <Table head={<>
            <th className="th">Length</th><th className="th">Thickness</th>
            <th className="th">In stock</th><th className="th">Last updated</th>
          </>}>
            {lengths.map((l) => (
              <tr key={l.id} className="row">
                <td className="td font-semibold">{feetInches(l.lengthFt, l.lengthIn)}</td>
                <td className="td text-ink-muted">{Number(l.thicknessMm)}mm</td>
                <td className="td font-semibold">{tonnes(l.weightKg)}</td>
                <td className="td text-ink-muted">{shortDate(l.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {canAdjust && (
        <section className="card card-pad max-w-2xl">
          <h2 className="text-lg font-bold mb-1">Adjust</h2>
          <p className="text-sm text-ink-muted mb-4">A stock check, a damaged bundle written off — anything that isn&apos;t a fresh cut from Production.</p>
          <form action={adjustStockLength} className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="lengthFt">Length (ft)</label>
                <input id="lengthFt" name="lengthFt" type="number" min="1" step="1" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="lengthIn">+ inches</label>
                <input id="lengthIn" name="lengthIn" type="number" min="0" max="11" step="1" defaultValue={0} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="thicknessMm">Thickness (mm)</label>
              <input id="thicknessMm" name="thicknessMm" type="number" min="0" step="0.1" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="weightKgDelta">Change (kg)</label>
              <input id="weightKgDelta" name="weightKgDelta" type="number" step="0.1" required className="input" placeholder="-25 or 100" />
              <p className="hint">Negative to take off, positive to add.</p>
            </div>
            <div>
              <label className="label" htmlFor="note">Reason</label>
              <input id="note" name="note" required className="input" placeholder="Stock check" />
            </div>
            <div className="flex items-end"><SubmitButton pendingLabel="Saving…">Save</SubmitButton></div>
          </form>
        </section>
      )}
    </Shell>
  );
}

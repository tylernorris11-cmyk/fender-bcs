import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { codeOptions } from '@/lib/ledger';
import { groupPaths } from '@/lib/stockGroups';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { CodeSelect, NoCodesYet } from '@/components/CodeSelect';
import { createProduct } from '../actions';

export default async function NewProductPage() {
  const user = await requirePermission('stock.adjust');
  const company = getActiveCompany(user);
  const [alerts, groups, suppliers, codes] = await Promise.all([
    getAlerts(user),
    db.stockGroup.findMany({ where: { company } }),
    db.supplier.findMany({ where: { company }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
    codeOptions(company),
  ]);
  const isFender = company === 'FENDER';

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock" alerts={alerts.length}>
      <Link href="/stock" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to stock
      </Link>

      <PageHeader title="Add a product" blurb="Sets up the catalogue entry — book some in afterwards from Goods in, and set a price from Set Up." />

      <form action={createProduct} className="card card-pad grid gap-5 sm:grid-cols-2 max-w-3xl">
        <div>
          <label className="label" htmlFor="code">Stock code</label>
          <input id="code" name="code" required maxLength={21} className="input font-mono uppercase" placeholder={isFender ? 'RB12-500B' : 'FP-6-3'} />
          <p className="hint">The Exchequer stock code. It shows on orders and delivery notes.</p>
        </div>

        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" placeholder={isFender ? 'Rebar 12mm B500B' : "Fence post 6'0\" x 3mm"} />
        </div>

        <div>
          <label className="label" htmlFor="stockGroupId">Stock group</label>
          <select id="stockGroupId" name="stockGroupId" required defaultValue="" className="input">
            <option value="" disabled>Choose…</option>
            {groupPaths(groups).map((g) => <option key={g.id} value={g.id}>{g.path}</option>)}
          </select>
          <p className="hint"><Link href="/stock/groups" className="underline">Add or rename groups</Link></p>
        </div>

        <div>
          <label className="label" htmlFor="preferredSupplierId">Preferred supplier</label>
          <select id="preferredSupplierId" name="preferredSupplierId" defaultValue="" className="input">
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} ` : ''}{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="unit">Sold by</label>
          <select id="unit" name="unit" defaultValue="t" className="input">
            <option value="t">Tonnes (t)</option>
            <option value="each">Each</option>
            <option value="sheets">Sheets</option>
            <option value="m">Metres (m)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="kgPerUnit">Weight per unit (kg)</label>
          <input id="kgPerUnit" name="kgPerUnit" type="number" step="0.001" min="0" defaultValue="1000" className="input" />
          <p className="hint">Used to work out delivery weights — 1000 if it&apos;s already sold by the tonne.</p>
        </div>

        {isFender ? (
          <>
            <div>
              <label className="label" htmlFor="standard">Standard</label>
              <input id="standard" name="standard" className="input" placeholder="BS 4449:2005 B500B" />
            </div>

            <div>
              <label className="label" htmlFor="reorderAt">Reorder point</label>
              <input id="reorderAt" name="reorderAt" type="number" step="0.001" min="0" defaultValue="0" className="input" />
              <p className="hint">Flags as low stock once what&apos;s available drops to this or below. Leave at 0 to skip.</p>
            </div>

            <div className="flex items-center gap-2.5 sm:col-span-2">
              <input id="isRebar" name="isRebar" type="checkbox" value="1" className="h-4 w-4 accent-brand" />
              <label htmlFor="isRebar" className="text-sm font-medium">Reinforcement — drives cast traceability and FIFO batch picking</label>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">Length</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input name="lengthFt" type="number" min="0" step="1" className="input" placeholder="6" aria-label="Feet" />
                  <p className="hint">Feet</p>
                </div>
                <div className="flex-1">
                  <input name="lengthIn" type="number" min="0" max="11" step="1" className="input" placeholder="0" aria-label="Inches" />
                  <p className="hint">Inches</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="thicknessMm">Thickness (mm)</label>
              <input id="thicknessMm" name="thicknessMm" type="number" min="0" step="0.1" className="input" placeholder="3" />
            </div>

            <div>
              <label className="label" htmlFor="bundleWeightKg">Weight per bundle (kg)</label>
              <input id="bundleWeightKg" name="bundleWeightKg" type="number" min="0" step="0.1" className="input" placeholder="500" />
              <p className="hint">For reference on the yard — orders are still placed in half tonnes or tonnes.</p>
            </div>

            <div>
              <label className="label" htmlFor="reorderAt">Reorder point</label>
              <input id="reorderAt" name="reorderAt" type="number" step="0.001" min="0" defaultValue="0" className="input" />
              <p className="hint">Flags as low stock once what&apos;s available drops to this or below. Leave at 0 to skip.</p>
            </div>
          </>
        )}

        {can(user, 'accounts.setup') && (
          <fieldset className="sm:col-span-2 grid gap-5 sm:grid-cols-2 border-t border-hairline pt-5">
            <legend className="text-sm font-bold mb-3">Accounts</legend>
            {codes.vatCodes.length + codes.nominalCodes.length === 0 ? <NoCodesYet /> : (
              <>
                <CodeSelect name="vatCodeId" label="VAT code" options={codes.vatCodes} />
                <CodeSelect name="salesNominalId" label="Sales nominal code" options={codes.nominalCodes} />
                <CodeSelect name="costOfSalesNominalId" label="Cost of sales nominal code" options={codes.nominalCodes} />
                <CodeSelect name="stockNominalId" label="Stock value nominal code" options={codes.nominalCodes} />
              </>
            )}
          </fieldset>
        )}

        <div><button className="btn-primary">Add product</button></div>
      </form>
    </Shell>
  );
}

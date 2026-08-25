import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { createProduct } from '../actions';

export default async function NewProductPage() {
  const user = await requirePermission('stock.adjust');
  const alerts = await getAlerts(user);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock" alerts={alerts.length}>
      <Link href="/stock" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to stock
      </Link>

      <PageHeader title="Add a product" blurb="Sets up the catalogue entry — book some in afterwards from Goods in, and set a price from Set Up." />

      <form action={createProduct} className="card card-pad grid gap-5 sm:grid-cols-2 max-w-3xl">
        <div>
          <label className="label" htmlFor="code">Product code</label>
          <input id="code" name="code" required className="input" placeholder="RB12-500B" />
          <p className="hint">Unique — this is what shows on orders and delivery notes.</p>
        </div>

        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" placeholder="Rebar 12mm B500B" />
        </div>

        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" required className="input" placeholder="Reinforcing bar" />
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

        <div><button className="btn-primary">Add product</button></div>
      </form>
    </Shell>
  );
}

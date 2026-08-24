import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { receiveBatch } from '../actions';

export default async function GoodsInPage({ searchParams }: { searchParams: { product?: string } }) {
  const user = await requirePermission('stock.goodsIn');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const showCosts = can(user, 'finance.costs');
  const caresApplies = company === 'FENDER';

  const [products, suppliers, locations] = await Promise.all([
    db.product.findMany({ where: { company, active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.supplier.findMany({ where: { company, blocked: false }, orderBy: { name: 'asc' }, include: { certificates: { where: { scheme: 'Supplier' } } } }),
    db.location.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/goods-in" alerts={alerts.length}>
      <Link href="/stock" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to stock
      </Link>

      <PageHeader
        title={caresApplies ? 'Book steel in' : 'Book stock in'}
        blurb={caresApplies
          ? 'One batch per cast. The cast number and mill certificate are what make the delivery traceable.'
          : 'One line per delivery.'}
      />

      <form action={receiveBatch} className="card card-pad grid gap-5 sm:grid-cols-2 max-w-3xl">
        <div>
          <label className="label" htmlFor="productId">Product</label>
          <select id="productId" name="productId" required defaultValue={searchParams.product ?? ''} className="input">
            <option value="" disabled>Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="supplierId">Supplier</label>
          <select id="supplierId" name="supplierId" required defaultValue="" className="input">
            <option value="" disabled>Choose a supplier…</option>
            {suppliers.map((s) => {
              const approved = s.certificates.some((c) => c.expiresOn > new Date());
              return <option key={s.id} value={s.id}>{s.name}{caresApplies && !approved ? ' — no CARES approval on file' : ''}</option>;
            })}
          </select>
          {caresApplies && (
            <p className="hint">Reinforcement may only be bought from CARES-approved manufacturers. Anything from a supplier without an in-date approval lands quarantined.</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="heatNumber">{caresApplies ? 'Cast / heat number' : 'Batch / delivery reference'}</label>
          <input id="heatNumber" name="heatNumber" required className="input" placeholder={caresApplies ? 'H260503' : 'DN-4471'} />
        </div>

        <div>
          <label className="label" htmlFor="qty">Quantity received</label>
          <input id="qty" name="qty" type="number" step="0.001" min="0" required className="input" placeholder="28.000" />
        </div>

        {caresApplies && (
          <>
            <div>
              <label className="label" htmlFor="certNumber">Mill certificate number</label>
              <input id="certNumber" name="certNumber" className="input" placeholder="CERT-26-1503" />
            </div>

            <div>
              <label className="label" htmlFor="millCertUrl">Mill certificate file (link)</label>
              <input id="millCertUrl" name="millCertUrl" type="url" className="input" placeholder="https://…/MTC_H260503.pdf" />
              <p className="hint">No certificate means no release. Book it in anyway and it sits quarantined until the paperwork lands.</p>
            </div>
          </>
        )}

        <div>
          <label className="label" htmlFor="deliveryNote">Supplier delivery note</label>
          <input id="deliveryNote" name="deliveryNote" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="depot">Depot</label>
          <select id="depot" name="depot" defaultValue={locations[0]?.name ?? 'Scunthorpe'} className="input">
            {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="location">Yard location</label>
          <input id="location" name="location" className="input" placeholder="Yard B2" />
        </div>

        <div>
          <label className="label" htmlFor="receivedAt">Date received</label>
          <input id="receivedAt" name="receivedAt" type="date" className="input" />
        </div>

        {showCosts && (
          <div>
            <label className="label" htmlFor="unitCost">Unit cost paid (£)</label>
            <input id="unitCost" name="unitCost" type="number" step="0.01" min="0" className="input" placeholder="690.00" />
            <p className="hint">What we actually paid per tonne — only visible to finance.</p>
          </div>
        )}

        <div className="sm:col-span-2 flex gap-3">
          <button className="btn-primary">Book it in</button>
          <Link href="/stock" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </Shell>
  );
}

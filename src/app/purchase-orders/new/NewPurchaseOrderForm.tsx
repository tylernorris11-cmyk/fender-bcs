'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createPurchaseOrder } from '../actions';

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; code: string; unit: string };
type Line = { key: number; productId: string; description: string; qty: string; unitCost: string };

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });

let seq = 0;
const newLine = (): Line => ({ key: seq++, productId: '', description: '', qty: '', unitCost: '' });

export function NewPurchaseOrderForm({
  suppliers, products, showCosts,
}: { suppliers: Supplier[]; products: Product[]; showCosts: boolean }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unitCost || 0), 0),
    [lines],
  );

  function onProductChange(key: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, productId, description: p ? p.name : l.description } : l)));
  }

  return (
    <form action={createPurchaseOrder} className="space-y-6">
      <section className="card card-pad grid gap-6 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="supplierId">Supplier</label>
          <select id="supplierId" name="supplierId" required value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)} className="input">
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expectedDate">Expected delivery date</label>
          <input id="expectedDate" name="expectedDate" type="date" className="input" />
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold">Lines</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">What you&apos;re ordering from this supplier.</p>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const lineTotal = Number(line.qty || 0) * Number(line.unitCost || 0);
            return (
              <div
                key={line.key}
                className={`grid gap-3 items-end bg-canvas rounded-xl p-3 ${
                  showCosts ? 'md:grid-cols-[1fr_1fr_110px_130px_120px_44px]' : 'md:grid-cols-[1fr_1fr_110px_44px]'
                }`}
              >
                <div>
                  <label className="label text-xs" htmlFor={`prod-${line.key}`}>Product (optional)</label>
                  <select id={`prod-${line.key}`} name={`line[${i}][productId]`} value={line.productId}
                          onChange={(e) => onProductChange(line.key, e.target.value)} className="input">
                    <option value="">—</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs" htmlFor={`desc-${line.key}`}>Description</label>
                  <input id={`desc-${line.key}`} name={`line[${i}][description]`} value={line.description}
                         onChange={(e) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, description: e.target.value } : l)))}
                         className="input" placeholder="e.g. 12mm B500B rebar" />
                </div>
                <div>
                  <label className="label text-xs" htmlFor={`qty-${line.key}`}>Qty (t)</label>
                  <input id={`qty-${line.key}`} name={`line[${i}][qty]`} type="number" step="0.001" min="0" placeholder="0"
                         value={line.qty} onChange={(e) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, qty: e.target.value } : l)))}
                         className="input" />
                </div>
                {showCosts && (
                  <>
                    <div>
                      <label className="label text-xs" htmlFor={`cost-${line.key}`}>Cost per unit (£)</label>
                      <input id={`cost-${line.key}`} name={`line[${i}][unitCost]`} type="number" step="0.01" min="0" placeholder="0.00"
                             value={line.unitCost} onChange={(e) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, unitCost: e.target.value } : l)))}
                             className="input" />
                    </div>
                    <div className="text-right">
                      <span className="label text-xs">Line total</span>
                      <p className="font-bold tabular-nums py-2.5">{gbp(lineTotal)}</p>
                    </div>
                  </>
                )}
                <button type="button" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="btn-ghost p-2.5 mb-1" aria-label="Remove this line">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={() => setLines((p) => [...p, newLine()])} className="btn-secondary mt-4">
          <Plus size={16} /> Add another line
        </button>

        {showCosts && (
          <div className="flex justify-end pt-5 mt-5 border-t border-hairline text-sm">
            <span>Total <strong className="text-base">{gbp(total)}</strong></span>
          </div>
        )}
      </section>

      <section className="card card-pad">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Anything the supplier or goods-in should know" />
        <button type="submit" className="btn-primary mt-4">Save as draft</button>
        <p className="hint">You can mark it sent, confirmed or received from the purchase order page.</p>
      </section>
    </form>
  );
}

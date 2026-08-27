'use client';

import { useMemo, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { SHAPE_CODES, BAR_SIZES, MASS_PER_M } from '@/lib/bs8666';
import { createOrder } from '../actions';

type Customer = { id: string; name: string; address: string; town: string; creditLimit: string; used: number };
type Product = { id: string; name: string; code: string; category: string; unit: string; kgPerUnit: string; price: number };

type Line = { key: number; productId: string; qty: string; unitPrice: string };
type Bar = { key: number; mark: string; diaMm: string; shapeCode: string; lengthMm: string; bars: string; a: string; b: string; c: string; d: string; ef: string; unitPrice: string };

const VAT = 0.2;
const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });

let seq = 0;
const newLine = (): Line => ({ key: seq++, productId: '', qty: '', unitPrice: '' });
const newBar = (): Bar => ({ key: seq++, mark: '', diaMm: '12', shapeCode: '21', lengthMm: '', bars: '', a: '', b: '', c: '', d: '', ef: '', unitPrice: '' });

export function NewOrderForm({
  customers, products, towns, locations, cutBentPrice,
}: { customers: Customer[]; products: Product[]; towns: string[]; locations: string[]; cutBentPrice: number }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [bars, setBars] = useState<Bar[]>([]);
  const [address, setAddress] = useState(customers[0]?.address ?? '');
  const [town, setTown] = useState(customers[0]?.town ?? '');

  const customer = customers.find((c) => c.id === customerId);

  const totals = useMemo(() => {
    const productNet = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unitPrice || 0), 0);
    const productKg = lines.reduce((s, l) => {
      const p = products.find((x) => x.id === l.productId);
      return s + Number(l.qty || 0) * Number(p?.kgPerUnit ?? 0);
    }, 0);
    const barKg = bars.reduce((s, b) => {
      const perM = MASS_PER_M[Number(b.diaMm)] ?? 0;
      return s + perM * (Number(b.lengthMm || 0) / 1000) * Number(b.bars || 0);
    }, 0);
    const barNet = bars.reduce((s, b) => s + Number(b.bars || 0) * Number(b.unitPrice || 0), 0);
    const net = productNet + barNet;
    return { net, vat: net * VAT, gross: net * (1 + VAT), kg: productKg + barKg };
  }, [lines, bars, products]);

  const limit = Number(customer?.creditLimit ?? 0);
  const used = customer?.used ?? 0;
  const wouldBreach = limit > 0 && used + totals.net > limit;

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    setAddress(c?.address ?? '');
    setTown(c?.town ?? '');
  }

  /** Drop the selling price in automatically so nobody has to look it up. */
  function onProductChange(key: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, productId, unitPrice: p ? String(p.price) : '' } : l)));
  }

  return (
    <form action={createOrder} className="space-y-6">
      {/* -------------------------------------------------------- customer */}
      <section className="card card-pad grid gap-6 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerId">Customer</label>
          <select id="customerId" name="customerId" required value={customerId}
                  onChange={(e) => onCustomerChange(e.target.value)} className="input">
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {customer && (
          <div>
            <p className="label">Credit limit — {customer.name}</p>
            <div className="h-2 w-full rounded-full bg-hairline overflow-hidden mt-2">
              <div className={`h-full rounded-full ${wouldBreach ? 'bg-signal' : 'bg-brand'}`}
                   style={{ width: `${limit ? Math.min(100, ((used + totals.net) / limit) * 100) : 0}%` }} />
            </div>
            <p className={`text-sm mt-2 ${wouldBreach ? 'text-signal font-medium' : 'text-ink-muted'}`}>
              {gbp(used)} unpaid of a {gbp(limit)} limit
              {totals.net > 0 && <> · this order adds {gbp(totals.net)}</>}
            </p>
            {wouldBreach && (
              <p className="hint text-signal">
                This takes them over the limit. You can still save it — someone with approval rights decides whether it goes ahead.
              </p>
            )}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- products */}
      <section className="card card-pad">
        <h2 className="text-lg font-bold">Products</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          Standard items sold as they come — straight bar, mesh sheets, dowels, spacers, chemicals.
        </p>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const product = products.find((p) => p.id === line.productId);
            const lineTotal = Number(line.qty || 0) * Number(line.unitPrice || 0);
            return (
              <div key={line.key} className="grid gap-3 md:grid-cols-[1fr_110px_150px_120px_44px] items-end bg-canvas rounded-xl p-3">
                <div>
                  <label className="label text-xs" htmlFor={`p-${line.key}`}>Product</label>
                  <select id={`p-${line.key}`} name={`product[${i}][productId]`} value={line.productId}
                          onChange={(e) => onProductChange(line.key, e.target.value)} className="input">
                    <option value="">Choose a product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs" htmlFor={`q-${line.key}`}>Qty {product ? `(${product.unit})` : ''}</label>
                  <input id={`q-${line.key}`} name={`product[${i}][qty]`} type="number" step="0.001" min="0" placeholder="0"
                         value={line.qty} onChange={(e) => setLines((prev) => prev.map((l) => l.key === line.key ? { ...l, qty: e.target.value } : l))}
                         className="input" />
                </div>
                <div>
                  <label className="label text-xs" htmlFor={`u-${line.key}`}>Price per unit (£)</label>
                  <input id={`u-${line.key}`} name={`product[${i}][unitPrice]`} type="number" step="0.01" min="0" placeholder="0.00"
                         value={line.unitPrice} onChange={(e) => setLines((prev) => prev.map((l) => l.key === line.key ? { ...l, unitPrice: e.target.value } : l))}
                         className="input" />
                </div>
                <div className="text-right">
                  <span className="label text-xs">Line total</span>
                  <p className="font-bold tabular-nums py-2.5">{gbp(lineTotal)}</p>
                </div>
                <button type="button" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="btn-ghost p-2.5 mb-1" aria-label="Remove this line">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={() => setLines((p) => [...p, newLine()])} className="btn-secondary mt-4">
          <Plus size={16} /> Add another product
        </button>
      </section>

      {/* -------------------------------------------------- bending schedule */}
      <section className="card card-pad">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Cut &amp; bent — bending schedule <Info size={16} className="text-ink-faint" aria-hidden />
        </h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          Different from Products: here we take straight bar from stock and <strong>cut and bend it to the customer&apos;s
          schedule</strong> — one line per bar mark, priced per bar. Leave empty if this order is standard items only.
          Enter the total cutting length exactly as the customer scheduled it.
        </p>

        {bars.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr>
                  {['Mark', 'Dia', 'Shape code', 'Length (mm)', 'Bars', 'A', 'B', 'C', 'D', 'E/F', '£ per bar', ''].map((h) => (
                    <th key={h} className="th pb-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bars.map((bar, i) => (
                  <tr key={bar.key} className="border-t border-hairline">
                    {([
                      ['mark', 'text', 'B01', 'w-20'],
                    ] as const).map(([field, type, ph, w]) => (
                      <td key={field} className="py-2 pr-2">
                        <input name={`bar[${i}][${field}]`} type={type} placeholder={ph} className={`input ${w} px-2 py-1.5`}
                               value={bar[field]} onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, [field]: e.target.value } : b))} />
                      </td>
                    ))}
                    <td className="py-2 pr-2">
                      <select name={`bar[${i}][diaMm]`} value={bar.diaMm} className="input w-20 px-2 py-1.5"
                              onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, diaMm: e.target.value } : b))}>
                        {BAR_SIZES.map((s) => <option key={s} value={s}>{s} mm</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select name={`bar[${i}][shapeCode]`} value={bar.shapeCode} className="input w-56 px-2 py-1.5"
                              onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, shapeCode: e.target.value } : b))}>
                        {SHAPE_CODES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                      </select>
                    </td>
                    {(['lengthMm', 'bars', 'a', 'b', 'c', 'd', 'ef', 'unitPrice'] as const).map((field) => (
                      <td key={field} className="py-2 pr-2">
                        <input name={`bar[${i}][${field}]`} type="number" step={field === 'unitPrice' ? '0.01' : '1'} min="0"
                               className="input w-24 px-2 py-1.5" value={bar[field]}
                               onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, [field]: e.target.value } : b))} />
                      </td>
                    ))}
                    <td className="py-2">
                      <button type="button" onClick={() => setBars((p) => p.filter((b) => b.key !== bar.key))}
                              className="btn-ghost p-2" aria-label={`Remove bar mark ${bar.mark || i + 1}`}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button type="button"
                onClick={() => setBars((p) => [...p, { ...newBar(), unitPrice: String(cutBentPrice || '') }])}
                className="btn-secondary mt-4">
          <Plus size={16} /> Add bar mark
        </button>
      </section>

      {/* --------------------------------------------- delivery and summary */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="deliveryDate">Delivery date</label>
              <input id="deliveryDate" name="deliveryDate" type="date" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="depot">Dispatching depot</label>
              <select id="depot" name="depot" defaultValue={locations[0] ?? 'Scunthorpe'} className="input">
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="hint">Which yard raises, produces and loads this order.</p>
            </div>
            <div>
              <label className="label" htmlFor="town">Town / city</label>
              <select id="town" name="town" value={town} onChange={(e) => setTown(e.target.value)} className="input">
                <option value="">—</option>
                {towns.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="hint">Used by Deliveries to group runs going the same way.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address">Full delivery address</label>
              <textarea id="address" name="address" rows={2} value={address}
                        onChange={(e) => setAddress(e.target.value)} className="input" />
              <p className="hint">Prefilled from the customer&apos;s account — change it for site deliveries.</p>
            </div>
            <div>
              <label className="label" htmlFor="poNumber">Customer PO number</label>
              <input id="poNumber" name="poNumber" className="input" placeholder="e.g. PO-12345" />
            </div>
            <div>
              <label className="label" htmlFor="yardNotes">Notes for the yard</label>
              <input id="yardNotes" name="yardNotes" className="input" placeholder="Anything the loaders should know" />
            </div>
          </div>
        </section>

        <aside className="card card-pad lg:sticky lg:top-6">
          <h2 className="text-lg font-bold mb-4">Summary</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Products</dt><dd className="tabular-nums">{gbp(totals.net)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">VAT (20%)</dt><dd className="tabular-nums">{gbp(totals.vat)}</dd></div>
            <div className="flex justify-between pt-2.5 border-t border-hairline text-base font-bold">
              <dt>Total</dt><dd className="tabular-nums">{gbp(totals.gross)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-ink-muted">Approx. weight</dt><dd className="tabular-nums">{(totals.kg / 1000).toFixed(3)} t</dd></div>
          </dl>

          <button type="submit" className="btn-primary w-full mt-5">Save as draft</button>
          <p className="hint text-center">You can review and submit it from the order page.</p>
        </aside>
      </div>
    </form>
  );
}

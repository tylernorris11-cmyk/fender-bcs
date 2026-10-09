'use client';

import { useMemo, useRef, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { SHAPE_CODES, BAR_SIZES, MASS_PER_M } from '@/lib/bs8666';
import { createOrder } from '../actions';
import { ScheduleImport } from './ScheduleImport';
import { TICKET_COLOUR_MAX } from '@/lib/ticketColours';
import { postcodeIn } from '@/lib/deliveryColours';
import { BoardColourPicker } from '@/components/BoardColourPicker';
import { HiabBadge } from '@/app/planning/HiabBadge';
import { CustomerPicker } from '@/components/CustomerPicker';

type Customer = { id: string; name: string; code: string; address: string; town: string; postcode: string; creditLimit: string; used: number };
type Product = { id: string; name: string; code: string; category: string; unit: string; kgPerUnit: string; price: number };

type Line = { key: number; productId: string; qty: string; unitPrice: string };
type Bar = { key: number; mark: string; diaMm: string; grade: string; shapeCode: string; lengthMm: string; bars: string; a: string; b: string; c: string; d: string; ef: string; radiusMm: string; unitPrice: string };
type Fence = { key: number; lengthFt: string; lengthIn: string; thicknessMm: string; qty: string; unitPrice: string };

const VAT = 0.2;

/** A customer account's address as it goes on an invoice: the address, then town and postcode on their own lines. */
const accountAddress = (c?: { address: string; town: string; postcode: string }) =>
  c ? [c.address.trim(), c.town.trim(), c.postcode.trim()].filter(Boolean).join('\n') : '';
const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });

export function NewOrderForm({
  customers, products, towns, locations, cutBentPrice, isFender, nextNumber, ticketColours,
}: {
  customers: Customer[]; products: Product[]; towns: string[]; locations: string[]; cutBentPrice: number; isFender: boolean; nextNumber: string;
  ticketColours: string[];
}) {
  // Per-instance, not module-level: a shared `let seq` counter drifts between
  // the server (a long-lived process that keeps counting across requests)
  // and a freshly-loaded client bundle (starting back at 0), producing
  // different keys for the same row and a hydration mismatch on the
  // id/htmlFor pair. Scoping it to a ref means every fresh mount — server
  // or client — starts from the same 0.
  const seqRef = useRef(0);
  const nextKey = () => seqRef.current++;
  const newLine = (): Line => ({ key: nextKey(), productId: '', qty: '', unitPrice: '' });
  const newBar = (): Bar => ({ key: nextKey(), mark: '', diaMm: '12', grade: 'H', shapeCode: '21', lengthMm: '', bars: '', a: '', b: '', c: '', d: '', ef: '', radiusMm: '', unitPrice: '' });
  const newFence = (): Fence => ({ key: nextKey(), lengthFt: '', lengthIn: '', thicknessMm: '', qty: '', unitPrice: '' });

  // Nobody's picked to start with: with hundreds of accounts, a preselected first one is too easy to leave by mistake.
  const [customerId, setCustomerId] = useState('');
  // Typing a customer who isn't on the list opens an account for them when the order's saved.
  const [newCustomer, setNewCustomer] = useState(customers.length === 0);
  const [newCustomerName, setNewCustomerName] = useState('');
  // Lazy initializer — passing [newLine()] directly would call newLine() (and
  // so nextKey()) on every render, not just the first, since JS evaluates
  // the argument before useState ever sees it.
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [bars, setBars] = useState<Bar[]>([]);
  const [fences, setFences] = useState<Fence[]>([]);
  const [address, setAddress] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [town, setTown] = useState('');
  // Filled in from the delivery address until someone types their own.
  const [boardPostcode, setBoardPostcode] = useState('');
  const postcodeTyped = useRef(false);
  const changeAddress = (value: string) => {
    setAddress(value);
    if (!postcodeTyped.current) setBoardPostcode(postcodeIn(value));
  };

  const customer = newCustomer ? undefined : customers.find((c) => c.id === customerId);

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
    const fenceNet = fences.reduce((s, f) => s + Number(f.qty || 0) * Number(f.unitPrice || 0), 0);
    const fenceKg = fences.reduce((s, f) => s + Number(f.qty || 0) * 1000, 0);
    const net = productNet + barNet + fenceNet;
    return { net, vat: net * VAT, gross: net * (1 + VAT), kg: productKg + barKg + fenceKg };
  }, [lines, bars, fences, products]);

  const limit = Number(customer?.creditLimit ?? 0);
  const used = customer?.used ?? 0;
  const wouldBreach = limit > 0 && used + totals.net > limit;

  /** Switch to typing in a new customer, carrying over any name already typed into the search. */
  function startNewCustomer(typed: string) {
    setNewCustomerName(typed);
    setNewCustomer(true);
    changeAddress(''); setInvoiceAddress(''); setTown('');
  }

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    changeAddress(c?.address ?? '');
    setInvoiceAddress(accountAddress(c));
    setTown(c?.town ?? '');
  }

  /**
   * Bar marks read off an uploaded schedule join any already entered (replacing a blank starter row), priced at the usual
   * cut & bent rate, then the lot is put smallest diameter first and shortest to longest — the order the order page,
   * tally tickets and delivery note list them in. The sort is stable, so equal ones keep their schedule order.
   */
  function importSchedule(result: { bars: { mark: string; grade: string; diaMm: number; bars: number; lengthMm: number; shapeCode: string; a: number | null; b: number | null; c: number | null; d: number | null; e: number | null; r: number | null }[] }) {
    const str = (n: number | null) => (n == null ? '' : String(n));
    const imported: Bar[] = result.bars.map((b) => ({
      key: nextKey(), mark: b.mark, diaMm: String(b.diaMm), grade: b.grade, shapeCode: b.shapeCode,
      lengthMm: String(b.lengthMm), bars: String(b.bars), a: str(b.a), b: str(b.b), c: str(b.c), d: str(b.d),
      ef: str(b.e), radiusMm: str(b.r), unitPrice: String(cutBentPrice || ''),
    }));
    setBars((prev) => [...prev.filter((b) => b.mark.trim() || b.bars), ...imported]
      .sort((x, y) => Number(x.diaMm) - Number(y.diaMm) || Number(x.lengthMm) - Number(y.lengthMm)));
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
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="number">Job number</label>
            <input id="number" name="number" maxLength={40} className="input" placeholder={nextNumber} />
            <p className="hint">Type your own, or leave it blank for the next number ({nextNumber}).</p>
          </div>
          {newCustomer ? (
            <div>
              <label className="label" htmlFor="newCustomerName">Customer name</label>
              <input id="newCustomerName" name="newCustomerName" required className="input" placeholder="Who the order is for"
                     defaultValue={newCustomerName} autoFocus={!!newCustomerName} />
              <p className="hint">
                A customer account is opened for them when the order&apos;s saved.
                {customers.length > 0 && (
                  <> <button type="button" className="text-brand-700 font-medium hover:underline"
                    onClick={() => { setNewCustomer(false); onCustomerChange(customerId); }}>Pick from the list instead</button></>
                )}
              </p>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="customerId">Customer</label>
              <CustomerPicker customers={customers} defaultValue={customerId} required
                              onChange={(c) => onCustomerChange(c?.id ?? '')} onNotListed={startNewCustomer} />
              <p className="hint">
                <button type="button" className="text-brand-700 font-medium hover:underline"
                  onClick={() => startNewCustomer('')}>Customer not on the list?</button>
              </p>
            </div>
          )}
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
      {isFender ? (
      <section className="card card-pad">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Cut &amp; bent — bending schedule <Info size={16} className="text-ink-faint" aria-hidden />
        </h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          Different from Products: here we take straight bar from stock and <strong>cut and bend it to the customer&apos;s
          schedule</strong> — one line per bar mark, priced per bar. Leave empty if this order is standard items only.
          Enter the total cutting length exactly as the customer scheduled it.
        </p>

        <ScheduleImport onImport={importSchedule} />

        {bars.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr>
                  {['Mark', 'Dia', 'Grade', 'Shape code', 'Length (mm)', 'Bars', 'A', 'B', 'C', 'D', 'E/F', '£ per bar', ''].map((h) => (
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
                        {!BAR_SIZES.includes(Number(bar.diaMm)) && <option value={bar.diaMm}>{bar.diaMm} mm (from schedule)</option>}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input name={`bar[${i}][grade]`} type="text" maxLength={2} placeholder="H" className="input w-14 px-2 py-1.5 uppercase"
                             value={bar.grade} onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, grade: e.target.value.toUpperCase() } : b))} />
                    </td>
                    <td className="py-2 pr-2">
                      <select name={`bar[${i}][shapeCode]`} value={bar.shapeCode} className="input w-56 px-2 py-1.5"
                              onChange={(e) => setBars((p) => p.map((b) => b.key === bar.key ? { ...b, shapeCode: e.target.value } : b))}>
                        {SHAPE_CODES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                        {!SHAPE_CODES.some((s) => s.code === bar.shapeCode) && <option value={bar.shapeCode}>{bar.shapeCode} — from schedule</option>}
                      </select>
                      <input type="hidden" name={`bar[${i}][radiusMm]`} value={bar.radiusMm} />
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
      ) : (
      <section className="card card-pad">
        <h2 className="text-lg font-bold">Fence posts</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          Cut to length from coil — no need to add it to Stock first, just describe what the customer wants
          and it&apos;ll show up in Production ready to cut.
        </p>

        {fences.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  {['Length', '', 'Thickness (mm)', 'Qty (t)', '£ per tonne', 'Line total', ''].map((h, i) => (
                    <th key={i} className="th pb-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fences.map((f, i) => {
                  const lineTotal = Number(f.qty || 0) * Number(f.unitPrice || 0);
                  return (
                    <tr key={f.key} className="border-t border-hairline">
                      <td className="py-2 pr-2">
                        <input name={`fence[${i}][lengthFt]`} type="number" min="0" step="1" placeholder="6" className="input w-16 px-2 py-1.5"
                               value={f.lengthFt} onChange={(e) => setFences((p) => p.map((x) => x.key === f.key ? { ...x, lengthFt: e.target.value } : x))} aria-label="Feet" />
                        <span className="text-ink-faint text-xs px-0.5">ft</span>
                      </td>
                      <td className="py-2 pr-2">
                        <input name={`fence[${i}][lengthIn]`} type="number" min="0" max="11" step="1" placeholder="0" className="input w-16 px-2 py-1.5"
                               value={f.lengthIn} onChange={(e) => setFences((p) => p.map((x) => x.key === f.key ? { ...x, lengthIn: e.target.value } : x))} aria-label="Inches" />
                        <span className="text-ink-faint text-xs px-0.5">in</span>
                      </td>
                      <td className="py-2 pr-2">
                        <input name={`fence[${i}][thicknessMm]`} type="number" min="0" step="0.1" placeholder="3" className="input w-24 px-2 py-1.5"
                               value={f.thicknessMm} onChange={(e) => setFences((p) => p.map((x) => x.key === f.key ? { ...x, thicknessMm: e.target.value } : x))} />
                      </td>
                      <td className="py-2 pr-2">
                        <input name={`fence[${i}][qty]`} type="number" min="0" step="0.5" placeholder="1" className="input w-24 px-2 py-1.5"
                               value={f.qty} onChange={(e) => setFences((p) => p.map((x) => x.key === f.key ? { ...x, qty: e.target.value } : x))} />
                      </td>
                      <td className="py-2 pr-2">
                        <input name={`fence[${i}][unitPrice]`} type="number" min="0" step="0.01" placeholder="0.00" className="input w-28 px-2 py-1.5"
                               value={f.unitPrice} onChange={(e) => setFences((p) => p.map((x) => x.key === f.key ? { ...x, unitPrice: e.target.value } : x))} />
                      </td>
                      <td className="py-2 pr-2 font-bold tabular-nums">{gbp(lineTotal)}</td>
                      <td className="py-2">
                        <button type="button" onClick={() => setFences((p) => p.filter((x) => x.key !== f.key))}
                                className="btn-ghost p-2" aria-label={`Remove fence post line ${i + 1}`}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button type="button" onClick={() => setFences((p) => [...p, newFence()])} className="btn-secondary mt-4">
          <Plus size={16} /> Add fence post line
        </button>
      </section>
      )}

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
              <select id="depot" name="depot" defaultValue={locations.includes('Scunthorpe') ? 'Scunthorpe' : locations[0]} className="input">
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="hint">Which yard raises, produces and loads this order.</p>
            </div>
            <div>
              <label className="label" htmlFor="boardPostcode">Delivery board postcode</label>
              <input id="boardPostcode" name="boardPostcode" value={boardPostcode} maxLength={10} autoComplete="off"
                     onChange={(e) => { postcodeTyped.current = true; setBoardPostcode(e.target.value); }}
                     className="input uppercase" placeholder="e.g. WF7 7JY" />
              <p className="hint">Shown first on the delivery board. Filled in from the delivery address when it has one.</p>
            </div>
            <div>
              <label className="label" htmlFor="town">Delivery board location</label>
              <input id="town" name="town" list="town-options" value={town} maxLength={60} autoComplete="off"
                     onChange={(e) => setTown(e.target.value)} className="input" placeholder="e.g. Ackworth or LANCS" />
              <datalist id="town-options">
                {towns.map((t) => <option key={t} value={t} />)}
              </datalist>
              <p className="hint">Shown after the postcode — type anything, or pick a town.</p>
            </div>
            <div>
              <BoardColourPicker defaultValue="BLUE" />
              <p className="hint">The colour of this delivery&apos;s box on the board.</p>
            </div>
            <div>
              <label className="label" htmlFor="boardExtraTonnes">Extra weight for the delivery board (tonnes)</label>
              <input id="boardExtraTonnes" name="boardExtraTonnes" type="number" step="0.001" min="0" inputMode="decimal"
                     className="input max-w-[160px]" placeholder="e.g. 0.45" />
              <p className="hint">Mesh or anything else going with the bar — added to this order&apos;s weight on the board only.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="boardHiab" className="h-4 w-4 accent-brand" />
              Needs a hiab to unload <HiabBadge />
            </label>
            <div>
              <label className="label" htmlFor="invoiceAddress">Invoice address</label>
              <textarea id="invoiceAddress" name="invoiceAddress" rows={4} required={isFender} value={invoiceAddress}
                        onChange={(e) => setInvoiceAddress(e.target.value)} className="input" />
              <p className="hint">Prefilled from the customer&apos;s account. Printed on the delivery note.</p>
            </div>
            <div>
              <label className="label" htmlFor="address">Delivery address</label>
              <textarea id="address" name="address" rows={4} required={isFender} value={address}
                        onChange={(e) => changeAddress(e.target.value)} className="input" placeholder="Site name, road, town, contact and phone, postcode" />
              <p className="hint">Prefilled from the account — change it for site deliveries.</p>
            </div>
            <div>
              <label className="label" htmlFor="poNumber">Customer PO number</label>
              <input id="poNumber" name="poNumber" className="input" placeholder="e.g. PO-12345" />
            </div>
            {isFender && (
              <div>
                <label className="label" htmlFor="ticketColour">Ticket colour</label>
                <input id="ticketColour" name="ticketColour" list="ticket-colours" maxLength={TICKET_COLOUR_MAX}
                       placeholder="Pick or type a colour" autoComplete="off" className="input" />
                <datalist id="ticket-colours">
                  {ticketColours.map((c) => <option key={c} value={c} />)}
                </datalist>
                <p className="hint">The tally ticket stock this job&apos;s on: pick one, or type a new colour. Printed on the delivery note.</p>
              </div>
            )}
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

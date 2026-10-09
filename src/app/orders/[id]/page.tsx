import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Archive, ArrowLeft, Banknote, Printer, Trash2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { BAR_MARK_ORDER, creditCheck, NEXT_STAGE, orderTotals, ticketColourOptions } from '@/lib/orders';
import { can } from '@/lib/rbac';
import { clock, money, qty, shortDate, tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, PageHeader, Pill, STAGE_FLOW, STAGE_LABEL, StagePill, Table } from '@/components/ui';
import {
  addChecklistItem, advanceStage, archiveOrder, markPaid, removeChecklistItem, setDeliveryBoard, setTicketColour, toggleChecklistItem,
} from '../actions';
import { TICKET_COLOUR_MAX, ticketSwatch } from '@/lib/ticketColours';
import { deliveryNoteNo } from '@/lib/deliveryNote';
import { SubmitButton } from '@/components/SubmitButton';
import { BoardColourPicker } from '@/components/BoardColourPicker';
import { HiabBadge } from '@/app/planning/HiabBadge';
import { DELIVERY_COLOUR_LABEL, DELIVERY_COLOUR_SWATCH } from '@/lib/deliveryColours';

export default async function OrderPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('orders.view');
  const alerts = await getAlerts(user);

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      customer: { include: { accountManager: true } },
      raisedBy: true,
      lines: { orderBy: { sortOrder: 'asc' }, include: { picks: { include: { batch: true } }, product: true } },
      barMarks: { orderBy: BAR_MARK_ORDER, include: { qcChecks: true } },
      checklist: { orderBy: { sortOrder: 'asc' }, include: { doneBy: true } },
      ncrs: true,
    },
  });
  if (!order) notFound();
  if (!user.companies.includes(order.company)) notFound();

  const [history, credit, ticketColours] = await Promise.all([
    db.activityLog.findMany({ where: { entity: 'Order', entityId: order.id }, include: { user: true }, orderBy: { at: 'desc' }, take: 40 }),
    creditCheck(order.customerId),
    order.company === 'FENDER' ? ticketColourOptions() : [],
  ]);
  const swatch = ticketSwatch(order.ticketColour);

  const { net, weightKg } = orderTotals(order);
  const step = NEXT_STAGE[order.stage];
  const canAdvance = step && can(user, step.perm);
  const done = order.checklist.filter((c) => c.done).length;
  const hasSchedule = order.barMarks.length > 0;
  // Cut & bent weight per bar size, smallest first.
  const byDiameter = [...order.barMarks.reduce((m, b) => {
    const d = m.get(b.diaMm) ?? { dia: b.diaMm, kg: 0, bars: 0 };
    d.kg += Number(b.weightKg);
    d.bars += b.bars;
    return m.set(b.diaMm, d);
  }, new Map<number, { dia: number; kg: number; bars: number }>()).values()].sort((a, b) => a.dia - b.dia);

  return (
    <Shell user={user} module="orders" nav={NAV.orders} current="/orders" alerts={alerts.length}>
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to orders
      </Link>

      <PageHeader
        title={order.number}
        blurb={`Created ${shortDate(order.createdAt)}${order.raisedBy ? ` by ${order.raisedBy.name}` : ''}`}
        actions={
          <>
            {can(user, 'orders.archive') && (
              <form action={archiveOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn-secondary"><Archive size={16} /> {order.archived ? 'Restore' : 'Archive'}</button>
              </form>
            )}
            <a href={`/orders/${order.id}/delivery-sheet`} className="btn-secondary"><Printer size={16} /> {order.company === 'FENDER' ? 'Delivery note' : 'Delivery sheet'}</a>
            {hasSchedule && (
              <>
                <a href={`/orders/${order.id}/bending-ticket`} className="btn-secondary"><Printer size={16} /> Bending ticket</a>
                <a href={`/orders/${order.id}/tally-print`} className="btn-secondary"><Printer size={16} /> Print tally</a>
              </>
            )}
          </>
        }
      />

      {/* --------------------------------------------------- stage tracker */}
      <section className="card card-pad mb-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 mb-5">
          {STAGE_FLOW.map((s, i) => {
            const reached = STAGE_FLOW.indexOf(order.stage) >= i;
            const current = order.stage === s;
            return (
              <li key={s} className="flex items-center gap-2">
                <span className={`pill ${current ? 'bg-brand text-white' : reached ? 'bg-brand-100 text-forest' : 'bg-slate-100 text-ink-faint'}`}>
                  {STAGE_LABEL[s]}
                </span>
                {i < STAGE_FLOW.length - 1 && <span className="w-5 h-px bg-hairline" aria-hidden />}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <StagePill stage={order.stage} />
            {order.paymentStatus === 'PAID'
              ? <Pill tone="good">Paid {shortDate(order.paidAt)}</Pill>
              : <Pill>Unpaid</Pill>}
            {order.overrideCredit && <Pill tone="warn">Approved over credit limit</Pill>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {order.stage === 'DELIVERED' && can(user, 'orders.markPaid') && order.paymentStatus === 'UNPAID' && (
              <form action={markPaid}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn-secondary"><Banknote size={16} /> Mark as paid</button>
              </form>
            )}
            {canAdvance && (
              <form action={advanceStage} className="flex items-center gap-3">
                <input type="hidden" name="orderId" value={order.id} />
                {order.stage === 'PENDING_APPROVAL' && credit.breaches && (
                  <label className="flex items-center gap-2 text-sm text-signal font-medium">
                    <input type="checkbox" name="override" className="h-4 w-4 accent-signal" />
                    Override credit limit
                  </label>
                )}
                <button className="btn-primary">{step!.label}</button>
              </form>
            )}
          </div>
        </div>

        {order.stage === 'DELIVERED' && (
          <p className="text-sm text-ink-muted text-right mt-2">
            Completing the order releases the value from the customer&apos;s credit.
          </p>
        )}
        {order.stage === 'PENDING_APPROVAL' && credit.breaches && (
          <p className="banner-bad mt-4">
            {order.customer.name} has {money(credit.used)} unpaid against a {money(credit.limit)} limit.
            Approving this needs the override, and it will be logged against your name.
          </p>
        )}
      </section>

      {/* -------------------------------------------------------- products */}
      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Products</h2>
        <Table
          head={<>
            <th className="th">Product</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Total</th>
          </>}
        >
          {order.lines.map((l) => (
            <tr key={l.id} className="row">
              <td className="td">
                <span className="font-semibold">{l.description}</span>
                {l.picks.map((p) => (
                  <span key={p.id} className="block text-xs text-ink-muted mt-0.5">
                    {qty(p.qty, l.unit)} picked from {p.batch.heatNumber}
                    {p.batch.certNumber && <> (cert {p.batch.certNumber})</>}
                  </span>
                ))}
              </td>
              <td className="td text-right tabular-nums">{qty(l.qty, l.unit)}</td>
              <td className="td text-right tabular-nums">{money(l.unitPrice)}</td>
              <td className="td text-right font-semibold tabular-nums">{money(l.lineTotal)}</td>
            </tr>
          ))}
          {order.lines.length === 0 && (
            <tr><td colSpan={4} className="td text-ink-muted">No standard products on this order.</td></tr>
          )}
        </Table>

        {hasSchedule && (
          <>
            <h3 className="text-base font-bold mt-8 mb-3">Bending schedule (BS 8666:2020)</h3>
            <Table
              head={<>
                <th className="th">Mark</th>
                <th className="th">Dia</th>
                <th className="th">Shape</th>
                <th className="th text-right">Length</th>
                <th className="th text-right">Bars</th>
                <th className="th">A / B / C / D / E-F</th>
                <th className="th text-right">Weight</th>
                <th className="th">Checked</th>
              </>}
            >
              {order.barMarks.map((b) => {
                const failed = b.qcChecks.some((c) => !c.pass);
                return (
                  <tr key={b.id} className="row">
                    <td className="td font-semibold">{b.mark}</td>
                    <td className="td">{b.grade}{b.diaMm} mm</td>
                    <td className="td">{b.shapeCode} — {b.shapeName}</td>
                    <td className="td text-right tabular-nums">{b.lengthMm.toLocaleString('en-GB')} mm</td>
                    <td className="td text-right tabular-nums">{b.bars}</td>
                    <td className="td text-ink-muted tabular-nums">
                      {[b.a, b.b, b.c, b.d, b.ef].map((v) => v ?? 0).join(' / ')}
                    </td>
                    <td className="td text-right tabular-nums">{tonnes(b.weightKg)}</td>
                    <td className="td">
                      {b.qcChecks.length === 0 ? <Pill>Not checked</Pill>
                        : failed ? <Pill tone="bad">Out of tolerance</Pill>
                        : <Pill tone="good">{b.qcChecks.length} checks passed</Pill>}
                    </td>
                  </tr>
                );
              })}
            </Table>

            {/* For invoicing in Exchequer, which bills each diameter's weight as its own line. */}
            <h3 className="text-base font-bold mt-8 mb-1">Weight by diameter</h3>
            <p className="text-sm text-ink-muted mb-3">The cut &amp; bent weight of each size, for invoicing.</p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {byDiameter.map((d) => (
                <div key={d.dia} className="rounded-xl border border-hairline px-4 py-3">
                  <p className="text-sm text-ink-muted">{d.dia} mm · {d.bars.toLocaleString('en-GB')} bars</p>
                  <p className="text-xl font-bold tabular-nums">{(d.kg / 1000).toFixed(3)} t</p>
                  <p className="text-xs text-ink-faint tabular-nums">{d.kg.toLocaleString('en-GB', { maximumFractionDigits: 1 })} kg</p>
                </div>
              ))}
              <div className="rounded-xl border border-forest/30 bg-brand-50 px-4 py-3">
                <p className="text-sm text-ink-muted">All sizes · {order.barMarks.reduce((s, b) => s + b.bars, 0).toLocaleString('en-GB')} bars</p>
                <p className="text-xl font-bold tabular-nums">{(byDiameter.reduce((s, d) => s + d.kg, 0) / 1000).toFixed(3)} t</p>
                <p className="text-xs text-ink-faint">Cut &amp; bent total</p>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-8 pt-5 mt-5 border-t border-hairline text-sm">
          <span>Weight ≈ <strong className="text-base">{tonnes(weightKg)}</strong></span>
          <span>Total ex VAT <strong className="text-base">{money(net)}</strong></span>
        </div>
      </section>

      {/* ------------------------------------------------------- checklist */}
      <section className="card card-pad mb-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Checklist</h2>
          <span className="text-sm text-ink-muted">{done} of {order.checklist.length} done</span>
        </header>

        <ul className="space-y-1">
          {order.checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-2 group">
              <form action={toggleChecklistItem} className="pt-0.5">
                <input type="hidden" name="itemId" value={item.id} />
                <button
                  className={`h-6 w-6 rounded-md border-2 grid place-items-center transition-colors ${
                    item.done ? 'bg-brand border-brand text-white' : 'border-hairline hover:border-brand'
                  }`}
                  aria-label={`${item.done ? 'Undo' : 'Complete'}: ${item.label}`}
                  disabled={!can(user, 'orders.progress')}
                >
                  {item.done && <span aria-hidden>✓</span>}
                </button>
              </form>
              <div className="flex-1">
                <p className={item.done ? 'line-through text-ink-faint' : ''}>{item.label}</p>
                {item.done && item.doneBy && (
                  <p className="text-xs text-ink-faint mt-0.5">
                    {item.doneBy.name} · {shortDate(item.doneAt)} {clock(item.doneAt)}
                  </p>
                )}
              </div>
              {can(user, 'orders.progress') && (
                <form action={removeChecklistItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="text-ink-faint hover:text-signal opacity-0 group-hover:opacity-100 focus:opacity-100 p-1"
                          aria-label={`Remove: ${item.label}`}>
                    <Trash2 size={16} />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {can(user, 'orders.progress') && (
          <form action={addChecklistItem} className="flex gap-2 mt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <input name="label" placeholder="Add a checklist item…" className="input flex-1" aria-label="New checklist item" />
            <button className="btn-secondary">Add</button>
          </form>
        )}
      </section>

      {/* --------------------------------------------- customer + delivery */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Customer</h2>
          <Link href={`/customers/${order.customer.id}`} className="text-brand-700 font-semibold hover:underline">
            {order.customer.name}
          </Link>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            {order.customer.contactName}<br />
            {order.customer.phone}<br />
            {order.customer.address}
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Delivery</h2>
          <dl className="text-sm space-y-2">
            {order.deliveryNoteSeq != null && (
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Delivery note</dt><dd className="font-semibold">{deliveryNoteNo(order.deliveryNoteSeq)}</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Date</dt><dd className="font-semibold">{shortDate(order.deliveryDate)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Depot</dt><dd className="font-semibold">{order.depot}</dd></div>
            <div>
              <dt className="text-ink-muted mb-1.5">Delivery board</dt>
              <dd>
                {can(user, 'orders.edit') ? (
                  // How this order shows on the delivery board: postcode first, then the location, in its colour.
                  <form key={`${order.boardPostcode}-${order.town}-${order.boardColour}-${order.boardExtraKg}-${order.boardHiab}`} action={setDeliveryBoard} className="space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <div className="grid grid-cols-[7rem_1fr] gap-2">
                      <input name="boardPostcode" defaultValue={order.boardPostcode} maxLength={10} autoComplete="off" placeholder="Postcode"
                             className="input py-1 uppercase" aria-label="Delivery board postcode" />
                      <input name="town" defaultValue={order.town} maxLength={60} autoComplete="off" placeholder="Location, e.g. Ackworth"
                             className="input py-1" aria-label="Delivery board location" />
                    </div>
                    <label className="flex items-center gap-2 text-ink-muted">
                      Extra weight
                      <input name="boardExtraTonnes" type="number" step="0.001" min="0" inputMode="decimal" placeholder="0"
                             defaultValue={Number(order.boardExtraKg) > 0 ? Number(order.boardExtraKg) / 1000 : ''} className="input py-1 w-24" />
                      <span>t, e.g. mesh</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium">
                      <input type="checkbox" name="boardHiab" defaultChecked={order.boardHiab} className="h-4 w-4 accent-brand" />
                      Needs a hiab <HiabBadge />
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      <BoardColourPicker small defaultValue={order.boardColour} />
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                    </div>
                  </form>
                ) : (
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    {order.boardColour && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: DELIVERY_COLOUR_SWATCH[order.boardColour] }} aria-label={DELIVERY_COLOUR_LABEL[order.boardColour]} />}
                    {[order.boardPostcode, order.town].filter(Boolean).join(' · ') || '—'}
                    {Number(order.boardExtraKg) > 0 && <span className="font-normal text-ink-muted">+ {tonnes(order.boardExtraKg)} extra</span>}
                    {order.boardHiab && <HiabBadge />}
                  </span>
                )}
              </dd>
            </div>
            <div><dt className="text-ink-muted">Delivery address</dt><dd className="font-semibold mt-0.5 whitespace-pre-line">{order.address || '—'}</dd></div>
            {order.invoiceAddress && <div><dt className="text-ink-muted">Invoice address</dt><dd className="font-semibold mt-0.5 whitespace-pre-line">{order.invoiceAddress}</dd></div>}
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Customer PO</dt><dd className="font-semibold">{order.poNumber || '—'}</dd></div>
            {order.company === 'FENDER' && (
              <div className="flex justify-between items-center gap-4">
                <dt className="text-ink-muted">Ticket colour</dt>
                <dd>
                  {can(user, 'orders.edit') ? (
                    // Pick one of the suggestions or type a new colour; a new one is suggested on later orders.
                    <form key={order.ticketColour} action={setTicketColour} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      {swatch && <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/20" style={{ background: swatch }} aria-hidden />}
                      <input name="ticketColour" list="ticket-colours" defaultValue={order.ticketColour} maxLength={TICKET_COLOUR_MAX}
                             placeholder="Pick or type a colour" autoComplete="off" className="input py-1 w-44" aria-label="Ticket colour" />
                      <datalist id="ticket-colours">
                        {ticketColours.map((c) => <option key={c} value={c} />)}
                      </datalist>
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
                    </form>
                  ) : (
                    <span className="font-semibold inline-flex items-center gap-1.5">
                      {swatch && <span className="h-3 w-3 rounded-full border border-black/20" style={{ background: swatch }} aria-hidden />}
                      {order.ticketColour || '—'}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {order.yardNotes && <div><dt className="text-ink-muted">Notes for the yard</dt><dd className="mt-0.5">{order.yardNotes}</dd></div>}
          </dl>
        </section>
      </div>

      {order.ncrs.length > 0 && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-3">Non-conformances raised against this order</h2>
          <ul className="space-y-2 text-sm">
            {order.ncrs.map((n) => (
              <li key={n.id} className="flex items-center gap-3">
                <Pill tone={n.status === 'OPEN' ? 'warn' : 'good'}>{n.ref}</Pill>
                <span>{n.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------- history */}
      <details className="card card-pad">
        <summary className="text-lg font-bold cursor-pointer">History</summary>
        <ul className="mt-4 space-y-3 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex items-start gap-3">
              {h.user && <Avatar name={h.user.name} colour={h.user.colour} size={26} />}
              <div>
                <p><strong>{h.action}</strong>{h.detail && <span className="text-ink-muted"> — {h.detail}</span>}</p>
                <p className="text-xs text-ink-faint">{h.user?.name ?? 'System'} · {shortDate(h.at)} {clock(h.at)}</p>
              </div>
            </li>
          ))}
          {history.length === 0 && <li className="text-ink-muted">Nothing recorded yet.</li>}
        </ul>
      </details>
    </Shell>
  );
}

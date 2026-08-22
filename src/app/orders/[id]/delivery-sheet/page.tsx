import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { orderTotals } from '@/lib/orders';
import { money, qty, shortDate, tonnes } from '@/lib/format';

/**
 * The paper that goes on the lorry. Every rebar line prints its cast/heat number
 * and mill certificate reference, because CARES requires reinforcement delivered
 * to site to be traceable to the cast, the supplier and the manufacturer.
 */
export default async function DeliverySheet({ params }: { params: { id: string } }) {
  await requirePermission('orders.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: 'asc' }, include: { batch: { include: { supplier: true } } } },
      barMarks: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!order) notFound();
  const { net, vat, gross, weightKg } = orderTotals(order);

  return (
    <div className="bg-white min-h-screen p-10 max-w-[820px] mx-auto text-[13px] text-black">
      <div className="flex justify-between items-start border-b-2 border-forest pb-4 mb-6">
        <div>
          <p className="text-2xl font-bold text-forest">Fender<span className="text-signal">BCS</span></p>
          <p className="text-[11px] uppercase tracking-widest text-brand-700">Reinforcing steel specialists</p>
          <p className="text-ink-muted mt-2">Scunthorpe &amp; Sunderland · Established 1981</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold">Delivery note</h1>
          <p className="font-semibold">{order.number}</p>
          <p>Delivery {shortDate(order.deliveryDate)}</p>
          {order.poNumber && <p>Customer PO {order.poNumber}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <p className="font-bold mb-1">Deliver to</p>
          <p>{order.customer.name}</p>
          <p className="whitespace-pre-line">{order.address}</p>
        </div>
        <div>
          <p className="font-bold mb-1">Contact</p>
          <p>{order.customer.contactName}</p>
          <p>{order.customer.phone}</p>
        </div>
      </div>

      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
            <th className="py-2">Description</th><th className="py-2">Cast / heat</th><th className="py-2">Mill cert</th>
            <th className="py-2 text-right">Qty</th><th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id} className="border-b border-black/10">
              <td className="py-2">{l.description}</td>
              <td className="py-2">{l.batch?.heatNumber ?? '—'}</td>
              <td className="py-2">{l.batch?.certNumber ?? '—'}</td>
              <td className="py-2 text-right">{qty(l.qty, l.unit)}</td>
              <td className="py-2 text-right">{money(l.lineTotal)}</td>
            </tr>
          ))}
          {order.barMarks.map((b) => (
            <tr key={b.id} className="border-b border-black/10">
              <td className="py-2">Cut &amp; bent {b.mark} — shape {b.shapeCode}, {b.diaMm} mm, {b.lengthMm} mm</td>
              <td className="py-2">—</td><td className="py-2">On bending ticket</td>
              <td className="py-2 text-right">{b.bars} bars</td>
              <td className="py-2 text-right">{money(b.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end gap-10 mb-10">
        <div className="text-right space-y-1">
          <p>Weight {tonnes(weightKg)}</p>
          <p>Net {money(net)}</p>
          <p>VAT {money(vat)}</p>
          <p className="font-bold text-base">Total {money(gross)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10 pt-8 border-t border-black/20">
        <div><p className="mb-10 font-bold">Received by (print name)</p><div className="border-b border-black/40" /></div>
        <div><p className="mb-10 font-bold">Signature &amp; date</p><div className="border-b border-black/40" /></div>
      </div>

      <p className="text-[11px] text-ink-muted mt-8">
        All reinforcement supplied to BS 4449:2005+A3:2016 and cut and bent to BS 8666:2020.
        Material is traceable to the cast, supplier and manufacturer shown above. Retain this note for the project record.
      </p>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { minRadiusMm, toleranceFor } from '@/lib/bs8666';
import { shortDate, tonnes } from '@/lib/format';

/**
 * The ticket the bender works from, and the one the auditor asks to see against
 * the customer's schedule. It carries the shape code, every dimension and the
 * tolerance the operator is working to.
 */
export default async function BendingTicket({ params }: { params: { id: string } }) {
  await requirePermission('production.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' }, include: { qcChecks: true } } },
  });
  if (!order) notFound();

  const totalKg = order.barMarks.reduce((s, b) => s + Number(b.weightKg), 0);

  return (
    <div className="bg-white min-h-screen p-10 max-w-[900px] mx-auto text-[13px] text-black">
      <div className="flex justify-between border-b-2 border-forest pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold">Bending ticket — BS 8666:2020</h1>
          <p>{order.number} · {order.customer.name}</p>
          <p>Delivery {shortDate(order.deliveryDate)}{order.poNumber && ` · PO ${order.poNumber}`}</p>
        </div>
        <p className="text-2xl font-bold text-forest">Fender<span className="text-signal">BCS</span></p>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
            <th className="py-2">Mark</th><th className="py-2">Dia</th><th className="py-2">Shape</th>
            <th className="py-2 text-right">Length</th><th className="py-2 text-right">Bars</th>
            <th className="py-2">A / B / C / D / E-F</th><th className="py-2">Min radius</th>
            <th className="py-2">Tolerance</th><th className="py-2 text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          {order.barMarks.map((b) => {
            const t = toleranceFor(b.lengthMm);
            return (
              <tr key={b.id} className="border-b border-black/10">
                <td className="py-2 font-bold">{b.mark}</td>
                <td className="py-2">{b.diaMm} mm</td>
                <td className="py-2">{b.shapeCode} — {b.shapeName}</td>
                <td className="py-2 text-right">{b.lengthMm} mm</td>
                <td className="py-2 text-right">{b.bars}</td>
                <td className="py-2">{[b.a, b.b, b.c, b.d, b.ef].map((v) => v ?? 0).join(' / ')}</td>
                <td className="py-2">{b.radiusMm ?? minRadiusMm(b.diaMm)} mm</td>
                <td className="py-2">+{t.plusMm} / −{t.minusMm} mm</td>
                <td className="py-2 text-right">{tonnes(b.weightKg)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="font-bold mb-6">Total {tonnes(totalKg)} across {order.barMarks.length} bar marks</p>

      <div className="border border-black/20 rounded p-4">
        <p className="font-bold mb-3">Dimensional check — sign when measured</p>
        <div className="grid grid-cols-3 gap-6 text-[11px]">
          <div><p className="mb-8">Operator</p><div className="border-b border-black/40" /></div>
          <div><p className="mb-8">Checked by</p><div className="border-b border-black/40" /></div>
          <div><p className="mb-8">Date &amp; machine</p><div className="border-b border-black/40" /></div>
        </div>
      </div>

      <p className="text-[11px] text-ink-muted mt-6">
        Bend formers and length stops must be within their calibration date. If any dimension falls outside the
        tolerance shown, stop, quarantine the bars and raise a non-conformance before re-running.
      </p>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { tallyValues } from '@/lib/tallyLayout';
import { TallyControls } from './TallyControls';
import { TALLY_CSS, TallyTickets } from './TallyTickets';

/**
 * Tally tickets for an order's bending schedule, one per bar mark, laid out
 * on the real FenderBcs Group stock (see lib/tallyLayout.ts for where every
 * box is). Printed from the browser onto the Epson tally printer like any
 * other page; the one-off printer settings are listed on the page. The
 * tickets come out by diameter then length, not in schedule order.
 */
export default async function TallyPrintPage({ params }: { params: { id: string } }) {
  await requirePermission('production.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    // Smallest bar first, shortest to longest within each size — the order the yard cuts them in.
    // Bar marks the same size and length stay in schedule order.
    include: { customer: true, barMarks: { orderBy: [{ diaMm: 'asc' }, { lengthMm: 'asc' }, { sortOrder: 'asc' }] } },
  });
  if (!order) notFound();
  const count = order.barMarks.length;

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <style>{TALLY_CSS}</style>

      <div className="print:hidden max-w-[720px] mx-auto px-6 pt-6 pb-4 space-y-4">
        <Link href={`/orders/${order.id}`} className="text-sm font-semibold text-brand-700 hover:underline">← Back to order</Link>
        <div>
          <h1 className="text-2xl font-bold">Tally tickets · {order.number}</h1>
          <p className="text-ink-muted">{order.customer.name} · {count} {count === 1 ? 'ticket' : 'tickets'}, one per bar mark, smallest diameter first and shortest to longest within each</p>
        </div>
        {count > 0 && <TallyControls />}
        <details className="rounded-xl border border-hairline bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Printer settings (once per PC)</summary>
          <ol className="list-decimal pl-5 mt-3 space-y-1.5">
            <li>In the print window, choose the <strong>Epson FX-890</strong>, then under More settings set <strong>Margins: None</strong> and <strong>Scale: Default</strong>, and untick Headers and footers.</li>
            <li>
              If it prints scaled down or on the wrong length: in Windows, open <strong>Printers &amp; scanners → Print server properties →
              Forms</strong>, create a form called <strong>Tally</strong> that&apos;s <strong>16.6 cm wide and 7.62 cm high</strong> with no margins,
              and choose it as the paper size.
            </li>
            <li>For darker print, set the Epson&apos;s <strong>Printing preferences → Print quality</strong> to its highest setting.</li>
            <li>
              To line up, tick <strong>Show box corners</strong> and print one ticket (Pages: 1). The crosses should sit on the corners
              of the boxes; if they don&apos;t, move them with the arrows and print again. It&apos;s remembered on this PC.
            </li>
          </ol>
        </details>
      </div>

      {count === 0 ? (
        <p className="text-ink-muted text-center py-10">No bar marks on this order.</p>
      ) : (
        <div className="pb-10 print:pb-0">
          <TallyTickets tickets={order.barMarks.map((b) => ({ id: b.id, values: tallyValues(order, b) }))} />
        </div>
      )}
    </div>
  );
}

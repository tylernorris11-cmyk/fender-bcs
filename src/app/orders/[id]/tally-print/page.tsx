import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { PrintActions } from '@/components/PrintActions';

/**
 * Reproduces the physical tally ticket format shown in the reference PDF
 * (TALLY TEMPLATE Tyler.pdf) — one block per bar mark, stacked down the
 * page exactly as the old tally printer laid them out, so they still line
 * up correctly if printed onto the same stationery.
 *
 * Every position below was measured from that PDF's own content stream,
 * not eyeballed: it declares an exact "0.75 0 0 -0.75 0 841.92 cm" page
 * transform (10pt Courier, 6pt/char — 12 characters per inch, "Elite"
 * pitch), so each field's true position is its raw PDF coordinate times
 * 0.75. See the conversation this shipped in for the working-out.
 *
 * This is the version for a normal printer (or Save as PDF). If the
 * physical tally printer garbles a graphical print job — an Epson
 * FX-890IIN did, almost certainly its Windows driver mistranslating —
 * /api/orders/[id]/tally-text gives the identical layout as plain
 * ASCII text instead, which bypasses that translation entirely.
 */

const PAGE_WIDTH_PT = 595.32; // A4
const PAGE_HEIGHT_PT = 841.92;
const FIRST_BLOCK_TOP_PT = 24.36;
const BLOCK_PITCH_PT = 213.72; // vertical distance from one ticket's header to the next
const BLOCKS_PER_PAGE = 4; // as many as fit before the next one would run off the page

// Row offsets, relative to a block's own top (its header line).
const ROW = { header: 0, mark: 39.72, dims: 75.0, bottom: 118.44 };

// Column positions, relative to the page's left edge.
const COL = {
  customerName: 31.56,
  orderNumber: 210.85,
  mark: 28.56,
  bars: 136.49,
  lengthMm: 184.3,
  gradeDia: 316.56,
  a: 40.51,
  b: 76.37,
  c: 112.23,
  d: 160.04,
  ef: 195.89,
  radius: 294.0,
  newLabel: 18.72,
  shapeCode: 61.56,
  date: 79.49,
  weight: 294.0,
};

const ddmmyyyy = (d: Date | null) => {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

function Field({ top, left, children }: { top: number; left: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: `${top}pt`, left: `${left}pt`, whiteSpace: 'pre' }}>
      {children}
    </div>
  );
}

export default async function TallyPrintPage({ params }: { params: { id: string } }) {
  await requirePermission('production.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!order) notFound();

  const dateLabel = ddmmyyyy(order.deliveryDate);
  const pages: (typeof order.barMarks)[] = [];
  for (let i = 0; i < order.barMarks.length; i += BLOCKS_PER_PAGE) {
    pages.push(order.barMarks.slice(i, i + BLOCKS_PER_PAGE));
  }

  return (
    <div className="bg-white min-h-screen">
      <style>{'@page { size: A4; margin: 0; }'}</style>
      <PrintActions maxWidth={700} />

      <div className="print:hidden max-w-[700px] mx-auto px-10 pt-2 flex items-center justify-between gap-3">
        <Link href={`/orders/${order.id}`} className="text-sm font-semibold text-brand-700 hover:underline">← Back to order</Link>
        <div className="flex items-center gap-2">
          <a href={`/orders/${order.id}/tally-print/text`} className="btn-secondary btn-sm">
            Print as text (for the tally printer)
          </a>
          <a href={`/api/orders/${order.id}/tally-text`} className="text-sm text-ink-faint hover:underline">
            or download the .txt file
          </a>
          <a href="/orders/tally-calibration" className="text-sm text-ink-faint hover:underline">
            · line up the boxes on the real stock
          </a>
        </div>
      </div>

      {pages.length === 0 ? (
        <p className="text-ink-muted p-10">No bar marks on this order.</p>
      ) : (
        pages.map((blocks, pageIndex) => (
          <div
            key={pageIndex}
            style={{
              position: 'relative',
              width: `${PAGE_WIDTH_PT}pt`,
              height: `${PAGE_HEIGHT_PT}pt`,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '10pt',
              color: '#000',
              breakAfter: pageIndex < pages.length - 1 ? 'page' : 'auto',
            }}
          >
            {blocks.map((b, i) => {
              const top = FIRST_BLOCK_TOP_PT + i * BLOCK_PITCH_PT;
              return (
                <div key={b.id}>
                  <Field top={top + ROW.header} left={COL.customerName}>{order.customer.name.toUpperCase()}</Field>
                  <Field top={top + ROW.header} left={COL.orderNumber}>{order.number}</Field>

                  <Field top={top + ROW.mark} left={COL.mark}>{b.mark}</Field>
                  <Field top={top + ROW.mark} left={COL.bars}>{b.bars}</Field>
                  <Field top={top + ROW.mark} left={COL.lengthMm}>{b.lengthMm}</Field>
                  <Field top={top + ROW.mark} left={COL.gradeDia}>{b.grade}{b.diaMm}</Field>

                  <Field top={top + ROW.dims} left={COL.a}>{b.a ?? 0}</Field>
                  <Field top={top + ROW.dims} left={COL.b}>{b.b ?? 0}</Field>
                  <Field top={top + ROW.dims} left={COL.c}>{b.c ?? 0}</Field>
                  <Field top={top + ROW.dims} left={COL.d}>{b.d ?? 0}</Field>
                  <Field top={top + ROW.dims} left={COL.ef}>{b.ef ?? 0}</Field>
                  <Field top={top + ROW.dims} left={COL.radius}>{b.radiusMm ?? 0}</Field>

                  <Field top={top + ROW.bottom} left={COL.newLabel}>NEW</Field>
                  <Field top={top + ROW.bottom} left={COL.shapeCode}>{b.shapeCode}</Field>
                  <Field top={top + ROW.bottom} left={COL.date}>{dateLabel}</Field>
                  <Field top={top + ROW.bottom} left={COL.weight}>{(Number(b.weightKg) / 1000).toFixed(4)}</Field>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

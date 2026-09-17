import type { BarMark, Order } from '@prisma/client';

/**
 * Plain-text tally ticket layout, shared by the raw .txt download and the
 * one-click print page — see tally-print/page.tsx for where these numbers
 * come from (measured off the reference PDF's own content stream: 12
 * characters/inch, 6 lines/inch, 18 lines per ticket confirmed against the
 * real 77mm stationery).
 */
const LINE_WIDTH = 78; // 166mm of stock at 12 characters/inch
const LINES_PER_TICKET = 18;

const ROW = { header: 0, mark: 3, dims: 6, bottom: 10 };
const COL = {
  customerName: 5, orderNumber: 35,
  mark: 5, bars: 23, lengthMm: 31, gradeDia: 53,
  a: 7, b: 13, c: 19, d: 27, ef: 33, radius: 49,
  newLabel: 3, shapeCode: 10, date: 13, weight: 49,
};

const ddmmyyyy = (d: Date | null) => {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Overwrites `text` into `line` starting at `col`, truncating rather than overflowing into the next field. */
function place(line: string, col: number, text: string): string {
  const clipped = text.slice(0, Math.max(0, LINE_WIDTH - col));
  return (line.slice(0, col) + clipped + line.slice(col + clipped.length)).slice(0, LINE_WIDTH);
}

export function buildTallyLines(order: Pick<Order, 'number' | 'deliveryDate'> & { customer: { name: string }; barMarks: BarMark[] }): string[] {
  const dateLabel = ddmmyyyy(order.deliveryDate);
  const lines: string[] = [];

  for (const b of order.barMarks) {
    const block = Array.from({ length: LINES_PER_TICKET }, () => ' '.repeat(LINE_WIDTH));

    block[ROW.header] = place(block[ROW.header], COL.customerName, order.customer.name.toUpperCase());
    block[ROW.header] = place(block[ROW.header], COL.orderNumber, order.number);

    block[ROW.mark] = place(block[ROW.mark], COL.mark, b.mark);
    block[ROW.mark] = place(block[ROW.mark], COL.bars, String(b.bars));
    block[ROW.mark] = place(block[ROW.mark], COL.lengthMm, String(b.lengthMm));
    block[ROW.mark] = place(block[ROW.mark], COL.gradeDia, `${b.grade}${b.diaMm}`);

    block[ROW.dims] = place(block[ROW.dims], COL.a, String(b.a ?? 0));
    block[ROW.dims] = place(block[ROW.dims], COL.b, String(b.b ?? 0));
    block[ROW.dims] = place(block[ROW.dims], COL.c, String(b.c ?? 0));
    block[ROW.dims] = place(block[ROW.dims], COL.d, String(b.d ?? 0));
    block[ROW.dims] = place(block[ROW.dims], COL.ef, String(b.ef ?? 0));
    block[ROW.dims] = place(block[ROW.dims], COL.radius, String(b.radiusMm ?? 0));

    block[ROW.bottom] = place(block[ROW.bottom], COL.newLabel, 'NEW');
    block[ROW.bottom] = place(block[ROW.bottom], COL.shapeCode, b.shapeCode);
    block[ROW.bottom] = place(block[ROW.bottom], COL.date, dateLabel);
    block[ROW.bottom] = place(block[ROW.bottom], COL.weight, (Number(b.weightKg) / 1000).toFixed(4));

    lines.push(...block);
  }

  return lines;
}

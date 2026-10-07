/**
 * The pre-printed FenderBcs Group tally stock (DURA-ID labels), in
 * millimetres from the top-left corner of one ticket. Measured off a photo
 * of the real stock with the camera angle corrected from its sprocket holes
 * (12.7mm apart, 6.35mm in from each edge of the 166mm-wide stock); the fit
 * was within half a millimetre, and lines that should be straight came out
 * level across the whole ticket. One ticket is 3 inches (six holes) long.
 *
 * Any leftover offset between the page and the paper is the printer's, not
 * the stock's: the print page has nudge buttons for that, remembered per PC.
 */
export const TALLY = { width: 166, height: 76.2 };

const ROW = [3.3, 13.8, 25.5, 38.0, 50.7]; // top of the customer row, then each line down

/** The stock's own printed lines, drawn on screen only, so the preview looks like the real ticket. */
export const TALLY_LINES: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 17.7, y1: ROW[1], x2: 152.0, y2: ROW[1] },
  { x1: 17.6, y1: ROW[2], x2: 152.8, y2: ROW[2] },
  { x1: 17.6, y1: ROW[3], x2: 154.0, y2: ROW[3] },
  { x1: 17.8, y1: ROW[4], x2: 154.7, y2: ROW[4] },
  { x1: 111.1, y1: ROW[0], x2: 111.1, y2: ROW[1] }, // JOB No.
  { x1: 51.8, y1: ROW[1], x2: 51.8, y2: ROW[2] }, // QUANTITY
  { x1: 85.3, y1: ROW[1], x2: 85.3, y2: ROW[2] }, // LENGTH
  { x1: 119.3, y1: ROW[1], x2: 119.3, y2: ROW[2] }, // DIAMETER
  { x1: 45.2, y1: ROW[2], x2: 45.2, y2: ROW[4] }, // B, then DESTINATION below it
  { x1: 72.3, y1: ROW[2], x2: 72.3, y2: ROW[3] }, // C
  { x1: 99.2, y1: ROW[2], x2: 99.2, y2: ROW[3] }, // D
  { x1: 126.5, y1: ROW[2], x2: 126.5, y2: ROW[3] }, // E/R
  { x1: 120.2, y1: ROW[3], x2: 120.2, y2: ROW[4] }, // WEIGHT
];

export type TallyField =
  | 'customer' | 'jobNo' | 'bmk' | 'quantity' | 'length' | 'diameter'
  | 'a' | 'b' | 'c' | 'd' | 'er' | 'shapeCode' | 'destination' | 'weight';

/** Each box: its label as printed on the stock, and its left/right edges and top. Values go in its lower part, under the label. */
export const TALLY_BOXES: Record<TallyField, { label: string; x0: number; x1: number; top: number }> = {
  customer: { label: 'CUSTOMER', x0: 17.7, x1: 111.1, top: ROW[0] },
  jobNo: { label: 'JOB No.', x0: 111.1, x1: 152.0, top: ROW[0] },
  bmk: { label: 'BMK', x0: 17.7, x1: 51.8, top: ROW[1] },
  quantity: { label: 'QUANTITY', x0: 51.8, x1: 85.3, top: ROW[1] },
  length: { label: 'LENGTH', x0: 85.3, x1: 119.3, top: ROW[1] },
  diameter: { label: 'DIAMETER', x0: 119.3, x1: 152.8, top: ROW[1] },
  a: { label: 'A', x0: 17.6, x1: 45.2, top: ROW[2] },
  b: { label: 'B', x0: 45.2, x1: 72.3, top: ROW[2] },
  c: { label: 'C', x0: 72.3, x1: 99.2, top: ROW[2] },
  d: { label: 'D', x0: 99.2, x1: 126.5, top: ROW[2] },
  er: { label: 'E/R', x0: 126.5, x1: 154.0, top: ROW[2] },
  shapeCode: { label: 'SHAPE CODE', x0: 17.8, x1: 45.2, top: ROW[3] },
  destination: { label: 'DESTINATION', x0: 45.2, x1: 120.2, top: ROW[3] },
  weight: { label: 'WEIGHT', x0: 120.2, x1: 154.7, top: ROW[3] },
};

/** Where a value sits in its box: a little in from the left, below the printed label. */
export const VALUE_INSET = { x: 2.5, y: 5.0 };

/** Where the stock's box corners are — printed as small crosses when lining up, so they should land on the corners. */
export const TALLY_CORNERS: { x: number; y: number }[] = [
  { x: 17.7, y: ROW[1] }, { x: 51.8, y: ROW[1] }, { x: 85.3, y: ROW[1] }, { x: 111.1, y: ROW[1] }, { x: 152.0, y: ROW[1] },
  { x: 17.6, y: ROW[2] }, { x: 45.2, y: ROW[2] }, { x: 72.3, y: ROW[2] }, { x: 99.2, y: ROW[2] }, { x: 126.5, y: ROW[2] }, { x: 152.8, y: ROW[2] },
  { x: 17.6, y: ROW[3] }, { x: 45.2, y: ROW[3] }, { x: 120.2, y: ROW[3] }, { x: 154.0, y: ROW[3] },
  { x: 17.8, y: ROW[4] }, { x: 45.2, y: ROW[4] }, { x: 120.2, y: ROW[4] }, { x: 154.7, y: ROW[4] },
];

const ddmmyyyy = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/London' }) : '';

type BarMarkLike = {
  mark: string; bars: number; lengthMm: number; grade: string; diaMm: number;
  a: number | null; b: number | null; c: number | null; d: number | null; ef: number | null; radiusMm: number | null;
  shapeCode: string; weightKg: unknown;
};

/** What goes in each box for one bar mark, as the old tally system filled it in. */
export function tallyValues(
  order: { number: string; deliveryDate: Date | null; town: string; customer: { name: string } },
  b: BarMarkLike,
): Record<TallyField, string> {
  // E/R is one box for either the E dimension or a bend radius.
  const er = b.ef ? b.ef : b.radiusMm ? b.radiusMm : 0;
  return {
    customer: order.customer.name.toUpperCase(),
    jobNo: order.number,
    bmk: b.mark,
    quantity: String(b.bars),
    length: String(b.lengthMm),
    diameter: `${b.grade}${b.diaMm}`,
    a: String(b.a ?? 0),
    b: String(b.b ?? 0),
    c: String(b.c ?? 0),
    d: String(b.d ?? 0),
    er: String(er),
    shapeCode: `NEW  ${b.shapeCode}`,
    destination: [ddmmyyyy(order.deliveryDate), order.town.toUpperCase()].filter(Boolean).join('  '),
    weight: (Number(b.weightKg) / 1000).toFixed(4),
  };
}

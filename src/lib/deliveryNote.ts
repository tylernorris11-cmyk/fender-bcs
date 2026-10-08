import type { DeliveryNoteData } from '@/app/orders/[id]/delivery-sheet/FenderDeliveryNote';

/** FS0001 — Fender's own delivery note numbers, four digits until they need more. */
export const deliveryNoteNo = (seq: number | null | undefined) => (seq == null ? '' : `FS${String(seq).padStart(4, '0')}`);

type OrderForNote = {
  number: string;
  deliveryNoteSeq: number | null;
  invoiceAddress: string;
  poNumber: string;
  ticketColour: string;
  deliveryDate: Date | null;
  address: string;
  town: string;
  customer: { name: string; address: string; town: string; postcode: string };
  lines: { description: string; qty: unknown; unit: string; weightKg: unknown; picks: { batch: { heatNumber: string } }[] }[];
  barMarks: {
    mark: string; grade: string; diaMm: number; bars: number; lengthMm: number; shapeCode: string; weightKg: unknown;
    a: number | null; b: number | null; c: number | null; d: number | null; ef: number | null; radiusMm: number | null;
  }[];
};

/** An address typed over several lines keeps its lines; one typed on a single line splits at ", ". */
const splitLines = (text: string) => {
  const t = text.trim();
  return (t.includes('\n') ? t.split(/\r?\n/) : t.split(/,\s+/)).map((l) => l.trim()).filter(Boolean);
};

/** Address lines with the town and postcode added on the end, unless they're already in there. */
function addressLines(first: string[], address: string, ...extra: string[]) {
  const lines = [...first, ...splitLines(address)];
  const all = lines.join(' ').toUpperCase();
  for (const e of extra) if (e.trim() && !all.includes(e.trim().toUpperCase())) lines.push(e.trim());
  return lines;
}

/** A bend dimension as the schedule gives it; blank when the shape doesn't use it. */
const dim = (v: number | null) => (v ? String(v) : '');

/** Grade H (and the other high-yield grades) is high tensile; R or M is mild steel. */
const steelKind = (grade: string) => (/^[RM]$/i.test(grade.trim()) ? 'MILD STEEL' : 'HIGH TENSILE');

/** Everything the rebar delivery note prints, from the order: steel summarised per size, bar marks in schedule order. */
export function deliveryNoteData(order: OrderForNote): DeliveryNoteData {
  const groups = new Map<string, { dia: number; label: string; kg: number; bars: number }>();
  for (const b of order.barMarks) {
    const bent = b.shapeCode !== '00';
    const label = `${b.diaMm} mm ${steelKind(b.grade)} ${bent ? 'BENTSTEEL' : 'STRAIGHT'}`;
    const g = groups.get(label) ?? groups.set(label, { dia: b.diaMm, label, kg: 0, bars: 0 }).get(label)!;
    g.kg += Number(b.weightKg);
    g.bars += b.bars;
  }
  const barSummary = [...groups.values()]
    .sort((a, b) => a.dia - b.dia || a.label.localeCompare(b.label))
    .map((g) => ({ label: g.label, tonnes: g.kg / 1000, count: `${g.bars} BARS` }));

  // Stock items (straight bar, mesh and so on) keep their cast numbers for CARES traceability.
  const lineSummary = order.lines.map((l) => {
    const casts = [...new Set(l.picks.map((p) => p.batch.heatNumber).filter(Boolean))].join(', ');
    const qty = Number(l.qty);
    return {
      label: l.description,
      tonnes: Number(l.weightKg) / 1000,
      count: `${Number.isInteger(qty) ? qty : qty.toFixed(3)} ${l.unit}`,
      ...(casts ? { casts } : {}),
    };
  });

  const bent = order.barMarks.filter((b) => b.shapeCode !== '00');
  const totalKg = order.barMarks.reduce((s, b) => s + Number(b.weightKg), 0) + order.lines.reduce((s, l) => s + Number(l.weightKg), 0);

  return {
    noteNo: deliveryNoteNo(order.deliveryNoteSeq),
    jobNo: order.number,
    poNumber: order.poNumber,
    ticketColour: order.ticketColour,
    deliveryDate: order.deliveryDate,
    // The invoice address asked for on the order, or the account's when it wasn't given.
    invoiceLines: order.invoiceAddress.trim()
      ? addressLines([order.customer.name], order.invoiceAddress)
      : addressLines([order.customer.name], order.customer.address, order.customer.town, order.customer.postcode),
    deliveryLines: addressLines([], order.address, order.town),
    summary: [...barSummary, ...lineSummary],
    totalTonnes: totalKg / 1000,
    totalBars: order.barMarks.reduce((s, b) => s + b.bars, 0),
    maxBentLengthMm: bent.length ? Math.max(...bent.map((b) => b.lengthMm)) : null,
    barMarks: order.barMarks.map((b) => ({
      mark: b.mark, size: `${b.grade}${b.diaMm}`, bars: b.bars, lengthMm: b.lengthMm, shape: b.shapeCode,
      a: dim(b.a), b: dim(b.b), c: dim(b.c), d: dim(b.d),
      // One E/R column, as on a BS 8666 schedule: E, or the bend radius marked R when the shape has one instead.
      er: [dim(b.ef), b.radiusMm ? `R${b.radiusMm}` : ''].filter(Boolean).join(' / '),
    })),
  };
}

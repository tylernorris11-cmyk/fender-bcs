import { PRINTER_OFFSET, TALLY, TALLY_BOXES, TALLY_CORNERS, TALLY_LINES, VALUE_INSET, type TallyField } from '@/lib/tallyLayout';

const FIELDS = Object.keys(TALLY_BOXES) as TallyField[];

// One tally per printed page, the exact size of one ticket on the stock, so
// each page break lands on the stock's own perforation. Values print in a
// heavy bold face: a dot-matrix printer drawing text through Windows makes
// thin lettering look faint. The stock's own lines and labels are drawn on
// screen only, as a preview. What's printed is shifted by the printer's
// measured offset plus any nudge (--tally-dx/dy) from TallyControls, which
// also switches the lining-up crosses on.
export const TALLY_CSS = `
@page { size: ${TALLY.width}mm ${TALLY.height}mm; margin: 0; }
.tally-ticket { position: relative; width: ${TALLY.width}mm; height: ${TALLY.height}mm; overflow: hidden; background: #fff; margin: 0 auto 8mm; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.tally-stock { position: absolute; inset: 0; width: 100%; height: 100%; }
.tally-layer { position: absolute; inset: 0; }
@media print { .tally-layer { transform: translate(calc(${PRINTER_OFFSET.x}mm + var(--tally-dx, 0mm)), calc(${PRINTER_OFFSET.y}mm + var(--tally-dy, 0mm))); } }
.tally-value { position: absolute; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 12pt; line-height: 1; color: #000; white-space: nowrap; overflow: hidden; }
.tally-cross { position: absolute; inset: 0; width: 100%; height: 100%; display: none; }
html.tally-corners .tally-cross { display: block; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .tally-ticket { margin: 0; box-shadow: none; break-after: page; }
  .tally-ticket:last-child { break-after: auto; }
  .tally-stock { display: none; }
}
`;

/** One printed page per ticket: the values in their boxes, with the stock drawn behind them on screen only. */
export function TallyTickets({ tickets }: { tickets: { id: string; values: Record<TallyField, string> }[] }) {
  return (
    <>
      {tickets.map(({ id, values }) => (
        <section key={id} className="tally-ticket">
          <svg className="tally-stock" viewBox={`0 0 ${TALLY.width} ${TALLY.height}`} aria-hidden>
            {TALLY_LINES.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#2F7BD6" strokeWidth={0.5} />)}
            {FIELDS.map((f) => {
              const box = TALLY_BOXES[f];
              return (
                <text key={f} x={box.x0 + 0.8} y={box.top + 2.6} fill="#2F7BD6" fontSize={2.2} fontWeight={700} fontFamily="Arial, sans-serif">
                  {box.label}
                </text>
              );
            })}
          </svg>
          <div className="tally-layer">
            {FIELDS.map((f) => {
              const box = TALLY_BOXES[f];
              return (
                <div
                  key={f}
                  className="tally-value"
                  style={{ left: `${box.x0 + VALUE_INSET.x}mm`, top: `${box.top + (box.insetY ?? VALUE_INSET.y)}mm`, width: `${box.x1 - box.x0 - VALUE_INSET.x - 1}mm` }}
                >
                  {values[f]}
                </div>
              );
            })}
            <svg className="tally-cross" viewBox={`0 0 ${TALLY.width} ${TALLY.height}`} aria-hidden>
              {TALLY_CORNERS.map((c, i) => (
                <path key={i} d={`M${c.x - 2} ${c.y}H${c.x + 2}M${c.x} ${c.y - 2}V${c.y + 2}`} stroke="#000" strokeWidth={0.35} />
              ))}
            </svg>
          </div>
        </section>
      ))}
    </>
  );
}

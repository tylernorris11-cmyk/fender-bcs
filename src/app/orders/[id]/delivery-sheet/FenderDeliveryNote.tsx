import type { ReactNode } from 'react';

/**
 * Fender Steel's rebar delivery note. Same content and order as the
 * Exchequer note it replaces — page 1 summarises the steel per size with the
 * signature box, the pages after it list every bar mark — in the app's own
 * look. Each page is a sheet of A4 with the same header, so it prints
 * exactly one page per sheet.
 */

export type DeliveryNoteData = {
  jobNo: string;
  poNumber: string;
  ticketColour: string;
  deliveryDate: Date | null;
  invoiceLines: string[];
  deliveryLines: string[];
  summary: { label: string; tonnes: number; count: string; casts?: string }[];
  totalTonnes: number;
  totalBars: number;
  maxBentLengthMm: number | null;
  barMarks: { mark: string; size: string; bars: number; lengthMm: number; shape: string }[];
};

// Measured on the rendered page (a row is about 8mm): 18 leaves room on the last page for the totals row.
const BAR_ROWS_PER_PAGE = 18;
const UK = { timeZone: 'Europe/London' } as const;

const SWATCH: Record<string, string> = {
  Red: '#DC2626', Blue: '#2563EB', Pink: '#EC4899', Orange: '#F97316', Green: '#16A34A', Yellow: '#EAB308', White: '#FFFFFF',
};

/** 9 Oct 2026 */
const longDay = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { ...UK, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
/** FRI;9.10.26 — the day of delivery, as the old notes printed it beside every bar mark. */
const dayLabel = (d: Date | null) => {
  if (!d) return '';
  const day = d.toLocaleDateString('en-GB', { ...UK, weekday: 'short' }).toUpperCase();
  const [dd, mm, yy] = d.toLocaleDateString('en-GB', { ...UK, day: '2-digit', month: '2-digit', year: '2-digit' }).split('/');
  return `${day};${Number(dd)}.${Number(mm)}.${yy}`;
};
const t4 = (n: number) => n.toFixed(4);

export const DELIVERY_NOTE_CSS = `
@page { size: A4; margin: 0; }
.dn-page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 11mm 13mm 10mm; display: flex; flex-direction: column; overflow: hidden; background: #fff; color: #12211E; margin: 0 auto 8mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); font-family: var(--font-sans), Arial, Helvetica, sans-serif; font-size: 9.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dn-label { font-size: 7pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6B7A76; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .dn-page { margin: 0; box-shadow: none; break-after: page; }
  .dn-page:last-child { break-after: auto; }
}
`;

function Header({ data, page, pages }: { data: DeliveryNoteData; page: number; pages: number }) {
  const swatch = SWATCH[data.ticketColour];
  return (
    <header>
      <div className="flex items-start justify-between gap-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fender-logo.png" alt="Fender Steel" className="h-[19mm] w-auto" />
        </div>
        <div className="text-right">
          <p className="dn-label !text-forest !text-[8pt]">Delivery note</p>
          <p className="text-[21pt] font-extrabold leading-tight tracking-tight">{data.jobNo}</p>
          <p className="text-[8.5pt] text-[#6B7A76]">Page {page} of {pages}</p>
        </div>
      </div>
      <p className="text-[7.5pt] text-[#6B7A76] mt-2">
        <span className="font-semibold text-[#12211E]">Fender Steel Ltd</span>
        {' · '}Rebar · Mesh · Supply &amp; fix · Accessories · Formwork equipment · Bolt boxes · Joint filler foam
      </p>
      <div className="h-[0.6mm] bg-forest mt-2 rounded-full" />

      <div className="grid grid-cols-4 mt-3 rounded-lg bg-[#F1F5F4] px-4 py-2.5">
        <div>
          <p className="dn-label">Delivery date</p>
          <p className="font-semibold mt-0.5">{longDay(data.deliveryDate)}</p>
        </div>
        <div>
          <p className="dn-label">Customer order no.</p>
          <p className="font-semibold mt-0.5 uppercase">{data.poNumber || '—'}</p>
        </div>
        <div>
          <p className="dn-label">Ticket colour</p>
          <p className="font-semibold mt-0.5 flex items-center gap-1.5">
            {swatch && <span className="inline-block h-3 w-3 rounded-full border border-black/30" style={{ background: swatch }} />}
            {data.ticketColour || '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="dn-label">Total steel</p>
          <p className="font-semibold mt-0.5 tabular-nums">{data.totalTonnes.toFixed(3)} t · {data.totalBars} bars</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_0.95fr] gap-6 mt-3 text-[8.5pt] leading-snug">
        <div>
          <p className="dn-label mb-1">Invoice to</p>
          {data.invoiceLines.map((l, i) => <p key={i} className={i === 0 ? 'font-semibold text-[9.5pt]' : ''}>{l}</p>)}
        </div>
        <div>
          <p className="dn-label mb-1">Deliver to</p>
          {data.deliveryLines.map((l, i) => <p key={i} className={i === 0 ? 'font-semibold text-[9.5pt]' : ''}>{l}</p>)}
        </div>
        <div className="text-[#4A5A56]">
          <p className="dn-label mb-1">From</p>
          <p className="font-semibold text-[#12211E]">Fender Steel Ltd</p>
          <p>20 Midland Road, Scunthorpe</p>
          <p>NE Lincs DN16 1DQ</p>
          <p>Tel (01724) 840609 · Fax 281902</p>
          <p>Leeds (0113) 2037092 · Fax 2037093</p>
          <p>VAT GB 351 8980 29</p>
          <p>fendersteel.co.uk</p>
        </div>
      </div>
    </header>
  );
}

function Footer({ children }: { children?: ReactNode }) {
  return (
    <footer className="mt-auto">
      {children}
      <p className="text-[7.5pt] text-[#6B7A76] mt-3 pt-2 border-t border-[#E4E9E7]">
        Withholding of retentions is not accepted · Off-loading is the customer&apos;s responsibility ·
        Access into the yards is prohibited unless accompanied by a member of staff
      </p>
    </footer>
  );
}

const th = 'dn-label !text-[7pt] py-2 px-3 text-left';
const td = 'py-[1.3mm] px-3 border-b border-[#E4E9E7]';

export function FenderDeliveryNote({ data }: { data: DeliveryNoteData }) {
  const barPages: DeliveryNoteData['barMarks'][] = [];
  for (let i = 0; i < data.barMarks.length; i += BAR_ROWS_PER_PAGE) barPages.push(data.barMarks.slice(i, i + BAR_ROWS_PER_PAGE));
  const pages = 1 + barPages.length;
  const location = dayLabel(data.deliveryDate);

  return (
    <>
      <style>{DELIVERY_NOTE_CSS}</style>

      <section className="dn-page">
        <Header data={data} page={1} pages={pages} />

        <p className="text-[11pt] font-bold mt-6 mb-2">Summary</p>
        <table className="w-full border-collapse">
          <thead className="bg-[#F1F5F4]">
            <tr>
              <th className={`${th} rounded-l-md`}>Steel</th>
              <th className={`${th} text-right`}>Weight (t)</th>
              <th className={`${th} text-right rounded-r-md`}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {data.summary.map((s, i) => (
              <tr key={i} className="align-top">
                <td className={`${td} font-medium`}>
                  {s.label}
                  {s.casts && <span className="block text-[7.5pt] font-normal text-[#6B7A76]">Cast {s.casts}</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{t4(s.tonnes)}</td>
                <td className={`${td} text-right tabular-nums uppercase`}>{s.count}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 px-3 border-t-2 border-forest">Total steel</td>
              <td className="py-2 px-3 border-t-2 border-forest text-right tabular-nums">{t4(data.totalTonnes)}</td>
              <td className="py-2 px-3 border-t-2 border-forest text-right tabular-nums">{data.totalBars} BARS</td>
            </tr>
          </tbody>
        </table>

        <div className="flex gap-3 mt-4">
          {data.maxBentLengthMm && (
            <div className="rounded-lg border border-[#E4E9E7] px-3 py-2">
              <p className="dn-label">Max bent bar length</p>
              <p className="font-semibold tabular-nums">{data.maxBentLengthMm} mm</p>
            </div>
          )}
          <div className="rounded-lg border border-[#E4E9E7] px-3 py-2">
            <p className="dn-label">Total order weight</p>
            <p className="font-semibold tabular-nums">{data.totalTonnes.toFixed(3)} t</p>
          </div>
        </div>

        <p className="mt-5 border-l-[1.2mm] border-forest bg-[#F1F5F4] rounded-r-md px-3 py-2 font-semibold">
          Any discrepancies must be notified to Fender Steel Ltd within 7 days.
        </p>

        <Footer>
          <div className="rounded-lg border border-[#C9D3D0] p-4 grid grid-cols-[1fr_auto] gap-6">
            <div>
              <p className="font-bold text-[10.5pt] mb-4">Please sign to accept delivery</p>
              <div className="grid grid-cols-3 gap-5">
                {['Signature', 'Print name', 'Date'].map((l) => (
                  <div key={l}>
                    <div className="border-b border-[#12211E] h-[9mm]" />
                    <p className="dn-label mt-1">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="self-center text-center text-[7pt] text-[#4A5A56] leading-snug border-l border-[#E4E9E7] pl-5">
              <p className="font-extrabold text-[10pt] text-[#12211E]">CARES</p>
              <p>Certificate 1596</p>
              <p className="font-extrabold text-[10pt] text-[#12211E] mt-1.5">UKAS</p>
              <p>Management Systems 002</p>
            </div>
          </div>
        </Footer>
      </section>

      {barPages.map((rows, i) => {
        const last = i === barPages.length - 1;
        return (
          <section key={i} className="dn-page">
            <Header data={data} page={i + 2} pages={pages} />
            <div className="flex items-baseline justify-between mt-6 mb-2">
              <p className="text-[11pt] font-bold">Bar marks</p>
              <p className="text-[8pt] text-[#6B7A76]">
                {barPages.length > 1 ? `${i * BAR_ROWS_PER_PAGE + 1}–${i * BAR_ROWS_PER_PAGE + rows.length} of ` : ''}{data.barMarks.length} bar marks
              </p>
            </div>
            <table className="w-full border-collapse">
              <thead className="bg-[#F1F5F4]">
                <tr>
                  <th className={`${th} rounded-l-md`}>Location</th>
                  <th className={th}>Bar mark</th>
                  <th className={th}>Size</th>
                  <th className={`${th} text-right`}>No. of bars</th>
                  <th className={`${th} text-right`}>Length (mm)</th>
                  <th className={`${th} text-right rounded-r-md`}>Shape</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, j) => (
                  <tr key={j}>
                    <td className={`${td} text-[#4A5A56]`}>{location}</td>
                    <td className={`${td} font-bold`}>{b.mark}</td>
                    <td className={td}>{b.size}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.bars}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.lengthMm}</td>
                    <td className={`${td} text-right`}>{b.shape}</td>
                  </tr>
                ))}
                {last && (
                  <tr className="font-bold">
                    <td className="py-2 px-3 border-t-2 border-forest" colSpan={3}>Total order weight {data.totalTonnes.toFixed(3)} t</td>
                    <td className="py-2 px-3 border-t-2 border-forest text-right tabular-nums">{data.totalBars}</td>
                    <td className="py-2 px-3 border-t-2 border-forest" colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
            <Footer />
          </section>
        );
      })}
    </>
  );
}

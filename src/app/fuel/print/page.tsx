import Image from 'next/image';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { PrintActions } from '@/components/PrintActions';

/** Formats a plain "YYYY-MM-DD" search-param string as a UK date without
 * going through the server's local timezone — shortDate() would otherwise
 * roll a UTC end-of-day boundary into the next calendar day whenever the
 * server runs somewhere ahead of UTC (British Summer Time, for instance). */
function formatIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** A printable copy of the fuel log — the whole thing by default, or just a
 * date range if one's picked first. Same bare-page, logo-header convention
 * as the checks and production print sheets. */
export default async function FuelPrint({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requirePermission('fuel.view');
  const company = getActiveCompany(user);
  const isFender = company === 'FENDER';

  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00.000Z`) : undefined;
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59.999Z`) : undefined;

  const entries = await db.fuelEntry.findMany({
    where: {
      OR: [{ assetId: null }, { asset: { OR: [{ company: null }, { company }] } }],
      ...(from || to ? { loggedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: { asset: true, loggedBy: true },
    orderBy: { loggedAt: 'desc' },
  });

  const totalLitres = entries.reduce((s, e) => s + (Number(e.litresAfter) - Number(e.litresBefore)), 0);

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={950} />

      <div className="print:hidden max-w-[950px] mx-auto px-10 pt-4">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="label" htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={searchParams.from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={searchParams.to} className="input" />
          </div>
          <button className="btn-secondary">Filter</button>
          {(searchParams.from || searchParams.to) && <a href="/fuel/print" className="text-sm text-ink-muted hover:underline">Clear</a>}
        </form>
      </div>

      <div className="p-10 max-w-[950px] mx-auto text-[13px] text-black">
        <div
          className="flex justify-between items-start border-b-2 pb-4 mb-6"
          style={{ borderColor: isFender ? 'rgb(13,74,66)' : 'rgb(230,126,34)' }}
        >
          <div>
            {isFender ? (
              <Image src="/fender-logo.png" alt="Fender" width={170} height={119} priority className="w-[170px] h-auto" />
            ) : (
              <span className="inline-block bg-[rgb(23,20,15)] rounded-md px-3 py-2">
                <Image src="/bcs-logo.png" alt="BCS Products" width={140} height={113} priority className="w-[140px] h-auto" />
              </span>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold">Fuel log</h1>
            <p>
              {searchParams.from || searchParams.to
                ? `${searchParams.from ? formatIsoDate(searchParams.from) : 'Start'} – ${searchParams.to ? formatIsoDate(searchParams.to) : 'Now'}`
                : 'All entries'}
            </p>
            <p>{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {totalLitres.toLocaleString('en-GB', { maximumFractionDigits: 1 })} L</p>
          </div>
        </div>

        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
              <th className="py-2">Vehicle</th>
              <th className="py-2">Mileage</th>
              <th className="py-2">Driver</th>
              <th className="py-2 text-right">Current reading</th>
              <th className="py-2 text-right">New reading</th>
              <th className="py-2 text-right">Litres used</th>
              <th className="py-2">Logged</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-black/10">
                <td className="py-2">{e.asset ? `${e.asset.name} (${e.asset.ref})` : `${e.otherVehicle} — not on system`}</td>
                <td className="py-2">{e.mileage.toLocaleString('en-GB')}</td>
                <td className="py-2">{e.driverName}</td>
                <td className="py-2 text-right">{Number(e.litresBefore).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className="py-2 text-right">{Number(e.litresAfter).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                <td className="py-2 text-right font-semibold">
                  {(Number(e.litresAfter) - Number(e.litresBefore)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 text-ink-muted whitespace-nowrap">
                  {shortDate(e.loggedAt)} {clock(e.loggedAt)}{e.loggedBy && ` · ${e.loggedBy.name}`}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-ink-muted">No entries in this range.</td></tr>
            )}
          </tbody>
        </table>

        <p className="text-[11px] text-ink-muted mt-8">Printed {shortDate(new Date())} {clock(new Date())}.</p>
      </div>
    </div>
  );
}

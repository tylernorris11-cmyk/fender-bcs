import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { PrintActions } from '@/components/PrintActions';

/**
 * A printable copy of one pre-use check — the paper record for the file. A
 * shared asset (no company of its own) prints under whichever company the
 * person printing it currently has open.
 */
export default async function CheckPrint({ params }: { params: { id: string } }) {
  const user = await requirePermission('checks.view');
  const check = await db.assetCheck.findUnique({
    where: { id: params.id },
    include: { asset: true, user: true, items: true },
  });
  if (!check) notFound();
  if (check.asset.company && !user.companies.includes(check.asset.company)) notFound();

  const company = check.asset.company ?? getActiveCompany(user);
  const isFender = company === 'FENDER';
  const failed = check.items.filter((i) => !i.ok);

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={820} />
      <div className="p-10 max-w-[820px] mx-auto text-[13px] text-black">
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
          <h1 className="text-xl font-bold">Pre-use check</h1>
          <p className="font-semibold">{check.asset.name} · {check.asset.ref}</p>
          <p>{shortDate(check.performedAt)} {clock(check.performedAt)}</p>
          <p className="font-bold" style={{ color: check.result === 'PASS' ? 'rgb(13,74,66)' : '#C0392B' }}>
            {check.result === 'PASS' ? 'Pass' : 'Issue flagged'}
          </p>
        </div>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
            <th className="py-2 w-8"></th><th className="py-2">Item</th><th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {check.items.map((i) => (
            <tr key={i.id} className="border-b border-black/10">
              <td className="py-2 text-center">{i.ok ? '✓' : '✕'}</td>
              <td className="py-2">{i.label}</td>
              <td className="py-2 text-ink-muted">{i.note || (i.ok ? '—' : 'Not confirmed — no note left.')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(check.notes || failed.length > 0) && (
        <div className="mb-6">
          <p className="font-bold mb-1">Overall notes</p>
          <p>{check.notes || '—'}</p>
        </div>
      )}

      {check.photo && (
        <div className="mb-6">
          <p className="font-bold mb-2">Photo</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={check.photo} alt="" className="h-40 w-40 object-cover border border-black/20" />
        </div>
      )}

      <p className="mb-6">Logged by {check.user?.name ?? 'Unknown'}</p>

      <div className="grid grid-cols-2 gap-10 pt-6 border-t border-black/20">
        <div><p className="mb-10 font-bold">Actioned by (print name)</p><div className="border-b border-black/40" /></div>
        <div><p className="mb-10 font-bold">Signature &amp; date</p><div className="border-b border-black/40" /></div>
      </div>

      <p className="text-[11px] text-ink-muted mt-8">
        Printed {shortDate(new Date())} {clock(new Date())}. Any item marked with a cross must be actioned before this
        asset goes back into use.
      </p>
      </div>
    </div>
  );
}

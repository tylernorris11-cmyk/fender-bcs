import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { clock, shortDate, tonnes } from '@/lib/format';
import { PrintActions } from '@/components/PrintActions';

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };

/**
 * A printable copy of a tally sheet — what was actually cut, bent or bundled,
 * for the file or for whoever's asking. Company branding follows the job's
 * own company, not whichever side the person printing it currently has open.
 */
export default async function ProductionJobPrint({ params }: { params: { id: string } }) {
  const user = await requirePermission('production.view');
  const job = await db.productionJob.findUnique({
    where: { id: params.id },
    include: { rows: { orderBy: { sortOrder: 'asc' } }, order: true, user: true },
  });
  if (!job) notFound();
  if (!user.companies.includes(job.company)) notFound();

  const isFender = job.company === 'FENDER';
  const totalWeight = job.rows.reduce((s, r) => s + Number(r.tallyWeightKg), 0);

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={900} />
      <div className="p-10 max-w-[900px] mx-auto text-[13px] text-black">
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
          <h1 className="text-xl font-bold">Production sheet</h1>
          <p className="font-semibold">Job {job.jobNumber}</p>
          <p>{isFender ? PROCESS_LABEL[job.process] : 'Fence post cutting'}{job.order ? ` · Order ${job.order.number}` : ''}</p>
          <p>
            {shortDate(job.startedAt)} {clock(job.startedAt)}
            {job.finishedAt ? <> – {shortDate(job.finishedAt)} {clock(job.finishedAt)}</> : ' – in progress'}
          </p>
        </div>
      </div>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
            {isFender ? (
              <>
                <th className="py-2">Dia</th><th className="py-2">Bar mark</th><th className="py-2">Cast number</th>
                <th className="py-2">Mill</th><th className="py-2 text-right">Weight</th><th className="py-2">Comments</th>
              </>
            ) : (
              <>
                <th className="py-2">Machine used</th><th className="py-2">Carbon / Soft</th>
                <th className="py-2">Diameter</th><th className="py-2 text-right">Weight of bundle</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {job.rows.map((r) => (
            <tr key={r.id} className="border-b border-black/10">
              {isFender ? (
                <>
                  <td className="py-2">{r.diaMm ? `${r.diaMm} mm` : '—'}</td>
                  <td className="py-2">{r.barMark || '—'}</td>
                  <td className="py-2">{r.castNumber || '—'}</td>
                  <td className="py-2">{r.mill || '—'}</td>
                  <td className="py-2 text-right">{Number(r.tallyWeightKg).toLocaleString('en-GB')} kg</td>
                  <td className="py-2">{r.comments || '—'}</td>
                </>
              ) : (
                <>
                  <td className="py-2">{r.machine || '—'}</td>
                  <td className="py-2">{r.steelGrade || '—'}</td>
                  <td className="py-2">{r.diaMm ? `${r.diaMm} mm` : '—'}</td>
                  <td className="py-2 text-right">{Number(r.tallyWeightKg).toLocaleString('en-GB')} kg</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-bold mb-6">
        Total {tonnes(totalWeight)} across {job.rows.length} row{job.rows.length === 1 ? '' : 's'} · Logged by {job.user?.name ?? 'Unknown'}
      </p>

      <div className="grid grid-cols-2 gap-10 pt-6 border-t border-black/20">
        <div><p className="mb-10 font-bold">Checked by (print name)</p><div className="border-b border-black/40" /></div>
        <div><p className="mb-10 font-bold">Signature &amp; date</p><div className="border-b border-black/40" /></div>
      </div>

      <p className="text-[11px] text-ink-muted mt-8">
        Printed {shortDate(new Date())} {clock(new Date())}. Figures as logged on the day.
      </p>
      </div>
    </div>
  );
}

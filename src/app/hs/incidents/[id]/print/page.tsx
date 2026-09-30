import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { clock, shortDate } from '@/lib/format';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL } from '@/lib/hs';
import { PrintActions } from '@/components/PrintActions';
import { dayLabel } from '../../../bits';

/** The incident report on paper — for the accident file, an insurer or the HSE. */
export default async function IncidentPrint({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.edit');
  const company = getActiveCompany(user);
  const i = await db.hsIncident.findUnique({
    where: { id: params.id },
    include: {
      reportedBy: { select: { name: true } },
      investigator: { select: { name: true } },
      photos: { orderBy: { addedAt: 'asc' } },
      actions: { include: { owner: { select: { name: true } } }, orderBy: { dueOn: 'asc' } },
    },
  });
  if (!i || i.company !== company) notFound();
  const isFender = company === 'FENDER';

  const rows: [string, string][] = [
    ['Type', INCIDENT_TYPE_LABEL[i.type]],
    ['Date and time', `${shortDate(i.occurredAt)} at ${clock(i.occurredAt)}`],
    ['Area', i.area],
    ['Description', i.description],
    ...(i.type === 'INCIDENT' ? [['Who was hurt', i.injuredPerson], ['Injury or damage', i.injury]] as [string, string][] : []),
    ['Immediate action', i.immediateAction],
    ['RIDDOR reportable', i.riddor ? 'Yes' : 'No'],
    ['Reported', `${shortDate(i.reportedAt)}${i.reportedBy ? ` by ${i.reportedBy.name}` : ''}`],
    ['Status', `${INCIDENT_STATUS_LABEL[i.status]}${i.closedAt ? `, closed ${shortDate(i.closedAt)}` : ''}`],
    ['Investigator', i.investigator?.name ?? ''],
    ['Findings and root cause', i.findings],
  ];

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={950} />
      <div className="p-10 max-w-[950px] mx-auto text-[13px] text-black">
        <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: isFender ? 'rgb(13,74,66)' : 'rgb(230,126,34)' }}>
          {isFender ? (
            <Image src="/fender-logo.png" alt="Fender" width={170} height={119} priority className="w-[170px] h-auto" />
          ) : (
            <span className="inline-block bg-[rgb(23,20,15)] rounded-md px-3 py-2">
              <Image src="/bcs-logo.png" alt="BCS Products" width={140} height={113} priority className="w-[140px] h-auto" />
            </span>
          )}
          <div className="text-right">
            <h1 className="text-xl font-bold">Incident report</h1>
            <p className="font-semibold">{i.ref}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-black/10 align-top">
                <td className="py-2 pr-6 w-48 text-black/60">{label}</td>
                <td className="py-2 whitespace-pre-line">{value || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {i.actions.length > 0 && (
          <>
            <h3 className="font-bold uppercase tracking-wide text-[11px] mb-2">Actions</h3>
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr className="border-y border-black/20 text-left text-[11px] uppercase tracking-wide">
                  <th className="py-2">Action</th><th className="py-2">Owner</th><th className="py-2">Due</th><th className="py-2">Done</th>
                </tr>
              </thead>
              <tbody>
                {i.actions.map((a) => (
                  <tr key={a.id} className="border-b border-black/10">
                    <td className="py-2 pr-3">{a.title}</td>
                    <td className="py-2 pr-3">{a.owner?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{dayLabel(a.dueOn)}</td>
                    <td className="py-2">{a.completedAt ? shortDate(a.completedAt) : 'Open'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {i.photos.length > 0 && (
          <>
            <h3 className="font-bold uppercase tracking-wide text-[11px] mb-2">Photos</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {i.photos.map((p, n) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={blobFileHref(p.fileUrl)} alt={`Photo ${n + 1}`} className="w-full h-48 object-cover rounded border border-black/10" />
              ))}
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-8 mt-12">
          {['Signed off by', 'Signature', 'Date'].map((l) => (
            <div key={l}>
              <div className="border-b border-black/40 h-8" />
              <p className="text-[11px] text-black/60 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

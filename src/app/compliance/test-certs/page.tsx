import Link from 'next/link';
import { FileText } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { blobFileHref } from '@/lib/blob';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';
import { confirmCastNumber, rejectCastNumber, uploadTestCertificate } from '../actions';

export default async function TestCertsPage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/test-certs" alerts={alerts.length}>
        <PageHeader title="Upload certificate" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const certificates = await db.testCertificate.findMany({
    where: { company },
    include: { uploadedBy: true, castNumbers: { include: { matchedBatch: { include: { product: true } } }, orderBy: { castNumber: 'asc' } } },
    orderBy: { uploadedAt: 'desc' },
  });

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/test-certs" alerts={alerts.length}>
      <PageHeader
        title="Upload certificate"
        blurb="Upload a mill test certificate and it reads the cast numbers off it automatically — confirm each one to file it against the matching batch."
      />

      {can(user, 'compliance.edit') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Upload a certificate</h2>
          <p className="text-sm text-ink-muted mb-4">PDF or a photo of the paper copy. One upload can cover several cast numbers.</p>
          <form action={uploadTestCertificate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="label" htmlFor="file">Certificate</label>
              <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required className="input" />
            </div>
            <button className="btn-primary">Upload &amp; read</button>
          </form>
        </section>
      )}

      {certificates.length === 0 ? (
        <Empty title="No certificates uploaded yet." />
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <section key={cert.id} className="card card-pad">
              <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <a href={blobFileHref(cert.fileUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
                    <FileText size={16} /> {cert.fileName}
                  </a>
                  <span className="text-sm text-ink-faint">
                    {shortDate(cert.uploadedAt)} {clock(cert.uploadedAt)} · {cert.uploadedBy?.name ?? '—'}
                  </span>
                </div>
                <Pill tone={cert.status === 'Reviewed' ? 'good' : cert.status === 'Failed' ? 'bad' : cert.status === 'NeedsReview' ? 'warn' : 'neutral'}>
                  {cert.status === 'NeedsReview' ? 'Needs review' : cert.status}
                </Pill>
              </header>

              {cert.status === 'Failed' && (
                <p className="banner-bad mb-2">{cert.errorMessage || 'Could not read this certificate.'}</p>
              )}

              {cert.castNumbers.length > 0 && (
                <ul className="divide-y divide-hairline text-sm">
                  {cert.castNumbers.map((cast) => (
                    <li key={cast.id} className="py-3 flex flex-wrap items-center gap-3">
                      <span className="font-bold">{cast.castNumber}</span>
                      {cast.confirmed ? (
                        <>
                          <Pill tone="good">Confirmed</Pill>
                          {cast.matchedBatch ? (
                            <Link href={`/stock/${cast.matchedBatch.productId}`} className="text-brand-700 hover:underline">
                              Matched to {cast.matchedBatch.product.name}
                            </Link>
                          ) : (
                            <span className="text-ink-muted">No batch on file yet — will match automatically when it's booked in.</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-ink-muted">Read from the document — check it against the file before confirming.</span>
                          {can(user, 'compliance.edit') && (
                            <span className="ml-auto flex gap-2">
                              <form action={confirmCastNumber}>
                                <input type="hidden" name="castId" value={cast.id} />
                                <button className="btn-primary btn-sm">Confirm</button>
                              </form>
                              <form action={rejectCastNumber}>
                                <input type="hidden" name="castId" value={cast.id} />
                                <button className="btn-secondary btn-sm">Not a cast number</button>
                              </form>
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}

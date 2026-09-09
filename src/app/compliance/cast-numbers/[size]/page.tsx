import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { CERT_SIZE_LABEL, CERT_SIZE_ORDER } from '@/lib/certExtraction';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';

export default async function CastNumbersBySizePage({ params }: { params: { size: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const size = CERT_SIZE_ORDER.find((s) => s === params.size);
  if (!size) notFound();

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/cast-numbers" alerts={alerts.length}>
        <PageHeader title="Cast numbers" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const casts = await db.extractedCastNumber.findMany({
    where: { certificate: { company, size } },
    include: {
      certificate: true,
      matchedBatch: { include: { product: true } },
    },
    orderBy: { castNumber: 'asc' },
  });

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/cast-numbers" alerts={alerts.length}>
      <PageHeader
        title={`Cast numbers — ${CERT_SIZE_LABEL[size]}`}
        blurb="Every cast/heat number read off a certificate for this size. Open certificate shows the exact document it came from."
        actions={<Link href="/compliance/cast-numbers" className="btn-secondary">All sizes</Link>}
      />

      <section className="card card-pad">
        {casts.length === 0 ? (
          <Empty title={`No cast numbers on file for ${CERT_SIZE_LABEL[size]} yet.`} />
        ) : (
          <ul className="divide-y divide-hairline">
            {casts.map((cast) => (
              <li key={cast.id} className="py-3 flex flex-wrap items-center gap-3">
                <span className="font-bold">{cast.castNumber}</span>
                {cast.confirmed ? <Pill tone="good">Confirmed</Pill> : <Pill tone="warn">Needs review</Pill>}
                {cast.matchedBatch ? (
                  <Link href={`/stock/${cast.matchedBatch.productId}`} className="text-sm text-brand-700 hover:underline">
                    Matched to {cast.matchedBatch.product.name}
                  </Link>
                ) : (
                  <span className="text-sm text-ink-muted">No batch matched yet</span>
                )}
                <a
                  href={blobFileHref(cast.certificate.fileUrl)}
                  target="_blank" rel="noreferrer"
                  className="btn-secondary btn-sm ml-auto"
                >
                  <FileText size={14} /> Open certificate
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

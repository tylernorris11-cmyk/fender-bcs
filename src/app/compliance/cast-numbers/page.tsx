import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { CERT_SIZE_LABEL, CERT_SIZE_ORDER } from '@/lib/certExtraction';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';

export default async function CastNumbersPage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

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

  // One query, counted in JS rather than a groupBy — groupBy can't group by
  // a related certificate's own field, and the cast-number count for one
  // company is small enough that this is simpler than a raw query.
  const casts = await db.extractedCastNumber.findMany({
    where: { certificate: { company } },
    select: { certificate: { select: { size: true } } },
  });
  const countBySize = new Map<string, number>();
  for (const c of casts) {
    if (!c.certificate.size) continue;
    countBySize.set(c.certificate.size, (countBySize.get(c.certificate.size) ?? 0) + 1);
  }

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/cast-numbers" alerts={alerts.length}>
      <PageHeader
        title="Cast numbers"
        blurb="Every cast/heat number read off a certificate, by bar size — pick a size to see them all with a button through to the certificate each one came from."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CERT_SIZE_ORDER.map((size) => {
          const count = countBySize.get(size) ?? 0;
          return (
            <Link
              key={size}
              href={`/compliance/cast-numbers/${size}`}
              className="card card-pad hover:border-brand/40 transition-colors flex items-center justify-between"
            >
              <span className="text-lg font-bold">{CERT_SIZE_LABEL[size]}</span>
              <span className="text-sm text-ink-muted">{count} cast{count === 1 ? '' : 's'}</span>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

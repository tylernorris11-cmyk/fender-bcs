import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { uploadComplianceDocument } from '../actions';
import { ComplianceDocumentRow } from '../ComplianceDocumentRow';

const CATEGORIES = ['FCP_DATA', 'COSHH'] as const;
const CATEGORY_LABEL: Record<string, string> = {
  FCP_DATA: 'FCP data sheet',
  COSHH: 'COSHH sheet',
};

/** A place to keep FCP product data sheets and COSHH (hazardous substance) safety data sheets — reuses the same document storage as CARES documents, just its own section and categories. No AI extraction here (that's only for mill certs) — a plain upload/download/rename filing cabinet. */
export default async function FcpCoshPage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/fcp-cosh" alerts={alerts.length}>
        <PageHeader title="FCP Data & Cosh sheets" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const documents = await db.complianceDocument.findMany({
    where: { company, archived: false, category: { in: [...CATEGORIES] } },
    include: { uploadedBy: true },
    orderBy: [{ category: 'asc' }, { uploadedAt: 'desc' }],
  });
  const canEdit = can(user, 'compliance.edit');

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/fcp-cosh" alerts={alerts.length}>
      <PageHeader
        title="FCP Data & Cosh sheets"
        blurb="Product technical data sheets and COSHH safety data sheets for hazardous substances."
      />

      {canEdit && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">Upload a sheet</h2>
          <form action={uploadComplianceDocument} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" name="title" required className="input" placeholder="e.g. Cemrok — technical data sheet" />
            </div>
            <div>
              <label className="label" htmlFor="category">Type</label>
              <select id="category" name="category" defaultValue="FCP_DATA" className="input">
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="file">File</label>
              <input id="file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" className="input" />
            </div>
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {documents.length === 0 ? <Empty title="No data or COSHH sheets uploaded yet." /> : (
          <ul className="divide-y divide-hairline">
            {documents.map((d) => (
              <ComplianceDocumentRow
                key={d.id}
                canEdit={canEdit}
                doc={{
                  id: d.id,
                  title: d.title,
                  fileUrl: d.fileUrl,
                  fileName: d.fileName,
                  categoryLabel: CATEGORY_LABEL[d.category] ?? d.category,
                  uploadedByName: d.uploadedBy?.name ?? 'Unknown',
                  uploadedLabel: shortDate(d.uploadedAt),
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

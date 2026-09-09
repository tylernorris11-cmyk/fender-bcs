import { FileText } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { shortDate } from '@/lib/format';
import { blobFileHref } from '@/lib/blob';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { archiveComplianceDocument, uploadComplianceDocument } from '../actions';

const CATEGORY_LABEL: Record<string, string> = {
  PROCEDURE: 'Procedure',
  CARES_GUIDANCE: 'CARES guidance',
  SCOPE_OF_APPROVAL: 'Scope of approval',
  OTHER: 'Other',
};

export default async function ComplianceDocumentsPage() {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/documents" alerts={alerts.length}>
        <PageHeader title="CARES documents" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const documents = await db.complianceDocument.findMany({
    where: { company, archived: false },
    include: { uploadedBy: true },
    orderBy: [{ category: 'asc' }, { uploadedAt: 'desc' }],
  });

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/documents" alerts={alerts.length}>
      <PageHeader
        title="CARES documents"
        blurb="Reference material — CARES's own guidance, our written procedures, scope of approval. Not certificates — those are under Upload certificate and Suppliers."
      />

      {can(user, 'compliance.edit') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">Upload a document</h2>
          <form action={uploadComplianceDocument} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" name="title" required className="input" placeholder="CARES SRC21 — cast/product traceability procedure" />
            </div>
            <div>
              <label className="label" htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue="OTHER" className="input">
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
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
        {documents.length === 0 ? <Empty title="No CARES documents uploaded yet." /> : (
          <ul className="divide-y divide-hairline">
            {documents.map((d) => (
              <li key={d.id} className="py-4 flex flex-wrap items-center gap-4">
                <span className="inline-grid place-items-center h-10 w-10 rounded-xl bg-teal-100 text-teal-700 shrink-0">
                  <FileText size={18} />
                </span>
                <div className="flex-1 min-w-[200px]">
                  <a href={blobFileHref(d.fileUrl)} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
                    {d.title}
                  </a>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {d.uploadedBy?.name ?? 'Unknown'} · {shortDate(d.uploadedAt)}
                  </p>
                </div>
                <Pill tone="neutral">{CATEGORY_LABEL[d.category] ?? d.category}</Pill>
                {can(user, 'compliance.edit') && (
                  <form action={archiveComplianceDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn-secondary btn-sm">Archive</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

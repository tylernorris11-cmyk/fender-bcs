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
import { archiveHseDocument, uploadHseDocument } from '../actions';

const CATEGORY_LABEL: Record<string, string> = {
  POLICY: 'Policy',
  RAMS: 'RAMS',
  COSHH: 'COSHH',
  METHOD_STATEMENT: 'Method statement',
  OTHER: 'Other',
};

export default async function HsDocumentsPage() {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const documents = await db.hseDocument.findMany({
    where: { archived: false, OR: [{ company: null }, { company }] },
    include: { uploadedBy: true },
    orderBy: [{ category: 'asc' }, { uploadedAt: 'desc' }],
  });

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/documents" alerts={alerts.length}>
      <PageHeader title="Documents" blurb="Policies, RAMS, COSHH sheets and method statements." />

      {can(user, 'hs.edit') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">Upload a document</h2>
          <form action={uploadHseDocument} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" name="title" required className="input" placeholder="Manual handling policy" />
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
              <label className="label" htmlFor="company">Applies to</label>
              <select id="company" name="company" defaultValue="" className="input">
                <option value="">Both companies</option>
                {user.companies.map((c) => <option key={c} value={c}>{c === 'FENDER' ? 'Fender Steel' : 'BCS Products'}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="file">File</label>
              <input id="file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" className="input" />
            </div>
            <button className="btn-primary">Upload</button>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {documents.length === 0 ? <Empty title="No H&S documents uploaded yet." /> : (
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
                {can(user, 'hs.edit') && (
                  <form action={archiveHseDocument}>
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

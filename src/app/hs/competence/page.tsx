import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, Plus, Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { canAny } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { blobFileHref } from '@/lib/blob';
import { isoDateUk } from '@/lib/format';
import { EXPIRY_WARNING_DAYS, HS_COURSES, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, dayInput, ticketStatus } from '@/lib/hs';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { UrlModal } from '@/components/UrlModal';
import { AutoSubmitForm } from '../AutoSubmitForm';
import { ConfirmDeleteForm } from '@/components/ConfirmDeleteForm';
import { Chip, TabLinks, dayLabel } from '../bits';
import { deleteTrainingRecord, saveTrainingRecord } from './actions';

const TABS = [{ key: 'all', label: 'All personnel' }, { key: 'expiring', label: 'Expiring soon' }, { key: 'expired', label: 'Expired' }] as const;

type Params = { tab?: string; course?: string; q?: string; add?: string; record?: string };

export default async function CompetencePage({ searchParams }: { searchParams: Params }) {
  const user = await requireUser();
  if (!canAny(user, 'hs.edit', 'hs.manageTraining')) redirect('/no-access?needed=hs.edit');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const today = isoDateUk();

  // Records for people on this company's side, plus anyone without an account.
  const all = (await db.hsTrainingRecord.findMany({
    where: { OR: [{ userId: null }, { user: { companies: { has: company } } }] },
    include: { user: { select: { name: true, colour: true } } },
  }))
    .map((r) => ({ ...r, who: r.user?.name ?? r.personName, status: ticketStatus(r, today) }))
    .sort((a, b) => a.who.localeCompare(b.who) || a.course.localeCompare(b.course));

  const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? 'all';
  const inTab = (r: (typeof all)[number], key: string) =>
    key === 'expiring' ? r.status === 'EXPIRING' : key === 'expired' ? r.status === 'EXPIRED' : true;
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const rows = all
    .filter((r) => inTab(r, tab))
    .filter((r) => !searchParams.course || r.course === searchParams.course)
    .filter((r) => !q || `${r.who} ${r.course}`.toLowerCase().includes(q));
  const courses = [...new Set(all.map((r) => r.course))].sort();

  const keep = new URLSearchParams(Object.entries({ tab: tab === 'all' ? '' : tab, course: searchParams.course, q: searchParams.q }).filter(([, v]) => v) as [string, string][]).toString();
  const here = `/hs/competence${keep ? `?${keep}` : ''}`;
  const withParam = (k: string, v: string) => `${here}${keep ? '&' : '?'}${k}=${v}`;
  const editing = searchParams.record ? all.find((r) => r.id === searchParams.record) : undefined;
  const showForm = searchParams.add === '1' || !!editing;
  const people = showForm ? await hsPeople(company) : [];

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/competence" alerts={alerts.length}>
      <PageHeader
        title="Training & Competence"
        blurb="Who's trained and ticketed for what, and when it runs out."
        actions={<Link href={withParam('add', '1')} scroll={false} className="btn-primary"><Plus size={16} /> Add training record</Link>}
      />

      <section className="card card-pad">
        <TabLinks
          active={tab}
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === 'all' ? '/hs/competence' : `/hs/competence?tab=${t.key}`, count: all.filter((r) => inTab(r, t.key)).length }))}
        />
        <AutoSubmitForm className="flex flex-wrap gap-3 mb-4">
          {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
          <label className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="q" defaultValue={searchParams.q} placeholder="Search people…" className="input pl-10" aria-label="Search people" />
          </label>
          <select name="course" defaultValue={searchParams.course ?? ''} className="input w-auto min-w-[180px]" aria-label="Training">
            <option value="">All training types</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </AutoSubmitForm>

        {rows.length === 0 ? (
          <Empty title={all.length === 0 ? 'No training records yet. Add the tickets and certificates people hold.' : 'Nothing matches those filters.'} />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Training</th>
                  <th className="th">Achieved</th>
                  <th className="th">Expiry date</th>
                  <th className="th">Status</th>
                  <th className="th"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="row">
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.who} colour={r.user?.colour ?? '#94A3B8'} size={26} />
                        <span className="font-medium">{r.who}</span>
                      </span>
                    </td>
                    <td className="td">
                      {r.course}
                      {r.certificateUrl && (
                        <a href={blobFileHref(r.certificateUrl)} target="_blank" rel="noreferrer" aria-label="Open certificate" className="inline-block ml-1.5 text-ink-faint hover:text-brand-700">
                          <FileText size={13} />
                        </a>
                      )}
                    </td>
                    <td className="td text-ink-muted whitespace-nowrap">{dayLabel(r.achievedOn)}</td>
                    <td className="td whitespace-nowrap">{r.expiresOn ? dayLabel(r.expiresOn) : <span className="text-ink-faint">Doesn&apos;t expire</span>}</td>
                    <td className="td"><Chip tone={TICKET_STATUS_TONE[r.status]}>{TICKET_STATUS_LABEL[r.status]}</Chip></td>
                    <td className="td text-right">
                      <Link href={withParam('record', r.id)} scroll={false} className="btn-secondary btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink-faint mt-4">Flagged as expiring {EXPIRY_WARNING_DAYS} days before the expiry date, time enough to book a refresher.</p>
      </section>

      {showForm && (
        <UrlModal closeHref={here} title={<h2 className="text-xl font-bold">{editing ? `${editing.who}: ${editing.course}` : 'Add training record'}</h2>}>
          <form action={saveTrainingRecord} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="userId">Person</label>
                <select id="userId" name="userId" defaultValue={editing?.userId ?? ''} className="input">
                  <option value="">Not on the app — type their name</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="personName">Name if not on the app</label>
                <input id="personName" name="personName" defaultValue={editing?.personName} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="course">Training or ticket</label>
              <input id="course" name="course" required list="hs-courses" defaultValue={editing?.course} className="input" placeholder="Forklift (counterbalance)" />
              <datalist id="hs-courses">{[...new Set([...HS_COURSES, ...courses])].map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="achievedOn">Achieved</label>
                <input id="achievedOn" name="achievedOn" type="date" defaultValue={dayInput(editing?.achievedOn)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="expiresOn">Expires</label>
                <input id="expiresOn" name="expiresOn" type="date" defaultValue={dayInput(editing?.expiresOn)} className="input" />
                <p className="hint">Leave blank if it doesn&apos;t expire.</p>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="certificate">Certificate (optional)</label>
              {editing?.certificateUrl && (
                <div className="flex flex-wrap items-center gap-4 mb-2 text-sm">
                  <a href={blobFileHref(editing.certificateUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
                    <FileText size={15} /> {editing.certificateName || 'Current certificate'}
                  </a>
                  <label className="inline-flex items-center gap-2 text-ink-muted">
                    <input type="checkbox" name="removeCertificate" className="h-4 w-4 accent-brand" /> Remove it
                  </label>
                </div>
              )}
              <input id="certificate" name="certificate" type="file" className="input"
                accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes (optional)</label>
              <textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes} className="input" placeholder="Training provider, card number…" />
            </div>
            <div className="flex justify-end gap-2">
              <Link href={here} scroll={false} className="btn-secondary">Cancel</Link>
              <SubmitButton pendingLabel="Saving…">{editing ? 'Save changes' : 'Add record'}</SubmitButton>
            </div>
          </form>
          {editing && (
            <div className="mt-4 pt-4 border-t border-hairline">
              <ConfirmDeleteForm action={deleteTrainingRecord} id={editing.id} label="Delete this record" question="Delete it for good?" />
            </div>
          )}
        </UrlModal>
      )}
    </Shell>
  );
}

import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { blobFileHref } from '@/lib/blob';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { completeOtherWorkTask, createOtherWorkTask, logOtherWork } from '../actions';

export default async function OtherWorkPage() {
  const user = await requirePermission('production.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [open, recent] = await Promise.all([
    db.otherWorkTask.findMany({ where: { company, status: 'Open' }, include: { createdBy: true }, orderBy: { createdAt: 'desc' } }),
    db.otherWorkTask.findMany({
      where: { company, status: 'Done' },
      include: { createdBy: true, doneBy: true },
      orderBy: { doneAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <Shell user={user} module="production" nav={NAV.production} current="/production/other-work" alerts={alerts.length}>
      <PageHeader title="Other work" blurb="Jobs that aren't a customer order — things that need doing, and work you've done that isn't production." />

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">Needs doing</h2>
        {open.length === 0 ? <Empty title="Nothing posted right now." /> : (
          <ul className="divide-y divide-hairline">
            {open.map((t) => (
              <li key={t.id} className="py-4 flex flex-wrap items-start gap-4">
                {t.photoUrl && (
                  <a href={blobFileHref(t.photoUrl)} target="_blank" rel="noreferrer">
                    <img src={blobFileHref(t.photoUrl)} alt="" className="w-20 h-20 object-cover rounded-lg border border-hairline" />
                  </a>
                )}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold">{t.title}</p>
                  {t.description && <p className="text-sm text-ink-muted mt-0.5 whitespace-pre-line">{t.description}</p>}
                  <p className="text-xs text-ink-faint mt-1">
                    Posted by {t.createdBy.name} · {shortDate(t.createdAt)} {clock(t.createdAt)}
                  </p>
                </div>
                {can(user, 'production.progress') && (
                  <form action={completeOtherWorkTask} className="flex items-end gap-2">
                    <input type="hidden" name="taskId" value={t.id} />
                    <input name="doneNote" className="input w-48" placeholder="Any note (optional)" aria-label="Done note" />
                    <button className="btn-primary btn-sm">Mark done</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(user, 'production.progress') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Log work you&apos;ve done</h2>
          <p className="text-sm text-ink-muted mb-4">Nothing to cut or bend right now? Log what you got on with instead.</p>
          <form action={logOtherWork} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="title">What did you do</label>
              <input id="title" name="title" required className="input" placeholder="Swept and tidied bay 3" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="description">Details (optional)</label>
              <input id="description" name="description" className="input" />
            </div>
            <button className="btn-primary">Log it</button>
          </form>
        </section>
      )}

      {can(user, 'production.assign') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Post a job</h2>
          <p className="text-sm text-ink-muted mb-4">Something that needs doing that isn&apos;t a customer order — add a photo for context if it helps.</p>
          <form action={createOtherWorkTask} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="newTitle">Title</label>
              <input id="newTitle" name="title" required className="input" placeholder="Fix the fence by the weighbridge" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label" htmlFor="newDescription">Details</label>
              <input id="newDescription" name="description" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="photo">Photo (optional)</label>
              <input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
            </div>
            <button className="btn-primary">Post job</button>
          </form>
        </section>
      )}

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-4">Recently done</h2>
        {recent.length === 0 ? <Empty title="Nothing logged yet." /> : (
          <ul className="divide-y divide-hairline">
            {recent.map((t) => (
              <li key={t.id} className="py-3">
                <p className="font-semibold">{t.title}</p>
                {t.description && <p className="text-sm text-ink-muted mt-0.5 whitespace-pre-line">{t.description}</p>}
                {t.doneNote && <p className="text-sm text-ink-muted mt-0.5">{t.doneNote}</p>}
                <p className="text-xs text-ink-faint mt-1">
                  {t.createdById === t.doneById
                    ? <>Logged by {t.doneBy?.name ?? '—'}</>
                    : <>Posted by {t.createdBy.name}, done by {t.doneBy?.name ?? '—'}</>} · {t.doneAt && <>{shortDate(t.doneAt)} {clock(t.doneAt)}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

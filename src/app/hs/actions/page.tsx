import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { isoDateUk } from '@/lib/format';
import { ACTION_STATUS_LABEL, ACTION_STATUS_TONE, ASSESSMENT_KIND, actionStatus } from '@/lib/hs';
import { hsPeople } from '@/lib/hsPeople';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { UrlModal } from '@/components/UrlModal';
import { createHsAction, deleteHsAction } from '../action-items';
import { ActionTick } from '../ActionsPanel';
import { Chip, TabLinks, dayLabel } from '../bits';

const TABS = [
  { key: 'open', label: 'Open' }, { key: 'overdue', label: 'Overdue' }, { key: 'mine', label: 'Mine' },
  { key: 'done', label: 'Completed' }, { key: 'all', label: 'All' },
] as const;

export default async function HsActionsPage({ searchParams }: { searchParams: { tab?: string; add?: string } }) {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canEdit = can(user, 'hs.edit');
  const today = isoDateUk();

  // Everyone else sees just the actions they own.
  const all = (await db.hsAction.findMany({
    where: { company, ...(canEdit ? {} : { ownerId: user.id }) },
    include: {
      owner: { select: { name: true } },
      incident: { select: { id: true, ref: true } },
      assessment: { select: { id: true, ref: true, kind: true } },
    },
    orderBy: [{ dueOn: 'asc' }],
  })).map((a) => ({ ...a, status: actionStatus(a, today) }));

  const tabs = TABS.filter((t) => canEdit || t.key !== 'mine');
  const tab = tabs.find((t) => t.key === searchParams.tab)?.key ?? 'open';
  const match = (a: (typeof all)[number], key: string) =>
    key === 'open' ? a.status !== 'COMPLETE'
      : key === 'overdue' ? a.status === 'OVERDUE'
        : key === 'mine' ? a.ownerId === user.id && a.status !== 'COMPLETE'
          : key === 'done' ? a.status === 'COMPLETE'
            : true;
  const rows = all.filter((a) => match(a, tab));
  if (tab === 'done') rows.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const people = canEdit ? await hsPeople(company) : [];
  const here = `/hs/actions${tab === 'open' ? '' : `?tab=${tab}`}`;
  const weekOn = new Date(Date.parse(today) + 7 * 86_400_000).toISOString().slice(0, 10);

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/actions" alerts={alerts.length}>
      <PageHeader
        title="Actions"
        blurb={canEdit ? 'Everything that needs doing to make things safer, and who\'s doing it.' : 'The H&S actions given to you. Tick one off when it\'s done.'}
        actions={canEdit && (
          <Link href={`${here}${here.includes('?') ? '&' : '?'}add=1`} scroll={false} className="btn-primary"><Plus size={16} /> New action</Link>
        )}
      />

      <section className="card card-pad">
        <TabLinks
          active={tab}
          tabs={tabs.map((t) => ({ key: t.key, label: t.label, href: t.key === 'open' ? '/hs/actions' : `/hs/actions?tab=${t.key}`, count: all.filter((a) => match(a, t.key)).length }))}
        />

        {rows.length === 0 ? (
          <Empty title={tab === 'overdue' ? 'Nothing overdue.' : tab === 'done' ? 'Nothing completed yet.' : 'No actions here.'} />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th w-10"><span className="sr-only">Done</span></th>
                  <th className="th">Action</th>
                  <th className="th">From</th>
                  <th className="th">Owner</th>
                  <th className="th">Due</th>
                  <th className="th">Status</th>
                  {canEdit && <th className="th w-10"><span className="sr-only">Delete</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="row">
                    <td className="td"><ActionTick action={a} allowed={canEdit || a.ownerId === user.id} /></td>
                    <td className="td">
                      <p className={`font-medium ${a.completedAt ? 'line-through text-ink-faint' : ''}`}>{a.title}</p>
                      {a.note && <p className="text-xs text-ink-muted">{a.note}</p>}
                    </td>
                    <td className="td whitespace-nowrap">
                      {a.incident ? (
                        canEdit ? <Link href={`/hs/incidents/${a.incident.id}`} className="text-brand-700 hover:underline">{a.incident.ref}</Link> : a.incident.ref
                      ) : a.assessment ? (
                        <Link href={`${ASSESSMENT_KIND[a.assessment.kind].path}/${a.assessment.id}`} className="text-brand-700 hover:underline">{a.assessment.ref}</Link>
                      ) : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="td text-ink-muted">{a.owner?.name ?? '—'}</td>
                    <td className="td whitespace-nowrap">{dayLabel(a.dueOn)}</td>
                    <td className="td"><Chip tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Chip></td>
                    {canEdit && (
                      <td className="td">
                        <form action={deleteHsAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" aria-label={`Delete: ${a.title}`} title="Delete — raised by mistake" className="text-ink-faint hover:text-signal">
                            <Trash2 size={16} />
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit && searchParams.add === '1' && (
        <UrlModal closeHref={here} title={<h2 className="text-xl font-bold">New action</h2>}>
          <form action={createHsAction} className="space-y-4">
            <input type="hidden" name="returnTo" value={here} />
            <div>
              <label className="label" htmlFor="title">What needs doing</label>
              <input id="title" name="title" required autoFocus className="input" placeholder="Replace worn slings on the overhead crane" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ownerId">Owner</label>
                <select id="ownerId" name="ownerId" defaultValue="" className="input">
                  <option value="">No owner</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dueOn">Due</label>
                <input id="dueOn" name="dueOn" type="date" required defaultValue={weekOn} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="note">Note (optional)</label>
              <textarea id="note" name="note" rows={2} className="input" />
            </div>
            <div className="flex justify-end gap-2">
              <Link href={here} scroll={false} className="btn-secondary">Cancel</Link>
              <SubmitButton pendingLabel="Adding…">Add action</SubmitButton>
            </div>
          </form>
        </UrlModal>
      )}
    </Shell>
  );
}

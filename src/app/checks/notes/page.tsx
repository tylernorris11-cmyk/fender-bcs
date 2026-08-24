import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader } from '@/components/ui';
import { addNote } from './actions';

export default async function CheckNotesPage() {
  const user = await requirePermission('checks.view');
  const alerts = await getAlerts(user);
  const notes = await db.note.findMany({ include: { user: true }, orderBy: { at: 'desc' }, take: 100 });

  return (
    <Shell user={user} module="checks" nav={NAV.checks} current="/checks/notes" alerts={alerts.length}>
      <PageHeader title="Notes" blurb="Anything worth logging that isn't tied to a specific check — a shared notepad for the yard." />

      {can(user, 'checks.create') && (
        <section className="card card-pad mb-6">
          <form action={addNote} className="flex flex-col sm:flex-row gap-3">
            <textarea name="body" required rows={2} className="input flex-1" placeholder="Add a note…" aria-label="New note" />
            <button className="btn-primary self-start">Add note</button>
          </form>
        </section>
      )}

      <section className="card card-pad">
        {notes.length === 0 ? <Empty title="No notes yet." /> : (
          <ul className="divide-y divide-hairline">
            {notes.map((n) => (
              <li key={n.id} className="py-3 flex items-start gap-3">
                {n.user && <Avatar name={n.user.name} colour={n.user.colour} size={30} />}
                <div>
                  <p className="text-sm whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-ink-faint mt-1">{n.user?.name ?? 'Unknown'} · {shortDate(n.at)} {clock(n.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

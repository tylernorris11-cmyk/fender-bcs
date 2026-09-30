import { Check } from 'lucide-react';
import type { HsAction } from '@prisma/client';
import { isoDateUk } from '@/lib/format';
import { ACTION_STATUS_LABEL, ACTION_STATUS_TONE, actionStatus } from '@/lib/hs';
import { SubmitButton } from '@/components/SubmitButton';
import { createHsAction, setHsActionDone } from './action-items';
import { Chip, dayLabel } from './bits';

type Row = HsAction & { owner: { name: string } | null };

/** The tick box that completes an action, or opens it again. */
export function ActionTick({ action, allowed }: { action: Pick<HsAction, 'id' | 'title' | 'completedAt'>; allowed: boolean }) {
  const done = !!action.completedAt;
  const box = (
    <span className={`grid place-items-center h-5 w-5 rounded-md border-2 ${done ? 'bg-brand border-brand text-white' : 'border-hairline bg-white'}`}>
      {done && <Check size={13} strokeWidth={3.5} />}
    </span>
  );
  if (!allowed) return box;
  return (
    <form action={setHsActionDone}>
      <input type="hidden" name="id" value={action.id} />
      <input type="hidden" name="done" value={done ? '0' : '1'} />
      <button type="submit" aria-label={done ? `Reopen: ${action.title}` : `Mark done: ${action.title}`} title={done ? 'Tap to reopen' : 'Tap to mark done'}
        className="block rounded-md transition-transform hover:scale-110 active:scale-90">
        {box}
      </button>
    </form>
  );
}

/** Actions raised against one incident or assessment, with a form to raise another. */
export function ActionsPanel({
  actions, people, incidentId, assessmentId, canEdit, userId,
}: {
  actions: Row[];
  people: { id: string; name: string }[];
  incidentId?: string;
  assessmentId?: string;
  canEdit: boolean;
  userId: string;
}) {
  const today = isoDateUk();
  const weekOn = new Date(Date.parse(today) + 7 * 86_400_000).toISOString().slice(0, 10);

  return (
    <section className="card card-pad">
      <h2 className="text-lg font-bold mb-3">Actions</h2>
      {actions.length === 0 ? (
        <p className="text-sm text-ink-muted mb-4">No actions raised yet.</p>
      ) : (
        <ul className="divide-y divide-hairline mb-4">
          {actions.map((a) => {
            const status = actionStatus(a, today);
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <ActionTick action={a} allowed={canEdit || a.ownerId === userId} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${a.completedAt ? 'line-through text-ink-faint' : ''}`}>{a.title}</p>
                  <p className="text-xs text-ink-muted">{a.owner?.name ?? 'No owner'} · due {dayLabel(a.dueOn)}</p>
                </div>
                <Chip tone={ACTION_STATUS_TONE[status]}>{ACTION_STATUS_LABEL[status]}</Chip>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form action={createHsAction} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end border-t border-hairline pt-4">
          {incidentId && <input type="hidden" name="incidentId" value={incidentId} />}
          {assessmentId && <input type="hidden" name="assessmentId" value={assessmentId} />}
          <div>
            <label className="label text-xs" htmlFor="action-title">New action</label>
            <input id="action-title" name="title" required className="input py-2" placeholder="Additional PPE briefing" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="action-owner">Owner</label>
            <select id="action-owner" name="ownerId" defaultValue="" className="input py-2 w-auto">
              <option value="">No owner</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="action-due">Due</label>
            <input id="action-due" name="dueOn" type="date" required defaultValue={weekOn} className="input py-2 w-auto" />
          </div>
          <SubmitButton className="btn-primary py-2" pendingLabel="Adding…">Add</SubmitButton>
        </form>
      )}
    </section>
  );
}

import { Trash2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { addChecklistTemplate, removeChecklistTemplate } from '../actions';

export default async function ChecklistSetupPage() {
  const user = await requirePermission('setup.lists');
  const alerts = await getAlerts(user);
  const items = await db.checklistTemplate.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/checklist" alerts={alerts.length}>
      <PageHeader title="Order checklist" blurb="Applied to every new order. This is the in-process and final inspection record an auditor asks to see." />

      <section className="card card-pad max-w-2xl">
        <ol className="divide-y divide-hairline mb-5">
          {items.map((item, i) => (
            <li key={item.id} className="py-3 flex items-center gap-3">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-forest grid place-items-center text-xs font-bold">{i + 1}</span>
              <span className="flex-1">{item.label}</span>
              <form action={removeChecklistTemplate}>
                <input type="hidden" name="templateId" value={item.id} />
                <button className="text-ink-faint hover:text-signal p-1" aria-label={`Remove: ${item.label}`}><Trash2 size={16} /></button>
              </form>
            </li>
          ))}
          {items.length === 0 && <li className="py-3 text-ink-muted">Nothing on the checklist yet.</li>}
        </ol>

        <form action={addChecklistTemplate} className="flex gap-2">
          <input name="label" required className="input flex-1" placeholder="e.g. Bending schedule checked against customer drawing" aria-label="New checklist step" />
          <button className="btn-primary">Add step</button>
        </form>
        <p className="hint mt-4">
          Changing this list does not touch orders already raised — theirs stay as they were when the job ran, which is what the audit trail needs.
        </p>
      </section>
    </Shell>
  );
}

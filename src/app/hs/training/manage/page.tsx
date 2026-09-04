import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';
import { createTrainingModule, setMachineTrainingAssignments, updateTrainingModule } from '../../actions';

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: 'Yard induction (required for everyone)',
  PPE: 'PPE (required for everyone)',
  MACHINE: 'Machine-specific (assigned per person)',
};

export default async function ManageTrainingPage({ searchParams }: { searchParams: { edit?: string } }) {
  const user = await requirePermission('hs.manageTraining');
  const alerts = await getAlerts(user);
  const isMaster = user.role === 'MASTER_ADMIN';

  const [modules, users, assignments] = await Promise.all([
    db.trainingModule.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    db.user.findMany({
      where: { active: true, ...(isMaster ? {} : { companies: { hasSome: user.companies } }) },
      orderBy: { name: 'asc' },
    }),
    db.userTrainingAssignment.findMany({ select: { userId: true, moduleId: true } }),
  ]);

  const machineModules = modules.filter((m) => m.category === 'MACHINE' && m.active);
  const assignedSet = new Set(assignments.map((a) => `${a.userId}:${a.moduleId}`));

  const editing = searchParams.edit ? modules.find((m) => m.id === searchParams.edit) : undefined;

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs/training/manage" alerts={alerts.length}>
      <PageHeader title="Manage training" blurb="Author training modules and assign machine training per person." />

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">{editing ? `Edit — ${editing.title}` : 'New module'}</h2>
        <form action={editing ? updateTrainingModule : createTrainingModule} className="grid gap-4 sm:grid-cols-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required defaultValue={editing?.title} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={editing?.category ?? 'GENERAL'} className="input">
              <option value="GENERAL">Yard induction — required for everyone</option>
              <option value="PPE">PPE — required for everyone</option>
              <option value="MACHINE">Machine-specific — assigned per person</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="machineName">Machine name (if machine-specific)</label>
            <input id="machineName" name="machineName" defaultValue={editing?.machineName} className="input" placeholder="Power Bender" />
          </div>
          <div>
            <label className="label" htmlFor="company">Applies to</label>
            <select id="company" name="company" defaultValue={editing?.company ?? ''} className="input">
              <option value="">Both companies</option>
              {user.companies.map((c) => <option key={c} value={c}>{c === 'FENDER' ? 'Fender Steel' : 'BCS Products'}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="summary">Summary</label>
            <input id="summary" name="summary" defaultValue={editing?.summary} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="content">Content — one point per line</label>
            <textarea id="content" name="content" rows={8} className="input" defaultValue={editing?.content.join('\n')} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing.active} className="h-4 w-4 accent-brand" />
              Active
            </label>
          )}
          <div className="sm:col-span-2">
            <button className="btn-primary">{editing ? 'Save changes' : 'Create module'}</button>
          </div>
        </form>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-4">All modules</h2>
        {modules.length === 0 ? <Empty title="No modules created yet." /> : (
          <ul className="divide-y divide-hairline">
            {modules.map((m) => (
              <li key={m.id} className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold">{m.title}{m.machineName && ` — ${m.machineName}`}</p>
                  <p className="text-xs text-ink-faint mt-0.5">{CATEGORY_LABEL[m.category]}</p>
                </div>
                {!m.active && <Pill tone="neutral">Inactive</Pill>}
                <a href={`/hs/training/manage?edit=${m.id}`} className="text-brand-700 text-sm font-semibold hover:underline">Edit</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {machineModules.length > 0 && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Machine training assignments</h2>
          <p className="text-sm text-ink-muted mb-4">
            Tick which machines apply to each person — that module becomes required for them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr>
                  <th className="th text-left">Person</th>
                  {machineModules.map((m) => (
                    <th key={m.id} className="th text-center whitespace-nowrap px-2">{m.machineName || m.title}</th>
                  ))}
                  <th className="th sr-only">Save</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="row">
                    <td className="td font-semibold whitespace-nowrap">{u.name}</td>
                    {machineModules.map((m) => (
                      <td key={m.id} className="td text-center">
                        <input
                          type="checkbox" form={`assign-${u.id}`} name="moduleIds" value={m.id}
                          defaultChecked={assignedSet.has(`${u.id}:${m.id}`)}
                          className="h-4 w-4 accent-brand" aria-label={`${u.name} — ${m.machineName || m.title}`}
                        />
                      </td>
                    ))}
                    <td className="td">
                      <form id={`assign-${u.id}`} action={setMachineTrainingAssignments}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="btn-secondary btn-sm">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}

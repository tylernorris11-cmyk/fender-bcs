import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Role } from '@prisma/client';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { PERMISSION_GROUPS, PERMISSIONS, ROLE_BLURBS, ROLE_LABELS, rolePermissionsFrom } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { resetRolePermissions, saveRolePermissions } from '../../actions';

/**
 * One role's permissions, grouped the way the app is, to tick on and off.
 * Anything that differs from the role's defaults is marked, and it can be
 * put back in one go. The Master Administrator role always has everything.
 */
export default async function RolePage({ params }: { params: { role: string } }) {
  const user = await requirePermission('setup.users');
  if (!(params.role in ROLE_LABELS)) notFound();
  const role = params.role as Role;
  const alerts = await getAlerts(user);
  const [saved, people] = await Promise.all([
    db.rolePermissionSet.findUnique({ where: { role } }),
    db.user.findMany({ where: { role, active: true }, select: { name: true }, orderBy: { name: 'asc' } }),
  ]);

  const isMaster = role === 'MASTER_ADMIN';
  const canEdit = user.role === 'MASTER_ADMIN' && !isMaster;
  const current = new Set(rolePermissionsFrom(role, saved?.permissions));
  const defaults = new Set(PERMISSIONS[role]);
  const changed = PERMISSION_GROUPS.flatMap((g) => g.perms).filter((p) => current.has(p.key) !== defaults.has(p.key)).length;

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/roles" alerts={alerts.length}>
      <Link href="/setup/roles" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> All roles
      </Link>
      <PageHeader title={ROLE_LABELS[role]} blurb={ROLE_BLURBS[role]} />

      <section className="card card-pad mb-6 text-sm space-y-1.5">
        <p>
          <strong>{people.length}</strong> {people.length === 1 ? 'person has' : 'people have'} this role
          {people.length > 0 && <span className="text-ink-muted">: {people.map((p) => p.name).join(', ')}</span>}
        </p>
        {isMaster ? (
          <p className="text-ink-muted">A Master Administrator can always do everything, so there&apos;s always a way back in. It can&apos;t be changed.</p>
        ) : saved ? (
          <p className="text-ink-muted">
            Changed by {saved.updatedBy || 'someone'} on {shortDate(saved.updatedAt)} — {changed} {changed === 1 ? 'difference' : 'differences'} from the defaults, marked below.
          </p>
        ) : (
          <p className="text-ink-muted">These are the role&apos;s defaults.</p>
        )}
        {!canEdit && !isMaster && <p className="text-ink-muted">Only a Master Administrator can change a role.</p>}
        <p className="text-ink-muted">One person can also be given a single extra permission, or have a module hidden, from People.</p>
      </section>

      <form action={saveRolePermissions} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.label} className="card card-pad" disabled={!canEdit}>
            <legend className="sr-only">{g.label}</legend>
            <p className="font-bold mb-3">{g.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.perms.map((p) => {
                const on = current.has(p.key);
                const differs = on !== defaults.has(p.key);
                return (
                  <label key={p.key} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${canEdit ? 'cursor-pointer hover:bg-canvas' : ''} ${differs ? 'border-amber-300 bg-amber-50/60' : 'border-hairline'}`}>
                    <input type="checkbox" name="perm" value={p.key} defaultChecked={on} className="mt-0.5 h-4 w-4 accent-brand shrink-0" />
                    <span className="min-w-0 text-sm">
                      {p.label}
                      {differs && <span className="ml-2 text-xs font-semibold text-amber-800">{on ? 'Added' : 'Removed'}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {canEdit && (
          <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-canvas/95 backdrop-blur flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Saving…">Save {ROLE_LABELS[role]}</SubmitButton>
            <p className="text-sm text-ink-muted">Applies to everyone with this role on their next page.</p>
          </div>
        )}
      </form>

      {canEdit && saved && (
        <form action={resetRolePermissions} className="mt-2">
          <input type="hidden" name="role" value={role} />
          <SubmitButton className="btn-secondary" pendingLabel="Resetting…"><RotateCcw size={15} /> Put back to the defaults</SubmitButton>
        </form>
      )}

    </Shell>
  );
}

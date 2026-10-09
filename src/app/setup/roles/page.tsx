import Link from 'next/link';
import type { Role } from '@prisma/client';
import { ArrowRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { PERMISSIONS, ROLE_BLURBS, ROLE_LABELS, rolePermissionsFrom } from '@/lib/rbac';
import { shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

/**
 * Set Up → Roles: every role, how many people have it and what it can do,
 * and whether it's been changed from its defaults. Anyone who manages
 * people can look; only a Master Administrator can change one.
 */
export default async function RolesPage() {
  const user = await requirePermission('setup.users');
  const alerts = await getAlerts(user);
  const [saved, counts] = await Promise.all([
    db.rolePermissionSet.findMany(),
    db.user.groupBy({ by: ['role'], where: { active: true }, _count: { _all: true } }),
  ]);

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup/roles" alerts={alerts.length}>
      <PageHeader
        title="Roles"
        blurb={user.role === 'MASTER_ADMIN'
          ? 'What each role can do. Open one to change it — it applies to everyone with that role on their next page.'
          : 'What each role can do. Only a Master Administrator can change them.'}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => {
          const set = saved.find((s) => s.role === r);
          const perms = rolePermissionsFrom(r, set?.permissions);
          const people = counts.find((c) => c.role === r)?._count._all ?? 0;
          return (
            <Link key={r} href={`/setup/roles/${r}`} className="card p-5 flex flex-col gap-3 hover:shadow-pop transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold">{ROLE_LABELS[r]}</p>
                {r === 'MASTER_ADMIN' ? <Pill tone="bad">Everything</Pill>
                  : set ? <Pill tone="warn">Changed</Pill> : <Pill>Default</Pill>}
              </div>
              <p className="text-sm text-ink-muted">{ROLE_BLURBS[r]}</p>
              <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-hairline text-sm">
                <span>
                  <strong>{people}</strong> {people === 1 ? 'person' : 'people'} · <strong>{perms.length}</strong> permissions
                  {set && <span className="block text-xs text-ink-faint">Changed by {set.updatedBy || 'someone'} on {shortDate(set.updatedAt)} · default {PERMISSIONS[r].length}</span>}
                </span>
                <ArrowRight size={16} className="text-ink-faint shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

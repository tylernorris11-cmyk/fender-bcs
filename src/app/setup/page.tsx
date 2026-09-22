import Link from 'next/link';
import { ArrowRight, Bug, Clock, ListChecks, PoundSterling, Save, Users, type LucideIcon } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill } from '@/components/ui';

type Tile = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  blurb: string;
  badge?: string;
  links?: { label: string; href: string }[];
};

/**
 * The front door for Set Up — one page per permission this person actually
 * holds, rather than every page flattened into one long side menu. A
 * Manager or Quality with only setup.lists used to be sent straight to
 * /setup/pricing (setup.pricing only) and land on "no access"; this page is
 * gated on the broadest setup.view instead, so everyone with any Set Up
 * access lands somewhere real.
 */
export default async function SetupHomePage() {
  const user = await requirePermission('setup.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  const [pendingAccess, unpricedCount, onTimesheetsCount] = await Promise.all([
    can(user, 'setup.users') ? db.accessRequest.count({ where: { status: 'PENDING' } }) : 0,
    can(user, 'setup.pricing') ? db.product.count({ where: { company, active: true, prices: { none: {} } } }) : 0,
    can(user, 'setup.users') || can(user, 'timesheets.viewAll')
      ? db.user.count({ where: { active: true, onTimesheets: true } })
      : 0,
  ]);

  const tiles: Tile[] = [];

  if (can(user, 'setup.users')) {
    tiles.push({
      key: 'people',
      label: 'People & access',
      href: '/setup/users',
      icon: Users,
      blurb: 'Accounts, roles, company access and holiday allowances.',
      badge: pendingAccess > 0 ? `${pendingAccess} waiting` : undefined,
      links: [
        { label: 'Users & roles', href: '/setup/users' },
        { label: 'Access requests', href: '/setup/access-requests' },
      ],
    });
  }

  if (can(user, 'timesheets.viewAll') || can(user, 'setup.users')) {
    tiles.push({
      key: 'timesheets',
      label: 'Timesheets admin',
      href: can(user, 'timesheets.viewAll') ? '/timesheets/team' : '/timesheets/people',
      icon: Clock,
      blurb: `${onTimesheetsCount} ${onTimesheetsCount === 1 ? 'person' : 'people'} on timesheets right now.`,
      links: [
        ...(can(user, 'timesheets.viewAll') ? [{ label: 'Team timesheets', href: '/timesheets/team' }] : []),
        ...(can(user, 'setup.users') ? [{ label: 'Who fills timesheets', href: '/timesheets/people' }] : []),
      ],
    });
  }

  if (can(user, 'setup.lists')) {
    tiles.push({
      key: 'lists',
      label: 'Reference lists',
      href: '/setup/drivers',
      icon: ListChecks,
      blurb: 'Drivers, towns, locations and the order checklist.',
      links: [
        { label: 'Drivers', href: '/setup/drivers' },
        { label: 'Towns & cities', href: '/setup/towns' },
        { label: 'Locations', href: '/setup/locations' },
        ...(company === 'BS_SUPPLIES' ? [{ label: 'Cost centres', href: '/setup/cost-centres' }] : []),
        { label: 'Order checklist', href: '/setup/checklist' },
      ],
    });
  }

  if (can(user, 'setup.pricing')) {
    tiles.push({
      key: 'pricing',
      label: 'Pricing',
      href: '/setup/pricing',
      icon: PoundSterling,
      blurb: 'Selling prices and quantity bands for every product.',
      badge: unpricedCount > 0 ? `${unpricedCount} unpriced` : undefined,
    });
  }

  if (can(user, 'setup.backups')) {
    tiles.push({
      key: 'backups',
      label: 'Backups',
      href: '/setup/backups',
      icon: Save,
      blurb: 'Google Drive backup, and CSV exports of the system data.',
    });
  }

  if (can(user, 'setup.bugs')) {
    tiles.push({
      key: 'bugs',
      label: 'Bug reports',
      href: '/setup/bugs',
      icon: Bug,
      blurb: 'Everything sent in from the "Report a bug" link.',
    });
  }

  return (
    <Shell user={user} module="setup" nav={NAV.setup} current="/setup" alerts={alerts.length}>
      <PageHeader title="Set Up" blurb="Pricing, people and the lists the rest of the system runs on." />

      {tiles.length === 0 ? (
        <Empty title="Nothing here for your role yet." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {tiles.map((t) => (
            <div key={t.key} className="card card-pad relative">
              <Link href={t.href} className="group block pr-12">
                <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-brand-100 text-brand-700" aria-hidden>
                  <t.icon size={22} />
                </span>
                <span className="flex items-center flex-wrap gap-2 mt-4">
                  <h2 className="text-lg font-bold">{t.label}</h2>
                  {t.badge && <Pill tone="warn">{t.badge}</Pill>}
                </span>
                <p className="text-sm text-ink-muted mt-1">{t.blurb}</p>
                <span
                  className="absolute top-6 right-6 grid place-items-center h-9 w-9 rounded-full border-2 border-brand-700 text-brand-700 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden
                >
                  <ArrowRight size={16} />
                </span>
              </Link>
              {t.links && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-4 border-t border-hairline text-sm">
                  {t.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-brand-700 hover:underline">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

import Link from 'next/link';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, GraduationCap, HardHat, ListChecks, Plus, ShieldCheck, Siren,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can, canAny } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { clock, isoDateUk, longDate } from '@/lib/format';
import { incompleteRequiredModulesFor, requiredModulesFor } from '@/lib/training';
import {
  ASSESSMENT_KIND, EXPIRY_WARNING_DAYS, REVIEW_WARNING_DAYS, actionStatus, daysFromToday, reviewStatus, ticketStatus,
} from '@/lib/hs';
import { NAV, Shell } from '@/components/Shell';
import { IconStat } from '@/components/IconStat';
import { DateBadge } from './bits';

type Task = { key: string; date: Date; title: string; where: string; href: string };

export default async function HsDashboardPage() {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const canEdit = can(user, 'hs.edit');
  const seesCompetence = canAny(user, 'hs.edit', 'hs.manageTraining');
  const today = isoDateUk();
  const yearStart = new Date(`${today.slice(0, 4)}-01-01T00:00:00Z`);

  const [assessments, actions, incidents, records, required, incomplete] = await Promise.all([
    db.hsAssessment.findMany({ where: { archived: false, OR: [{ company: null }, { company }] }, select: { id: true, kind: true, title: true, area: true, reviewDue: true, archived: true } }),
    db.hsAction.findMany({
      where: { company, completedAt: null, ...(canEdit ? {} : { ownerId: user.id }) },
      select: { id: true, title: true, dueOn: true, completedAt: true, owner: { select: { name: true } } },
    }),
    canEdit ? db.hsIncident.findMany({ where: { company, OR: [{ status: { not: 'CLOSED' } }, { occurredAt: { gte: yearStart } }] }, select: { type: true, status: true, occurredAt: true } }) : [],
    db.hsTrainingRecord.findMany({
      where: seesCompetence ? { OR: [{ userId: null }, { user: { companies: { has: company } } }] } : { userId: user.id },
      select: { id: true, course: true, expiresOn: true, personName: true, user: { select: { name: true } } },
    }),
    requiredModulesFor(user),
    incompleteRequiredModulesFor(user),
  ]);

  const actionStates = actions.map((a) => ({ ...a, status: actionStatus(a, today) }));
  const overdueActions = actionStates.filter((a) => a.status === 'OVERDUE').length;
  const dueThisWeek = actionStates.filter((a) => a.status === 'DUE_SOON').length;
  const openIncidents = incidents.filter((i) => i.status !== 'CLOSED');
  const awaiting = openIncidents.filter((i) => i.status === 'UNDER_REVIEW').length;
  const reviewStates = assessments.map((a) => ({ ...a, status: reviewStatus(a, today) }));
  const reviewsDue = reviewStates.filter((a) => a.status === 'DUE' || a.status === 'OVERDUE');
  const reviewsOverdue = reviewStates.filter((a) => a.status === 'OVERDUE').length;
  const ticketStates = records.map((r) => ({ ...r, status: ticketStatus(r, today) }));
  const expiring = ticketStates.filter((r) => r.status === 'EXPIRING' || r.status === 'EXPIRED');
  const ofKind = (kind: keyof typeof ASSESSMENT_KIND) => reviewStates.filter((a) => a.kind === kind);

  // What's coming up, soonest (or most overdue) first.
  const tasks: Task[] = [
    ...actionStates.map((a) => ({ key: `a${a.id}`, date: a.dueOn, title: a.title, where: a.owner?.name ?? 'No owner', href: '/hs/actions' })),
    ...reviewsDue.map((a) => ({
      key: `r${a.id}`, date: a.reviewDue, title: `Review: ${a.title}`, where: a.area || ASSESSMENT_KIND[a.kind].label, href: `${ASSESSMENT_KIND[a.kind].path}/${a.id}`,
    })),
    ...expiring.filter((r) => r.expiresOn).map((r) => ({
      key: `t${r.id}`, date: r.expiresOn!, title: `${r.course} expires`, where: r.user?.name ?? r.personName,
      href: seesCompetence ? '/hs/competence?tab=expiring' : '/hs/training',
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);

  const now = new Date();

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs" alerts={alerts.length}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health &amp; Safety Dashboard</h1>
          <p className="text-ink-muted mt-1.5">Keeping our people safe, our yard compliant, and our business running.</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-ink-faint text-right leading-tight">Last updated {clock(now)}<br />{longDate(now)}</p>
          {canEdit && <Link href="/hs/incidents/new" className="btn-primary"><Plus size={16} /> Report an incident</Link>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <IconStat
          icon={overdueActions ? AlertTriangle : CheckCircle2} tone={overdueActions ? 'bad' : 'good'} href="/hs/actions?tab=overdue"
          value={overdueActions} label={canEdit ? 'Overdue actions' : 'My overdue actions'}
          sub={dueThisWeek ? `${dueThisWeek} due this week` : 'Nothing else due this week'}
        />
        {canEdit ? (
          <IconStat
            icon={Siren} tone={openIncidents.length ? 'bad' : 'good'} href="/hs/incidents"
            value={openIncidents.length} label="Open incidents" sub={awaiting ? `${awaiting} awaiting investigation` : 'None awaiting investigation'}
          />
        ) : (
          <IconStat
            icon={GraduationCap} tone={incomplete.length ? 'warn' : 'good'} href="/hs/training"
            value={incomplete.length} label="Training to complete" sub={required.length ? `${required.length - incomplete.length} of ${required.length} done` : 'Nothing required right now'}
          />
        )}
        <IconStat
          icon={CalendarClock} tone={reviewsOverdue ? 'bad' : reviewsDue.length ? 'warn' : 'good'} href="/hs/risk-assessments"
          value={reviewsDue.length} label="Reviews due" sub={reviewsOverdue ? `${reviewsOverdue} overdue` : `Within ${REVIEW_WARNING_DAYS} days`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5 mb-6">
        <section className="lg:col-span-3 relative overflow-hidden rounded-card bg-forest text-white min-h-[240px] flex flex-col justify-end p-6 sm:p-8">
          <div className="absolute inset-0 mesh-bg pointer-events-none" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-br from-brand/40 via-transparent to-black/30 pointer-events-none" aria-hidden />
          <HardHat size={220} strokeWidth={1} className="absolute -right-8 -top-6 text-white/10" aria-hidden />
          <div className="relative">
            <ShieldCheck size={32} className="text-brand-100 mb-3" aria-hidden />
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">A safer yard, a stronger business.</p>
            <p className="text-white/75 mt-2">People&nbsp;•&nbsp;Processes&nbsp;•&nbsp;Compliance</p>
          </div>
        </section>

        <section className="lg:col-span-2 card card-pad">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Upcoming H&amp;S tasks</h2>
            <Link href="/hs/actions" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">Nothing due. All up to date.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {tasks.map((t) => (
                <li key={t.key}>
                  <Link href={t.href} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <DateBadge date={t.date} overdue={daysFromToday(t.date, today) < 0} />
                    <span className="flex-1 min-w-0 text-sm truncate">{t.title}</span>
                    <span className="text-xs text-ink-faint truncate max-w-[90px]">{t.where}</span>
                    <ChevronRight size={16} className="text-ink-faint shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <IconStat
          icon={ClipboardList} tone="info" href="/hs/risk-assessments"
          value={ofKind('RISK_ASSESSMENT').length} label="Risk assessments"
          sub={`${ofKind('RISK_ASSESSMENT').filter((a) => a.status !== 'LIVE').length} due for review`}
        />
        <IconStat
          icon={FileCheck2} tone="good" href="/hs/method-statements"
          value={ofKind('METHOD_STATEMENT').length} label="Method statements"
          sub={`${ofKind('METHOD_STATEMENT').filter((a) => a.status !== 'LIVE').length} due for review`}
        />
        {seesCompetence ? (
          <IconStat
            icon={GraduationCap} tone="violet" href="/hs/competence"
            value={records.length} label="Training records" sub={`${expiring.length} expiring within ${EXPIRY_WARNING_DAYS} days`}
          />
        ) : (
          <IconStat
            icon={GraduationCap} tone="violet" href="/hs/training"
            value={records.length} label="My tickets" sub={expiring.length ? `${expiring.length} expiring soon` : 'All in date'}
          />
        )}
        {canEdit ? (
          <IconStat
            icon={Siren} tone="warn" href="/hs/reporting"
            value={incidents.filter((i) => i.occurredAt >= yearStart).length} label={`Reports in ${today.slice(0, 4)}`}
            sub={`${incidents.filter((i) => i.occurredAt >= yearStart && i.type === 'NEAR_MISS').length} near misses`}
          />
        ) : (
          <IconStat
            icon={ListChecks} tone="warn" href="/hs/actions"
            value={actions.length} label="My open actions" sub={overdueActions ? `${overdueActions} overdue` : 'None overdue'}
          />
        )}
      </div>
    </Shell>
  );
}

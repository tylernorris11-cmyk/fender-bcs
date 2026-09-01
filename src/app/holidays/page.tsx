import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { shortDate, clock } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Avatar, Empty, PageHeader, Pill, Stat, StatRow, Table } from '@/components/ui';
import { adjustHolidayBalance, cancelHoliday, decideHoliday } from './actions';
import { RequestHolidayForm } from './RequestHolidayForm';

export default async function HolidaysPage() {
  const user = await requirePermission('holidays.view');
  const alerts = await getAlerts(user);
  const isMaster = user.role === 'MASTER_ADMIN';
  const currentYear = new Date().getUTCFullYear();

  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear, 11, 31));

  const [myRequests, myRecord, myAdjustments, pending, activeLive, everyone, recentAdjustments] = await Promise.all([
    db.holidayRequest.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { holidayAllowanceDays: true } }),
    db.holidayAdjustment.findMany({ where: { userId: user.id, year: currentYear }, orderBy: { createdAt: 'desc' } }),
    isMaster
      ? db.holidayRequest.findMany({
          where: { status: 'PENDING' },
          include: { user: { select: { name: true, colour: true, jobTitle: true } } },
          orderBy: { requestedAt: 'asc' },
        })
      : Promise.resolve([]),
    // Everyone's live (pending or approved) holiday, used to flag conflicts
    // on each pending request a Master Admin is about to decide.
    isMaster
      ? db.holidayRequest.findMany({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          include: { user: { select: { name: true, colour: true } } },
        })
      : Promise.resolve([]),
    isMaster
      ? db.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
      : Promise.resolve([]),
    isMaster
      ? db.holidayAdjustment.findMany({
          include: { user: { select: { name: true } }, createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const used = myRequests
    .filter((r) => r.status === 'APPROVED' && r.startDate >= yearStart && r.startDate <= yearEnd)
    .reduce((s, r) => s + r.workingDays, 0);
  const awaiting = myRequests
    .filter((r) => r.status === 'PENDING' && r.startDate >= yearStart && r.startDate <= yearEnd)
    .reduce((s, r) => s + r.workingDays, 0);
  const adjustmentTotal = myAdjustments.reduce((s, a) => s + a.days, 0);
  const remaining = myRecord.holidayAllowanceDays - used + adjustmentTotal;

  const conflictsFor = (reqId: string, requesterUserId: string, start: Date, end: Date) =>
    activeLive.filter((r) => r.id !== reqId && r.userId !== requesterUserId && r.startDate <= end && r.endDate >= start);

  return (
    <Shell user={user} module="holidays" nav={NAV.holidays} current="/holidays" alerts={alerts.length}>
      <PageHeader
        title="Holidays"
        blurb="Request time off, see who else is away, and — if you're a Master Administrator — decide what's outstanding."
        actions={<Link href="/holidays/calendar" className="btn-secondary">Open calendar</Link>}
      />

      <StatRow>
        <Stat value={myRecord.holidayAllowanceDays} label="Days a year" />
        <Stat value={used} label="Used this year" tone="good" />
        <Stat value={awaiting} label="Awaiting a decision" tone={awaiting ? 'warn' : 'default'} />
        <Stat value={remaining} label="Remaining" tone={remaining < 0 ? 'bad' : 'default'} />
      </StatRow>

      {myAdjustments.length > 0 && (
        <div className="card card-pad mb-6 text-sm">
          <p className="font-semibold mb-2">
            {adjustmentTotal > 0 ? '+' : ''}{adjustmentTotal} day{Math.abs(adjustmentTotal) === 1 ? '' : 's'} adjusted for {currentYear} — already folded into your remaining total above.
          </p>
          <ul className="space-y-1 text-ink-muted">
            {myAdjustments.map((a) => (
              <li key={a.id}>{a.days > 0 ? '+' : ''}{a.days} day{Math.abs(a.days) === 1 ? '' : 's'} — {a.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Request holiday</h2>
          <RequestHolidayForm />
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-4">Your requests</h2>
          {myRequests.length === 0 ? <Empty title="Nothing requested yet." /> : (
            <ul className="divide-y divide-hairline text-sm">
              {myRequests.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{shortDate(r.startDate)} – {shortDate(r.endDate)}</span>
                    <span className="text-ink-muted">{r.workingDays} day{r.workingDays === 1 ? '' : 's'}</span>
                    <Pill tone={r.status === 'APPROVED' ? 'good' : r.status === 'REJECTED' ? 'bad' : r.status === 'CANCELLED' ? 'neutral' : 'warn'}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </Pill>
                    {r.status === 'PENDING' && (
                      <form action={cancelHoliday} className="ml-auto">
                        <input type="hidden" name="requestId" value={r.id} />
                        <button className="text-xs text-ink-faint hover:text-signal underline">withdraw</button>
                      </form>
                    )}
                  </div>
                  {r.note && <p className="text-ink-muted mt-1">{r.note}</p>}
                  {r.decisionNote && <p className="text-ink-faint mt-1 italic">&ldquo;{r.decisionNote}&rdquo;</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isMaster && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Pending approval</h2>
          <p className="text-sm text-ink-muted mb-4">Every outstanding request, across both companies — this calendar is shared.</p>

          {pending.length === 0 ? <Empty title="Nothing waiting on a decision." /> : (
            <div className="space-y-4">
              {pending.map((r) => {
                const conflicts = conflictsFor(r.id, r.userId, r.startDate, r.endDate);
                return (
                  <div key={r.id} className="border border-hairline rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <Avatar name={r.user.name} colour={r.user.colour} size={30} />
                      <div>
                        <p className="font-semibold">{r.user.name} <span className="font-normal text-ink-faint">{r.user.jobTitle}</span></p>
                        <p className="text-sm text-ink-muted">
                          {shortDate(r.startDate)} – {shortDate(r.endDate)} · {r.workingDays} day{r.workingDays === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    {r.note && <p className="text-sm text-ink-muted mb-2">&ldquo;{r.note}&rdquo;</p>}

                    {conflicts.length > 0 && (
                      <div className="banner-warn mb-3">
                        <AlertTriangle size={16} className="shrink-0" aria-hidden />
                        <div>
                          <p className="font-semibold text-sm">Already off some of these days:</p>
                          <ul className="text-sm mt-1 space-y-0.5">
                            {conflicts.map((c) => (
                              <li key={c.id}>
                                {c.user.name} — {shortDate(c.startDate)} to {shortDate(c.endDate)}
                                {c.status === 'PENDING' && <span className="text-ink-faint"> (also pending)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <form action={decideHoliday} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="requestId" value={r.id} />
                      <div className="flex-1 min-w-[200px]">
                        <label className="label text-xs" htmlFor={`note-${r.id}`}>Note (required to reject)</label>
                        <input id={`note-${r.id}`} name="decisionNote" className="input py-1.5" />
                      </div>
                      <button name="decision" value="APPROVED" className="btn-primary btn-sm">Approve</button>
                      <button name="decision" value="REJECTED" className="btn-secondary btn-sm">Reject</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {isMaster && (
        <section className="card card-pad mt-6">
          <h2 className="text-lg font-bold mb-1">Add or take away holiday</h2>
          <p className="text-sm text-ink-muted mb-4">
            For days already taken before this system existed, or to correct a mistake. Positive adds days, negative takes them away — it applies to one calendar year and never overwrites anything, so the history below stays honest.
          </p>
          <form action={adjustHolidayBalance} className="flex flex-wrap items-end gap-3 mb-6">
            <div>
              <label className="label text-xs" htmlFor="userId">Person</label>
              <select id="userId" name="userId" required className="input w-48">
                {everyone.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="year">Year</label>
              <input id="year" name="year" type="number" required defaultValue={currentYear} className="input w-24" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="days">Days (+ to add, − to take away)</label>
              <input id="days" name="days" type="number" required placeholder="-6" className="input w-32" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="label text-xs" htmlFor="reason">Reason</label>
              <input id="reason" name="reason" required className="input" placeholder="Took 6 days in Feb, before go-live" />
            </div>
            <button className="btn-primary">Save</button>
          </form>

          {recentAdjustments.length === 0 ? <Empty title="No adjustments made yet." /> : (
            <Table head={<>
              <th className="th">Person</th><th className="th">Year</th><th className="th">Days</th>
              <th className="th">Reason</th><th className="th">By</th><th className="th">When</th>
            </>}>
              {recentAdjustments.map((a) => (
                <tr key={a.id} className="row">
                  <td className="td font-semibold">{a.user.name}</td>
                  <td className="td">{a.year}</td>
                  <td className="td">
                    <Pill tone={a.days > 0 ? 'good' : 'bad'}>{a.days > 0 ? '+' : ''}{a.days}</Pill>
                  </td>
                  <td className="td text-ink-muted">{a.reason}</td>
                  <td className="td">{a.createdBy.name}</td>
                  <td className="td text-ink-faint whitespace-nowrap">{shortDate(a.createdAt)} {clock(a.createdAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      )}
    </Shell>
  );
}

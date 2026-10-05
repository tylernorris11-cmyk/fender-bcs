import Link from 'next/link';
import { ArrowRight, ClipboardList, Hammer, Plus, Scale } from 'lucide-react';
import { clock, longDate, shortDate, tonnes } from '@/lib/format';
import { IconStat } from '@/components/IconStat';
import { SubmitButton } from '@/components/SubmitButton';

// The top of Fender's Production page, laid out like the H&S dashboard: a
// greeting, tiles, the viewer's own open jobs, and starting a new one. A
// Fender tally sheet is one person's own, so these are only the viewer's
// jobs; anyone else's are under "In progress" further down. BCS keeps its
// own layout in page.tsx.

const PROCESS_LABEL: Record<string, string> = { CUTTING: 'Cutting', BENDING: 'Bending', STEMA: 'Stema' };
const PROCESS_TONE: Record<string, string> = {
  CUTTING: 'bg-sky-100 text-sky-800',
  BENDING: 'bg-violet-100 text-violet-800',
  STEMA: 'bg-amber-100 text-amber-800',
};

/** First name only, tidied if it was typed in capitals: "LEE BROCKLEBANK" → "Lee". */
export function firstName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first;
}

export function FenderHome({
  userName, jobs, tallyTodayKg, rowsToday, openOtherWork, canStart, startAction,
}: {
  userName: string;
  jobs: any[];
  tallyTodayKg: number;
  rowsToday: number;
  openOtherWork: number;
  canStart: boolean;
  startAction: (fd: FormData) => Promise<void>;
}) {
  const now = new Date();
  const rowsOpen = jobs.reduce((s, j) => s + j.rows.length, 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hello, {firstName(userName)}</h1>
          <p className="text-ink-muted mt-1.5">Here&apos;s your work on the shear line and the benders today.</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-ink-faint text-right leading-tight">Last updated {clock(now)}<br />{longDate(now)}</p>
          {canStart && <a href="#start-job" className="btn-primary"><Plus size={16} /> Start a new job</a>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <IconStat
          icon={ClipboardList} tone="info" href="#your-jobs"
          value={jobs.length} label="Your open jobs" sub={jobs.length ? `${rowsOpen} ${rowsOpen === 1 ? 'row' : 'rows'} logged on them` : 'Start one below'}
        />
        <IconStat
          icon={Scale} tone="good"
          value={tonnes(tallyTodayKg)} label="Your tally today" sub={`${rowsToday} ${rowsToday === 1 ? 'row' : 'rows'} logged today`}
        />
        <IconStat
          icon={Hammer} tone={openOtherWork ? 'warn' : 'good'} href="/production/other-work"
          value={openOtherWork} label="Other work to do" sub="Jobs that aren't a customer order"
        />
      </div>

      {(jobs.length > 0 || canStart) && (
        <section id="your-jobs" className="mb-6 scroll-mt-4">
          <h2 className="text-lg font-bold mb-3">Your open jobs</h2>
          {jobs.length === 0 ? (
            <div className="card card-pad text-center text-ink-muted">No open jobs. Start one below.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((j) => {
                const weight = j.rows.reduce((s: number, r: any) => s + Number(r.tallyWeightKg), 0);
                const lastActivity = j.rows.length > 0
                  ? new Date(Math.max(...j.rows.map((r: any) => new Date(r.at).getTime())))
                  : j.startedAt;
                return (
                  <Link key={j.id} href={`/production/jobs/${j.id}`} className="card p-5 flex flex-col gap-3 hover:shadow-pop transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xl font-bold truncate">{j.jobNumber}</p>
                        {j.order && <p className="text-sm text-ink-muted truncate">Order {j.order.number}</p>}
                      </div>
                      <span className={`pill ${PROCESS_TONE[j.process]}`}>{PROCESS_LABEL[j.process]}</span>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div><p className="font-semibold tabular-nums">{j.rows.length}</p><p className="text-ink-muted">{j.rows.length === 1 ? 'row' : 'rows'}</p></div>
                      <div><p className="font-semibold tabular-nums">{tonnes(weight)}</p><p className="text-ink-muted">so far</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-hairline">
                      <p className="text-xs text-ink-faint">
                        {j.rows.length > 0 ? 'Last row' : 'Started'} {shortDate(lastActivity)} {clock(lastActivity)}
                      </p>
                      <span className="btn-primary btn-sm">Open <ArrowRight size={14} /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {canStart && (
        <section id="start-job" className="card card-pad mb-6 scroll-mt-4">
          <h2 className="text-lg font-bold mb-1">Start a new job</h2>
          <p className="text-sm text-ink-muted mb-4">If the job number matches an order, it&apos;s linked to it automatically.</p>
          <form action={startAction} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label" htmlFor="jobNumber">Job number</label>
              <input id="jobNumber" name="jobNumber" required className="input w-48 text-base" placeholder="FS-26-05301" />
            </div>
            <fieldset>
              <legend className="label">Process</legend>
              <div className="flex gap-2">
                {(['CUTTING', 'BENDING', 'STEMA'] as const).map((p, i) => (
                  <label key={p} className="cursor-pointer rounded-xl border-2 border-hairline px-4 py-2 text-sm font-semibold transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-50 has-[:checked]:text-forest">
                    <input type="radio" name="process" value={p} defaultChecked={i === 0} className="sr-only" />
                    {PROCESS_LABEL[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingLabel="Starting…">Start job</SubmitButton>
          </form>
        </section>
      )}
    </>
  );
}

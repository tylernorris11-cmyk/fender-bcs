import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { formatRef, getAccountsSettings, MONTH_NAMES, periodFor, periodMonthLabel, yearLabel } from '@/lib/ledger';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { saveLock, saveYearStart, setNextNumber } from '../actions';

export default async function AccountsSettingsPage() {
  const user = await requirePermission('accounts.setup');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);
  const settings = await getAccountsSettings(company);

  const [posted, nomSequence] = await Promise.all([
    db.transaction.count({ where: { company } }),
    db.documentSequence.findUnique({ where: { company_docType: { company, docType: 'NOM' } } }),
  ]);
  const current = periodFor(new Date(), settings.yearStartMonth);
  const lockValue = settings.lockedYear != null ? `${settings.lockedYear}-${settings.lockedPeriod}` : '';

  // Enough years back and forward to lock anything plausible.
  const lockOptions: { value: string; label: string }[] = [];
  for (let y = current.year - 2; y <= current.year; y++) {
    for (let p = 1; p <= 12; p++) {
      lockOptions.push({ value: `${y}-${p}`, label: `${periodMonthLabel(y, p, settings.yearStartMonth)} (${yearLabel(y, settings.yearStartMonth)} P${p})` });
    }
  }
  if (lockValue && !lockOptions.some((o) => o.value === lockValue)) {
    lockOptions.unshift({
      value: lockValue,
      label: `${periodMonthLabel(settings.lockedYear!, settings.lockedPeriod!, settings.yearStartMonth)} (${yearLabel(settings.lockedYear!, settings.yearStartMonth)} P${settings.lockedPeriod})`,
    });
  }

  return (
    <Shell user={user} module="accounts" nav={NAV.accounts} current="/accounts/settings" alerts={alerts.length}>
      <PageHeader title="Accounts settings" blurb={`For ${COMPANY_LABEL[company]}. Switch company at the top to set up the other one.`} />

      <div className="grid gap-6 max-w-3xl">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Financial year</h2>
          <p className="text-sm text-ink-muted mb-4">
            The month the financial year starts decides which year and period every date falls in. It&apos;s set to April until your
            accountant confirms the real one, and it can&apos;t change once anything has been posted.
          </p>
          <form action={saveYearStart} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="yearStartMonth">Year starts in</label>
              <select id="yearStartMonth" name="yearStartMonth" defaultValue={settings.yearStartMonth} disabled={posted > 0} className="input w-44">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {posted === 0 && <SubmitButton pendingLabel="Saving…">Save</SubmitButton>}
          </form>
          <p className="text-xs text-ink-faint mt-3">
            Today is in {yearLabel(current.year, settings.yearStartMonth)}, period {current.period}.
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Period lock</h2>
          <p className="text-sm text-ink-muted mb-4">
            Nothing can post into a locked period or any before it. Lock a month once it&apos;s been closed off.
          </p>
          <form action={saveLock} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="lock">Locked up to and including</label>
              <select id="lock" name="lock" defaultValue={lockValue} className="input w-80">
                <option value="">Nothing locked</option>
                {lockOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </form>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Document numbers</h2>
          <p className="text-sm text-ink-muted mb-4">
            So numbering carries on from Exchequer, set each one to the number after the last one raised there. It can&apos;t be set
            back to a number that&apos;s already been used.
          </p>
          <form action={setNextNumber} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="docType" value="NOM" />
            <div>
              <label className="label" htmlFor="nextNumber">Next journal (NOM) number</label>
              <input id="nextNumber" name="nextNumber" type="number" min="1" max="999999" step="1" required
                     defaultValue={nomSequence?.nextNumber ?? 1} className="input w-40" />
            </div>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </form>
          <p className="text-xs text-ink-faint mt-3">The next journal posted will be {formatRef('NOM', nomSequence?.nextNumber ?? 1)}.</p>
        </section>
      </div>
    </Shell>
  );
}

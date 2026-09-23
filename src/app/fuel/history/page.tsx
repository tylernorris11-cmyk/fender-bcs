import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';

// One physical yard tank shared by both companies — same as /fuel, this is
// never filtered by whichever company happens to be active.
const MONTHS_SHOWN = 12;

export default async function FuelHistoryPage() {
  const user = await requirePermission('fuel.history');
  const alerts = await getAlerts(user);

  const entries = await db.fuelEntry.findMany({
    select: { loggedAt: true, litresBefore: true, litresAfter: true },
  });

  const now = new Date();
  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), litres: 0, count: 0 };
  });

  for (const e of entries) {
    const bucket = months.find((m) => m.year === e.loggedAt.getFullYear() && m.month === e.loggedAt.getMonth());
    if (bucket) {
      bucket.litres += Number(e.litresAfter) - Number(e.litresBefore);
      bucket.count += 1;
    }
  }

  const maxLitres = Math.max(...months.map((m) => m.litres), 1);
  const totalLitres = months.reduce((s, m) => s + m.litres, 0);
  const totalEntries = months.reduce((s, m) => s + m.count, 0);
  const monthsWithData = months.filter((m) => m.count > 0).length;
  const busiest = months.reduce((a, b) => (b.litres > a.litres ? b : a), months[0]);

  return (
    <Shell user={user} module="fuel" nav={NAV.fuel} current="/fuel/history" alerts={alerts.length}>
      <PageHeader title="Fuel History" blurb={`Litres used against the yard tank, month to month, over the last ${MONTHS_SHOWN} months.`} />

      <StatRow>
        <Stat value={`${totalLitres.toLocaleString('en-GB', { maximumFractionDigits: 0 })} L`} label={`Total, last ${MONTHS_SHOWN} months`} />
        <Stat
          value={`${(monthsWithData ? totalLitres / monthsWithData : 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })} L`}
          label="Average per month"
        />
        <Stat value={busiest.litres > 0 ? monthLabel(busiest.year, busiest.month) : '—'} label="Busiest month" />
        <Stat value={totalEntries} label="Fill-ups logged" />
      </StatRow>

      <section className="card card-pad">
        <div className="space-y-3">
          {months.map((m) => {
            const pct = maxLitres > 0 ? Math.max((m.litres / maxLitres) * 100, m.litres > 0 ? 3 : 0) : 0;
            return (
              <div key={`${m.year}-${m.month}`} className="flex items-center gap-4">
                <span className="w-32 shrink-0 text-sm font-semibold">{monthLabel(m.year, m.month)}</span>
                <div className="flex-1 h-3 rounded-full bg-hairline overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-semibold">
                  {m.litres.toLocaleString('en-GB', { maximumFractionDigits: 0 })} L
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-ink-faint">
                  {m.count} {m.count === 1 ? 'fill-up' : 'fill-ups'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

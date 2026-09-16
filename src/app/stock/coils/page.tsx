import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { getActiveCompany } from '@/lib/company';
import { tonnes } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Stat, StatRow } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { allocateCoilNumbers, receiveCoil } from './actions';

const GRADE_LABEL = { SOFT: 'Soft', MEDIUM: 'Medium', HIGH_CARBON: 'High carbon' } as const;

export default async function AddCoilsPage() {
  const user = await requirePermission('stock.view');
  const alerts = await getAlerts(user);
  const company = getActiveCompany(user);

  if (company !== 'BS_SUPPLIES') {
    return (
      <Shell user={user} module="stock" nav={NAV.stock} current="/stock/coils" alerts={alerts.length}>
        <PageHeader title="Add Coils" />
        <div className="banner-warn">Coil stock is a BCS Products thing — Fender doesn&apos;t use this.</div>
      </Shell>
    );
  }

  const [awaiting, inStockCount] = await Promise.all([
    db.coil.findMany({ where: { company, receivedAt: null }, orderBy: { ref: 'asc' } }),
    db.coil.count({ where: { company, receivedAt: { not: null } } }),
  ]);

  return (
    <Shell user={user} module="stock" nav={NAV.stock} current="/stock/coils" alerts={alerts.length}>
      <PageHeader
        title="Add Coils"
        blurb="Issue numbers ahead of a delivery, then fill each one in as the coil actually arrives — see Coil Stock for what's currently on hand."
      />

      <StatRow>
        <Stat value={inStockCount} label="Coils in stock" href="/stock/coils/stock" />
        <Stat value={awaiting.length} label="Numbers awaiting a coil" tone={awaiting.length ? 'warn' : 'default'} />
      </StatRow>

      {can(user, 'stock.goodsIn') && (
        <div className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-1">Pre-allocate numbers</h2>
          <p className="text-sm text-ink-muted mb-3">
            For a delivery on its way in — generates the next numbers in sequence, ready to print as tickets.
          </p>
          <form action={allocateCoilNumbers} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="count">How many coils</label>
              <input id="count" name="count" type="number" min="1" max="200" required className="input w-28" placeholder="10" />
            </div>
            <SubmitButton pendingLabel="Generating…">
              <Printer size={16} /> Generate &amp; print
            </SubmitButton>
          </form>
        </div>
      )}

      <section className="card card-pad">
        <h2 className="text-lg font-bold mb-1">Awaiting a coil</h2>
        <p className="text-sm text-ink-muted mb-4">
          Numbers already issued and printed — fill this in once the coil they&apos;re on actually arrives.
        </p>
        {awaiting.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing waiting — pre-allocate some numbers above before the next delivery.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {awaiting.map((coil) => (
              <li key={coil.id} className="py-3">
                <form action={receiveCoil} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="coilId" value={coil.id} />
                  <span className="label w-16 shrink-0 mb-0 text-lg font-bold tracking-wide">{coil.ref}</span>
                  <div>
                    <label className="label text-xs" htmlFor={`grade-${coil.id}`}>Grade</label>
                    <select id={`grade-${coil.id}`} name="grade" required defaultValue="" className="input w-36 py-2">
                      <option value="" disabled>Choose…</option>
                      {(Object.keys(GRADE_LABEL) as (keyof typeof GRADE_LABEL)[]).map((g) => (
                        <option key={g} value={g}>{GRADE_LABEL[g]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`dia-${coil.id}`}>Diameter (mm)</label>
                    <input id={`dia-${coil.id}`} name="diameterMm" type="number" step="0.1" min="0" required className="input w-24 py-2" placeholder="5.5" />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor={`weight-${coil.id}`}>Weight (kg)</label>
                    <input id={`weight-${coil.id}`} name="weightKg" type="number" step="0.1" min="0" required className="input w-28 py-2" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="label text-xs" htmlFor={`note-${coil.id}`}>Note (optional)</label>
                    <input id={`note-${coil.id}`} name="note" className="input py-2" />
                  </div>
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Receive</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-faint mt-4">
        <Link href="/stock" className="hover:underline">← Back to stock</Link>
      </p>
    </Shell>
  );
}

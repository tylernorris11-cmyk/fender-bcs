import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, Trash2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, daysUntil, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { addAssetChecklistItem, addAssetNote, logInspection, removeAssetChecklistItem, retireAsset } from '../actions';

const KINDS = ['MOT', 'Safety check', 'PUWER', 'LOLER', 'Service', 'Calibration'];

function Due({ label, due }: { label: string; due: Date | null }) {
  if (!due) return null;
  const days = daysUntil(due)!;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-hairline last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">
        {days < 0 ? <Pill tone="bad">{shortDate(due)} · overdue</Pill>
          : days <= 21 ? <Pill tone="warn">{shortDate(due)} · {days}d</Pill>
          : shortDate(due)}
      </dd>
    </div>
  );
}

export default async function AssetPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('assets.view');
  const alerts = await getAlerts(user);

  const asset = await db.asset.findUnique({
    where: { id: params.id },
    include: {
      inspections: { include: { loggedBy: true }, orderBy: { performedOn: 'desc' } },
      notes: { include: { user: true }, orderBy: { at: 'desc' } },
      checks: { include: { user: true, items: true }, orderBy: { performedAt: 'desc' }, take: 20 },
      checklistItems: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!asset) notFound();

  return (
    <Shell user={user} module="assets" nav={NAV.assets} current="/assets" alerts={alerts.length}>
      <Link href="/assets" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to assets
      </Link>

      <PageHeader
        title={asset.name}
        blurb={`${asset.ref} · ${asset.category} · ${asset.depot}`}
        actions={
          <>
            {can(user, 'checks.create') && (
              <Link href={`/checks/new?assetId=${asset.id}`} className="btn-secondary"><ClipboardCheck size={16} /> Run a check</Link>
            )}
            {can(user, 'assets.edit') && (
              <form action={retireAsset}>
                <input type="hidden" name="assetId" value={asset.id} />
                <button className="btn-danger">{asset.retired ? 'Back into service' : 'Retire asset'}</button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Details</h2>
          <dl className="text-sm">
            {[
              ['Make & model', asset.makeModel],
              ['Year', asset.year?.toString() ?? '—'],
              ['Serial number', asset.serialNumber || '—'],
              ['Hours', asset.hours?.toLocaleString('en-GB') ?? '—'],
              ['Lifting equipment', asset.liftingEquipment ? 'Yes — LOLER applies' : 'No'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2 border-b border-hairline last:border-0">
                <dt className="text-ink-muted">{k}</dt><dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Next due</h2>
          <dl className="text-sm">
            <Due label="MOT" due={asset.motDue} />
            <Due label="Road tax" due={asset.taxDue} />
            <Due label="Safety inspection" due={asset.weeklyCheckDue} />
            <Due label="PUWER inspection" due={asset.puwerDue} />
            <Due label="LOLER thorough examination" due={asset.lolerDue} />
            <Due label="Service" due={asset.serviceDue} />
            <Due label="Measurement calibration" due={asset.calibrationDue} />
          </dl>
          {asset.calibrationDue && daysUntil(asset.calibrationDue)! < 0 && (
            <p className="banner-bad mt-4">
              Calibration is out of date. CARES requires control of measuring devices — take this machine off schedules until it is re-verified.
            </p>
          )}
        </section>
      </div>

      {can(user, 'assets.edit') && (
        <section className="card card-pad mb-6">
          <h2 className="text-lg font-bold mb-4">Log an inspection</h2>
          <form action={logInspection} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="assetId" value={asset.id} />
            <div>
              <label className="label" htmlFor="kind">What was done</label>
              <select id="kind" name="kind" className="input">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="result">Result</label>
              <select id="result" name="result" className="input"><option>Pass</option><option>Advisory</option><option>Fail</option></select>
            </div>
            <div>
              <label className="label" htmlFor="provider">Who did it</label>
              <input id="provider" name="provider" className="input" placeholder="SafeCheck Ltd" />
            </div>
            <div>
              <label className="label" htmlFor="performedOn">Date done</label>
              <input id="performedOn" name="performedOn" type="date" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="nextDueOn">Next due</label>
              <input id="nextDueOn" name="nextDueOn" type="date" className="input" />
              <p className="hint">Fills the due date on this record.</p>
            </div>
            <div>
              <label className="label" htmlFor="certificate">Certificate number</label>
              <input id="certificate" name="certificate" className="input" />
            </div>
            <div className="sm:col-span-3">
              <label className="label" htmlFor="notes">Notes</label>
              <input id="notes" name="notes" className="input" placeholder="Length measurement verified to ±2 mm" />
            </div>
            <div><button className="btn-primary">Log it</button></div>
          </form>
        </section>
      )}

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-1">Pre-use checklist</h2>
        <p className="text-sm text-ink-muted mb-4">What &ldquo;Run a check&rdquo; asks for this {asset.type === 'VEHICLE' ? 'vehicle' : 'machine'}.</p>
        <ol className="divide-y divide-hairline mb-4">
          {asset.checklistItems.map((item, i) => (
            <li key={item.id} className="py-2.5 flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-brand-100 text-forest grid place-items-center text-xs font-bold">{i + 1}</span>
              <span className="flex-1 text-sm">{item.label}</span>
              {can(user, 'assets.edit') && (
                <form action={removeAssetChecklistItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="text-ink-faint hover:text-signal p-1" aria-label={`Remove: ${item.label}`}><Trash2 size={16} /></button>
                </form>
              )}
            </li>
          ))}
          {asset.checklistItems.length === 0 && <li className="py-2.5 text-ink-muted text-sm">Nothing on the checklist yet.</li>}
        </ol>
        {can(user, 'assets.edit') && (
          <form action={addAssetChecklistItem} className="flex gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <input name="label" required className="input flex-1" placeholder="e.g. Tail lift operation" aria-label="New checklist item" />
            <button className="btn-primary">Add item</button>
          </form>
        )}
      </section>

      <section className="card card-pad mb-6">
        <h2 className="text-lg font-bold mb-3">Check history</h2>
        <ul className="text-sm divide-y divide-hairline">
          {asset.checks.map((c) => (
            <li key={c.id} className="py-3 flex flex-wrap items-center gap-2">
              <Link href={`/checks/${c.id}`} className="text-ink-muted w-40 hover:text-ink hover:underline">
                {shortDate(c.performedAt)} {clock(c.performedAt)}
              </Link>
              <Pill tone={c.result === 'PASS' ? 'good' : 'bad'}>{c.result === 'PASS' ? 'Pass' : 'Issue flagged'}</Pill>
              <span className="text-ink-muted">{c.user?.name ?? 'Unknown'}</span>
              {c.items.some((i) => !i.ok) && (
                <span className="text-signal w-full text-sm">{c.items.filter((i) => !i.ok).map((i) => i.label).join(', ')}</span>
              )}
            </li>
          ))}
          {asset.checks.length === 0 && <li className="py-3 text-ink-muted">Nothing logged yet.</li>}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Inspection history</h2>
          <ul className="text-sm divide-y divide-hairline">
            {asset.inspections.map((i) => (
              <li key={i.id} className="py-3 flex flex-wrap items-center gap-2">
                <span className="text-ink-muted w-28">{shortDate(i.performedOn)}</span>
                <span className="font-semibold">{i.kind}</span>
                <Pill tone={i.result === 'Pass' ? 'good' : i.result === 'Fail' ? 'bad' : 'warn'}>{i.result}</Pill>
                <span className="text-ink-muted">{i.provider}</span>
                {i.notes && <span className="text-ink-muted italic w-full">{i.notes}</span>}
              </li>
            ))}
            {asset.inspections.length === 0 && <li className="py-3 text-ink-muted">Nothing logged yet.</li>}
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-3">Notes</h2>
          <ul className="text-sm space-y-3 mb-4">
            {asset.notes.map((n) => (
              <li key={n.id} className="bg-canvas rounded-xl px-4 py-3">
                <p>{n.body}</p>
                <p className="text-xs text-ink-faint mt-1">{n.user?.name} · {shortDate(n.at)}</p>
              </li>
            ))}
            {asset.notes.length === 0 && <li className="text-ink-muted">No notes.</li>}
          </ul>
          <form action={addAssetNote} className="flex gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <input name="body" className="input flex-1" placeholder="Add a note…" aria-label="New note" />
            <button className="btn-secondary">Add</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, isoDateUk, shortDate, tonnes } from '@/lib/format';
import { DELIVERY_COLOUR_LABEL, DELIVERY_COLOUR_SWATCH } from '@/lib/deliveryColours';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { setEventDelivered, updateDelivery } from '../../actions';
import { HiabBadge } from '../../HiabBadge';
import { DeleteDeliveryButton } from './DeleteDeliveryButton';

/** A stand-alone delivery's own page — reached by clicking it on the board.
 * The date, driver, weight and hiab can be changed here; the rest is set
 * once when it's added (see planning/new) and shown read-only for context.
 * A real Order's delivery still opens the order itself, never this page. */
export default async function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('planning.view');
  const alerts = await getAlerts(user);

  const event = await db.planningEvent.findUnique({ where: { id: params.id }, include: { driver: true } });
  if (!event || event.type !== 'DELIVERY' || event.orderId) notFound();

  const canEdit = can(user, 'planning.edit');
  const drivers = canEdit
    ? await db.driver.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
    : [];

  return (
    <Shell user={user} module="planning" nav={NAV.planning} current="/planning" alerts={alerts.length}>
      <Link href="/planning" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline mb-4">
        <ArrowLeft size={16} /> Back to Deliveries
      </Link>

      <PageHeader
        title={event.title.replace(/^Deliver(?:y)?\s+to\s+/i, '')}
        blurb={`${shortDate(event.startsAt)}${event.allDay ? '' : ` at ${clock(event.startsAt)}`} · ${event.town}`}
        actions={(can(user, 'orders.progress') || can(user, 'planning.edit')) && (event.done || event.driverId) ? (
          <form action={setEventDelivered}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="done" value={event.done ? '0' : '1'} />
            <SubmitButton className={event.done ? 'btn-secondary' : 'btn-primary'} pendingLabel="Saving…">
              {event.done ? 'Mark as not delivered' : 'Mark delivered'}
            </SubmitButton>
          </form>
        ) : undefined}
      />

      <section className="card card-pad max-w-lg space-y-5">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {event.weightKg != null && (
            <span><span className="text-ink-faint">Weight</span> <strong>{tonnes(event.weightKg)}</strong></span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="text-ink-faint">Colour</span>
            <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: DELIVERY_COLOUR_SWATCH[event.colour] }} aria-hidden />
            {DELIVERY_COLOUR_LABEL[event.colour]}
          </span>
          {event.hiab && <span className="flex items-center gap-1.5"><HiabBadge /> Needs a hiab</span>}
          {event.done && <Pill tone="good">Delivered</Pill>}
        </div>

        {!event.driverId && !event.done && (
          <p className="text-sm text-ink-muted">Assign a driver to be able to mark it delivered.</p>
        )}

        {canEdit ? (
          <form key={`${event.startsAt.toISOString()}-${event.driverId}-${event.hiab}-${event.weightKg}`} action={updateDelivery} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="eventId" value={event.id} />
            <div>
              <label className="label" htmlFor="date">Date</label>
              <input id="date" name="date" type="date" required defaultValue={isoDateUk(event.startsAt)} className="input w-44" />
            </div>
            <div>
              <label className="label" htmlFor="weightTonnes">Weight (tonnes)</label>
              <input
                id="weightTonnes" name="weightTonnes" type="number" step="0.001" min="0.001" required inputMode="decimal"
                defaultValue={event.weightKg != null ? Number(event.weightKg) / 1000 : ''} className="input w-32" placeholder="2.4"
              />
            </div>
            <div className="flex-1 min-w-[180px] max-w-xs">
              <label className="label" htmlFor="driverId">Driver</label>
              <select id="driverId" name="driverId" defaultValue={event.driverId ?? ''} className="input">
                <option value="">Not assigned</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium basis-full">
              <input type="checkbox" name="hiab" defaultChecked={event.hiab} className="h-4 w-4 accent-brand" />
              Needs a hiab <HiabBadge />
            </label>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </form>
        ) : (
          <p className="text-sm">
            <span className="text-ink-faint">Driver</span> <strong>{event.driver?.name ?? 'Not assigned'}</strong>
          </p>
        )}
      </section>

      {canEdit && (
        <div className="max-w-lg mt-6">
          <DeleteDeliveryButton
            eventId={event.id}
            summary={`${event.title.replace(/^Deliver(?:y)?\s+to\s+/i, '')} on ${shortDate(event.startsAt)}`}
          />
        </div>
      )}
    </Shell>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { can } from '@/lib/rbac';
import { clock, shortDate, tonnes } from '@/lib/format';
import { DELIVERY_COLOUR_LABEL, DELIVERY_COLOUR_SWATCH } from '@/lib/deliveryColours';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader, Pill } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { assignDeliveryDriver, markEventDelivered } from '../../actions';

/** A stand-alone delivery's own page — reached by clicking it on the board.
 * Deliberately narrow: everything but the driver is set once when it's
 * added (see planning/new) and shown here read-only for context; the
 * driver is the one thing that's often not known yet at that point. A real
 * Order's delivery still opens the order itself, never this page. */
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
        actions={!event.done && can(user, 'orders.progress') ? (
          <form action={markEventDelivered}>
            <input type="hidden" name="eventId" value={event.id} />
            <SubmitButton pendingLabel="Marking…">Mark delivered</SubmitButton>
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
          {event.done && <Pill tone="good">Delivered</Pill>}
        </div>

        {canEdit ? (
          <form action={assignDeliveryDriver} className="flex items-end gap-3">
            <input type="hidden" name="eventId" value={event.id} />
            <div className="flex-1 max-w-xs">
              <label className="label" htmlFor="driverId">Driver</label>
              <select id="driverId" name="driverId" defaultValue={event.driverId ?? ''} className="input">
                <option value="">Not assigned</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </form>
        ) : (
          <p className="text-sm">
            <span className="text-ink-faint">Driver</span> <strong>{event.driver?.name ?? 'Not assigned'}</strong>
          </p>
        )}
      </section>
    </Shell>
  );
}

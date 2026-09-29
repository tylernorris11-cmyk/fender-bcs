import { Check } from 'lucide-react';
import { advanceStage } from '@/app/orders/actions';
import { setEventDelivered } from './actions';

export type DeliveredControl = { eventId: string; done: boolean } | { orderId: string };

/**
 * The green circle at the bottom right of a delivery's box. An empty ring
 * marks it delivered; a filled one takes that back, so a stray tap on the
 * board screen is one more tap to undo. An order's delivery can only be
 * moved forward (its stage never goes back from the board), so its circle
 * only appears while it's out for delivery.
 */
export function DeliveredCircle({ control }: { control: DeliveredControl }) {
  const done = 'done' in control && control.done;
  const button = (
    <button
      type="submit"
      aria-label={done ? 'Mark as not delivered' : 'Mark delivered'}
      title={done ? 'Delivered. Tap to undo' : 'Mark delivered'}
      className={`grid place-items-center h-6 w-6 rounded-full border-2 border-emerald-500 transition-transform active:scale-90 ${
        done ? 'bg-emerald-500 text-white' : 'bg-white text-transparent hover:text-emerald-500'
      }`}
    >
      <Check size={14} strokeWidth={3} />
    </button>
  );

  return 'eventId' in control ? (
    <form action={setEventDelivered} className="absolute -bottom-2 -right-2 z-10">
      <input type="hidden" name="eventId" value={control.eventId} />
      <input type="hidden" name="done" value={done ? '0' : '1'} />
      {button}
    </form>
  ) : (
    <form action={advanceStage} className="absolute -bottom-2 -right-2 z-10">
      <input type="hidden" name="orderId" value={control.orderId} />
      {button}
    </form>
  );
}

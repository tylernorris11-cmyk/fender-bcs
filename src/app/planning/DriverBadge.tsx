import { Check } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { setEventDelivered } from './actions';

export type DriverTick = { eventId: string; done: boolean };

/**
 * The driver's initials at the top left of a delivery's box, which is also
 * how it's ticked off: tap to mark it delivered, tap again to undo. A
 * delivery needs a driver before it can be delivered, so no driver means no
 * badge and nothing to tick. `tick` is only set for someone allowed to mark
 * deliveries; everyone else just sees the badge.
 */
export function DriverBadge({ name, colour, tick }: { name: string; colour: string; tick?: DriverTick }) {
  const done = !!tick?.done;
  // Flex rather than block/inline-block wrappers, so each is exactly the
  // avatar's 20px and not the taller text line around it; otherwise the
  // green ring sits lower than the circle it's meant to go round.
  const face = (
    <span className="relative flex">
      <span className={`flex rounded-full ${done ? 'ring-2 ring-emerald-500' : ''}`}>
        <Avatar name={name} colour={colour} size={20} />
      </span>
      {done && (
        <span className="absolute -bottom-1 -right-1 grid place-items-center h-3.5 w-3.5 rounded-full bg-emerald-500 text-white ring-1 ring-white">
          <Check size={9} strokeWidth={4} />
        </span>
      )}
    </span>
  );

  if (!tick) {
    return <span className="absolute -top-2 -left-2 z-10" title={name}>{face}</span>;
  }

  return (
    <form action={setEventDelivered} className="absolute -top-2 -left-2 z-10">
      <input type="hidden" name="eventId" value={tick.eventId} />
      <input type="hidden" name="done" value={done ? '0' : '1'} />
      <button
        type="submit"
        title={done ? `Delivered by ${name}. Tap to undo` : `${name}. Tap to mark delivered`}
        aria-label={done ? `Delivered by ${name}. Mark as not delivered` : `Mark delivered by ${name}`}
        className="flex rounded-full transition-transform hover:scale-110 active:scale-90"
      >
        {face}
      </button>
    </form>
  );
}

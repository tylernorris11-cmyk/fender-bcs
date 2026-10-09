import type { DeliveryColour } from '@prisma/client';
import { DELIVERY_COLOURS, DELIVERY_COLOUR_LABEL, DELIVERY_COLOUR_SWATCH } from '@/lib/deliveryColours';

/**
 * The delivery board's colours as plain radio buttons, so it works in a
 * server-rendered form as well as a client one — the colour an order's box
 * is shown in on the board. Matches the swatches on the add-a-delivery form.
 */
export function BoardColourPicker({
  name = 'boardColour', defaultValue, small = false, legend = 'Delivery board colour',
}: { name?: string; defaultValue?: DeliveryColour | null; small?: boolean; legend?: string }) {
  const size = small ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <fieldset>
      <legend className={small ? 'sr-only' : 'label'}>{legend}</legend>
      <div className="flex gap-2.5">
        {DELIVERY_COLOURS.map((c) => (
          <label key={c} title={DELIVERY_COLOUR_LABEL[c]} className="cursor-pointer">
            <input type="radio" name={name} value={c} defaultChecked={defaultValue === c} className="peer sr-only" />
            <span
              className={`block ${size} rounded-full border-2 border-transparent transition-transform hover:scale-105 peer-checked:scale-110 peer-checked:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand`}
              style={{ backgroundColor: DELIVERY_COLOUR_SWATCH[c] }}
            />
            <span className="sr-only">{DELIVERY_COLOUR_LABEL[c]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

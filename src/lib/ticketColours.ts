/** The colours of tally ticket stock, chosen per order so its bundles can be told apart on site. Printed on the delivery note. */
export const TICKET_COLOURS = ['Red', 'Blue', 'Pink', 'Orange', 'Green', 'Yellow', 'White'];

/** The longest colour name that can be typed in for an order. */
export const TICKET_COLOUR_MAX = 30;

// The swatch printed beside the colour on the delivery note: the usual stock
// colours, plus the common ones likely to be typed in. Anything else just
// prints its name.
const SWATCHES: Record<string, string> = {
  red: '#DC2626', blue: '#2563EB', pink: '#EC4899', orange: '#F97316', green: '#16A34A', yellow: '#EAB308', white: '#FFFFFF',
  purple: '#9333EA', violet: '#7C3AED', lilac: '#C4B5FD', brown: '#92400E', black: '#111827', grey: '#9CA3AF', gray: '#9CA3AF',
  'light blue': '#7DD3FC', 'sky blue': '#38BDF8', 'dark blue': '#1E3A8A', navy: '#1E3A8A', turquoise: '#2DD4BF', teal: '#0D9488',
  'light green': '#86EFAC', 'dark green': '#166534', lime: '#84CC16', gold: '#CA8A04', silver: '#CBD5E1', cream: '#FEF3C7',
  beige: '#E7D7B9', peach: '#FDBA8C', maroon: '#7F1D1D', magenta: '#DB2777', cyan: '#06B6D4',
};

/** The swatch colour for a ticket colour, or undefined when it isn't one we know. */
export const ticketSwatch = (colour: string) => SWATCHES[colour.replace(/\s+/g, ' ').trim().toLowerCase()];

/**
 * A typed-in colour tidied up: spaces collapsed, a capital first letter, and
 * the spelling of a colour already in `known` reused, so "red" and "Red"
 * stay one colour.
 */
export function tidyTicketColour(typed: string, known: string[] = TICKET_COLOURS) {
  const t = typed.replace(/\s+/g, ' ').trim().slice(0, TICKET_COLOUR_MAX);
  if (!t) return '';
  return known.find((k) => k.toLowerCase() === t.toLowerCase()) ?? t.charAt(0).toUpperCase() + t.slice(1);
}

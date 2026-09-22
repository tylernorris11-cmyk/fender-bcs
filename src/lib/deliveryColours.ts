import type { DeliveryColour } from '@prisma/client';

/** One place for what each delivery colour looks like — used by the board
 * (src/app/planning/page.tsx) and the swatch picker on the add-a-delivery
 * form (src/app/planning/new/NewDeliveryForm.tsx), so the two can never
 * drift out of sync. Type-only import of DeliveryColour keeps this file
 * safe to import from a client component — no @prisma/client runtime code
 * ends up in the browser bundle. */
export const DELIVERY_COLOURS: DeliveryColour[] = ['BLUE', 'RED', 'BLACK', 'GREEN'];

export const DELIVERY_COLOUR_LABEL: Record<DeliveryColour, string> = {
  BLUE: 'Blue', RED: 'Red', BLACK: 'Black', GREEN: 'Green',
};

/** The swatch itself — the picker on the form. */
export const DELIVERY_COLOUR_SWATCH: Record<DeliveryColour, string> = {
  BLUE: '#2563EB', RED: '#DC2626', BLACK: '#0F172A', GREEN: '#16A34A',
};

/** Left border + background for the delivery's box on the board. */
export const DELIVERY_COLOUR_BOARD: Record<DeliveryColour, string> = {
  BLUE: 'border-blue-500 bg-blue-50',
  RED: 'border-red-500 bg-red-50',
  BLACK: 'border-slate-800 bg-slate-100',
  GREEN: 'border-emerald-500 bg-emerald-50',
};

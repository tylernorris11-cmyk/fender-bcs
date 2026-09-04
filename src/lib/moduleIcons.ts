import {
  CalendarDays, CalendarHeart, ClipboardCheck, ClipboardList, Factory, Fuel, HardHat, Layers,
  Settings, ShieldCheck, ShoppingCart, Truck, Users, type LucideIcon,
} from 'lucide-react';

/** One icon per module key — shared between the home screen tiles and the
 * module switcher dropdown, so the two never drift out of sync. */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList, purchaseOrders: ShoppingCart, production: Factory, planning: CalendarDays, customers: Users,
  compliance: ShieldCheck, stock: Layers, assets: Truck, checks: ClipboardCheck, fuel: Fuel, holidays: CalendarHeart,
  hs: HardHat, setup: Settings,
};

/** Same accent per module as the home screen tiles, so the colour is the
 * thing people learn to recognise, not just the label. */
export const MODULE_COLORS: Record<string, string> = {
  orders: 'text-brand-700', purchaseOrders: 'text-cyan-700', production: 'text-violet-700', planning: 'text-sky-700',
  customers: 'text-emerald-700', compliance: 'text-signal', stock: 'text-amber-700', assets: 'text-indigo-700',
  checks: 'text-lime-700', fuel: 'text-orange-700', holidays: 'text-rose-700', hs: 'text-teal-700', setup: 'text-ink-muted',
};

import { AlertTriangle } from 'lucide-react';

/**
 * Hazard-tape banner for sections still being actively built — Assets,
 * Checks and Fuel have had enough real use and testing to leave it off;
 * everywhere else gets it until the same is true there. Not a Tailwind
 * component class since the exact hazard yellow/black isn't part of the
 * theme palette elsewhere — see .hazard-stripe in globals.css.
 */
export function InProgressBanner() {
  return (
    <div className="print:hidden">
      <div className="h-1.5 hazard-stripe" aria-hidden />
      <div className="bg-[#16110A] text-[#F5C518] text-center text-xs font-semibold tracking-wide py-2 px-4 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="shrink-0" aria-hidden />
        This section is still being worked on — some things may change or not work as expected
      </div>
      <div className="h-1.5 hazard-stripe" aria-hidden />
    </div>
  );
}

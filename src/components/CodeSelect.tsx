import type { CodeOption } from '@/lib/ledger';

/** A VAT or nominal code picker for account and stock records. */
export function CodeSelect({
  name, label, options, defaultValue, hint,
}: { name: string; label: string; options: CodeOption[]; defaultValue?: string | null; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} className="input">
        <option value="">None</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Shown in place of the pickers when a company has no codes yet. */
export function NoCodesYet() {
  return (
    <p className="hint sm:col-span-2">
      No VAT or nominal codes set up for this company yet. Add them in Accounts, or they&apos;ll come across with the Exchequer import.
    </p>
  );
}

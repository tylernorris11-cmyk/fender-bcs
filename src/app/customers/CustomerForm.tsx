import Link from 'next/link';
import { can, type SessionUser } from '@/lib/rbac';
import type { CodeOption } from '@/lib/ledger';
import { CodeSelect, NoCodesYet } from '@/components/CodeSelect';

type Values = {
  id?: string; code?: string; name?: string; contactName?: string; phone?: string; email?: string;
  address?: string; town?: string; postcode?: string; paymentTerms?: string;
  status?: string; accountManagerId?: string | null; creditLimit?: string; notes?: string;
  vatCodeId?: string | null; nominalCodeId?: string | null;
};

/** Shared by the new and edit screens so the two never drift apart. */
export function CustomerForm({
  user, action, values = {}, managers, towns, codes, submitLabel,
}: {
  user: SessionUser;
  action: (formData: FormData) => void;
  values?: Values;
  managers: { id: string; name: string }[];
  towns: string[];
  codes: { vatCodes: CodeOption[]; nominalCodes: CodeOption[] };
  submitLabel: string;
}) {
  return (
    <form action={action} className="card card-pad grid gap-5 sm:grid-cols-2 max-w-3xl">
      {values.id && <input type="hidden" name="customerId" value={values.id} />}

      <div>
        <label className="label" htmlFor="code">Account code</label>
        <input id="code" name="code" maxLength={6} defaultValue={values.code} className="input font-mono uppercase" placeholder="FARN01" />
        <p className="hint">The Exchequer account code, up to 6 letters and numbers. Leave blank and one is made from the name.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">Account name</label>
        <input id="name" name="name" required defaultValue={values.name} className="input" />
      </div>

      <div>
        <label className="label" htmlFor="contactName">Main contact</label>
        <input id="contactName" name="contactName" defaultValue={values.contactName} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" defaultValue={values.phone} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email for invoices</label>
        <input id="email" name="email" type="email" defaultValue={values.email} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="town">Town / city</label>
        <select id="town" name="town" defaultValue={values.town ?? ''} className="input">
          <option value="">—</option>
          {towns.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="address">Account address</label>
        <textarea id="address" name="address" rows={2} defaultValue={values.address} className="input" />
        <p className="hint">Site deliveries get their own address on the order — this is the account address.</p>
      </div>
      <div>
        <label className="label" htmlFor="postcode">Postcode</label>
        <input id="postcode" name="postcode" defaultValue={values.postcode} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="paymentTerms">Payment terms</label>
        <input id="paymentTerms" name="paymentTerms" defaultValue={values.paymentTerms ?? '30 days end of month'} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="accountManagerId">Account manager</label>
        <select id="accountManagerId" name="accountManagerId" defaultValue={values.accountManagerId ?? ''} className="input">
          <option value="">Unassigned</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={values.status ?? 'Active'} className="input">
          <option>Active</option><option>On hold</option><option>Closed</option>
        </select>
      </div>

      {can(user, 'customers.credit') ? (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="creditLimit">Credit limit (£)</label>
          <input id="creditLimit" name="creditLimit" type="number" step="1" min="0"
                 defaultValue={values.creditLimit ?? '0'} className="input" />
          <p className="hint">Orders that would take the account past this cannot be approved without an override.</p>
        </div>
      ) : (
        <p className="sm:col-span-2 hint">
          Credit limits are set by a director. Ask John to set one once the account is open.
        </p>
      )}

      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={values.notes} className="input" />
      </div>

      {can(user, 'accounts.setup') && (
        <fieldset className="sm:col-span-2 grid gap-5 sm:grid-cols-2 border-t border-hairline pt-5">
          <legend className="text-sm font-bold mb-3">Accounts</legend>
          {codes.vatCodes.length + codes.nominalCodes.length === 0 ? <NoCodesYet /> : (
            <>
              <CodeSelect name="vatCodeId" label="Default VAT code" options={codes.vatCodes} defaultValue={values.vatCodeId} />
              <CodeSelect name="nominalCodeId" label="Default sales nominal code" options={codes.nominalCodes} defaultValue={values.nominalCodeId}
                          hint="Used for invoice lines with no stock record behind them." />
            </>
          )}
        </fieldset>
      )}

      <div className="sm:col-span-2 flex gap-3">
        <button className="btn-primary">{submitLabel}</button>
        <Link href={values.id ? `/customers/${values.id}` : '/customers'} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}

import Link from 'next/link';
import { can, type SessionUser } from '@/lib/rbac';
import type { CodeOption } from '@/lib/ledger';
import { CodeSelect, NoCodesYet } from '@/components/CodeSelect';
import { SubmitButton } from '@/components/SubmitButton';

type Values = {
  id?: string; code?: string | null; name?: string; contactName?: string; email?: string; phone?: string;
  country?: string; notes?: string; vatCodeId?: string | null; nominalCodeId?: string | null;
};

/** Shared by the new and edit screens. */
export function SupplierForm({
  user, action, values = {}, codes, submitLabel,
}: {
  user: SessionUser;
  action: (formData: FormData) => void;
  values?: Values;
  codes: { vatCodes: CodeOption[]; nominalCodes: CodeOption[] };
  submitLabel: string;
}) {
  return (
    <form action={action} className="card card-pad grid gap-5 sm:grid-cols-2 max-w-3xl">
      {values.id && <input type="hidden" name="supplierId" value={values.id} />}

      <div>
        <label className="label" htmlFor="code">Account code</label>
        <input id="code" name="code" maxLength={6} defaultValue={values.code ?? ''} className="input font-mono uppercase" placeholder="ACEE02" />
        <p className="hint">The Exchequer account code, up to 6 letters and numbers. Leave blank and one is made from the name.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">Supplier name</label>
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
        <label className="label" htmlFor="email">Email for orders</label>
        <input id="email" name="email" type="email" defaultValue={values.email} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="country">Country</label>
        <input id="country" name="country" defaultValue={values.country ?? 'United Kingdom'} className="input" />
      </div>
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
              <CodeSelect name="nominalCodeId" label="Default purchases nominal code" options={codes.nominalCodes} defaultValue={values.nominalCodeId}
                          hint="Used for supplier invoice lines with no stock record behind them." />
            </>
          )}
        </fieldset>
      )}

      <div className="sm:col-span-2 flex gap-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link href="/purchase-orders/suppliers" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}

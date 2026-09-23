'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { postJournal } from '../../actions';

type Code = { code: string; name: string };
type Line = { key: number; nominalCode: string; description: string; debit: string; credit: string };

const gbp = (pennies: number) => (pennies / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
const pennies = (v: string) => Math.round(Number(v || 0) * 100);

let seq = 0;
const newLine = (): Line => ({ key: seq++, nominalCode: '', description: '', debit: '', credit: '' });

export function JournalForm({ codes, today }: { codes: Code[]; today: string }) {
  const [lines, setLines] = useState<Line[]>([newLine(), newLine()]);

  const { debit, credit, filled } = useMemo(() => ({
    debit: lines.reduce((s, l) => s + pennies(l.debit), 0),
    credit: lines.reduce((s, l) => s + pennies(l.credit), 0),
    filled: lines.filter((l) => pennies(l.debit) || pennies(l.credit)).length,
  }), [lines]);
  const difference = debit - credit;
  const ready = filled >= 2 && difference === 0 && debit > 0;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={postJournal} className="space-y-6">
      <section className="card card-pad grid gap-6 md:grid-cols-[200px_1fr]">
        <div>
          <label className="label" htmlFor="transDate">Date</label>
          <input id="transDate" name="transDate" type="date" required defaultValue={today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <input id="description" name="description" className="input" placeholder="e.g. Accrual for September electricity" />
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="text-lg font-bold">Lines</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">Each line is a debit or a credit, not both. Debits have to equal credits before it can post.</p>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={line.key} className="grid gap-3 items-end bg-canvas rounded-xl p-3 md:grid-cols-[minmax(200px,1.2fr)_1fr_130px_130px_44px]">
              <div>
                <label className="label text-xs" htmlFor={`code-${line.key}`}>Nominal code</label>
                <select id={`code-${line.key}`} name={`line[${i}][nominalCode]`} value={line.nominalCode}
                        onChange={(e) => update(line.key, { nominalCode: e.target.value })} className="input">
                  <option value="">Choose…</option>
                  {codes.map((c) => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs" htmlFor={`desc-${line.key}`}>Line description</label>
                <input id={`desc-${line.key}`} name={`line[${i}][description]`} value={line.description}
                       onChange={(e) => update(line.key, { description: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label text-xs" htmlFor={`dr-${line.key}`}>Debit (£)</label>
                <input id={`dr-${line.key}`} name={`line[${i}][debit]`} type="number" step="0.01" min="0" placeholder="0.00"
                       value={line.debit} onChange={(e) => update(line.key, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                       className="input text-right" />
              </div>
              <div>
                <label className="label text-xs" htmlFor={`cr-${line.key}`}>Credit (£)</label>
                <input id={`cr-${line.key}`} name={`line[${i}][credit]`} type="number" step="0.01" min="0" placeholder="0.00"
                       value={line.credit} onChange={(e) => update(line.key, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                       className="input text-right" />
              </div>
              <button type="button" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      disabled={lines.length <= 2} className="btn-ghost p-2.5 mb-1 disabled:opacity-30" aria-label="Remove this line">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setLines((p) => [...p, newLine()])} className="btn-secondary mt-4">
          <Plus size={16} /> Add a line
        </button>

        <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 pt-5 mt-5 border-t border-hairline text-sm tabular-nums">
          <span>Debits <strong>{gbp(debit)}</strong></span>
          <span>Credits <strong>{gbp(credit)}</strong></span>
          <span className={difference === 0 ? 'text-brand-700 font-semibold' : 'text-signal font-semibold'}>
            {difference === 0 ? 'Balances' : `${gbp(Math.abs(difference))} out`}
          </span>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton disabled={!ready} pendingLabel="Posting…">Post journal</SubmitButton>
      </div>
    </form>
  );
}

'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SubmitButton } from '@/components/SubmitButton';
import { createUser } from '../actions';

export function AddUserForm({ roles }: { roles: { value: string; label: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setError('');
        setDone('');
        const res = await createUser(formData);
        if (res.ok) { setDone(res.message); formRef.current?.reset(); }
        else setError(res.error);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {error && <p className="banner-bad sm:col-span-2 flex items-center gap-2"><AlertTriangle size={16} aria-hidden /> {error}</p>}
      {done && <p className="banner-ok sm:col-span-2 flex items-center gap-2"><CheckCircle2 size={16} aria-hidden /> {done}</p>}
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="name@fendersteel.co.uk" />
      </div>
      <div>
        <label className="label" htmlFor="jobTitle">Job title</label>
        <input id="jobTitle" name="jobTitle" className="input" placeholder="Yard manager" />
      </div>
      <div>
        <label className="label" htmlFor="role">Role</label>
        <select id="role" name="role" defaultValue="YARD" className="input">
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="password">Starting password</label>
        <input id="password" name="password" type="text" required className="input" />
        <p className="hint">At least ten characters with a number. They will be asked to change it.</p>
      </div>
      <div><SubmitButton pendingLabel="Creating…">Create account</SubmitButton></div>
    </form>
  );
}

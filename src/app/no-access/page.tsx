import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/rbac';

export default async function NoAccess({ searchParams }: { searchParams: { needed?: string } }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card card-pad max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">That area is not on your account</h1>
        <p className="text-ink-muted">
          You are signed in as <strong>{user.name}</strong> with the {ROLE_LABELS[user.role].toLowerCase()} role.
          {searchParams.needed && <> This screen needs the <code className="text-ink">{searchParams.needed}</code> permission.</>}
        </p>
        <p className="text-ink-muted mt-3">Ask Lee or Tyler if you need it adding.</p>
        <Link href="/" className="btn-primary mt-6 w-full">Back to the control centre</Link>
      </div>
    </div>
  );
}

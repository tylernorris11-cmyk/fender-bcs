import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card card-pad max-w-md text-center">
        <span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-slate-100 text-ink-faint mx-auto mb-4">
          <SearchX size={26} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold mb-2">That doesn&apos;t exist</h1>
        <p className="text-ink-muted">
          Nothing here — the link might be old, or the record might have been removed.
        </p>
        <Link href="/" className="btn-primary mt-6 w-full">Back to the control centre</Link>
      </div>
    </div>
  );
}

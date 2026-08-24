'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Catches anything thrown by a page, a server action, or a data fetch.
 * The app's own thrown errors are already written to be read by a human
 * ("Choose a customer before saving.") — this just makes sure that message
 * actually reaches them instead of Next's default overlay or a blank page.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card card-pad max-w-md text-center">
        <span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-signal/10 text-signal mx-auto mb-4">
          <AlertTriangle size={26} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-ink-muted">
          {error.message || 'An unexpected error happened. Nothing was saved.'}
        </p>
        {error.digest && <p className="text-xs text-ink-faint mt-3">Reference: {error.digest}</p>}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button onClick={reset} className="btn-primary flex-1"><RotateCcw size={16} /> Try again</button>
          <Link href="/" className="btn-secondary flex-1">Back to the control centre</Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/**
 * A pop-up whose open state lives in the page address (e.g. ?user=…), so it
 * survives a save re-rendering the page, can be linked to, and closes with
 * the browser's Back button as well as Escape, a click outside, or the X.
 */
export function UrlModal({ closeHref, title, children }: { closeHref: string; title: ReactNode; children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(closeHref, { scroll: false }); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [closeHref, router]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={() => router.push(closeHref, { scroll: false })}
      role="dialog"
      aria-modal="true"
    >
      <div className="card card-pad w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">{title}</div>
          <Link href={closeHref} scroll={false} aria-label="Close" className="text-ink-faint hover:text-ink shrink-0">
            <X size={22} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

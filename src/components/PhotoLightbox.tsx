'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * A thumbnail that opens full-screen in an overlay on the same page, rather
 * than a link to the image URL. Photos attached to a check are stored as a
 * data: URL (resized client-side, no Blob upload) — browsers block a
 * top-level navigation to a data: URL (a `target="_blank"` link to one just
 * silently fails to open), so this never navigates anywhere at all.
 */
export function PhotoLightbox({ src, alt = '' }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-block mt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-32 w-32 rounded-xl object-cover border border-hairline hover:opacity-90" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 print:hidden"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

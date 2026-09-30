'use client';

import type { ReactNode } from 'react';

/** A GET filter form that applies as soon as a drop-down changes; the search box applies on Enter. */
export function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form
      className={className}
      onChange={(e) => { if ((e.target as HTMLElement).tagName === 'SELECT') e.currentTarget.requestSubmit(); }}
    >
      {children}
    </form>
  );
}

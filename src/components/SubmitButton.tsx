'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/**
 * A plain <button type="submit"> inside a <form action={...}> gives no sign
 * it did anything until the whole page re-renders — on a slow connection
 * (or an upload, which takes real time) that gap reads as "did that even
 * register?" and invites a second tap. useFormStatus reads the nearest
 * parent <form>'s pending state — has to live in its own component, not the
 * form itself, that's a React requirement rather than a style choice — so
 * this swaps in a spinner and a label for exactly as long as the action is
 * actually running, and can't be double-tapped while it is.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  className = 'btn-primary',
  disabled = false,
  ...props
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'type' | 'disabled'> & { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className} {...props}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

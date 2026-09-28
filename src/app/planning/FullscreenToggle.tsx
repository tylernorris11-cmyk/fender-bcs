'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Maximize2, Minimize2 } from 'lucide-react';

const REFRESH_EVERY_MS = 5 * 60 * 1000;

// Applied to the target element only while it's the fullscreen element —
// the browser's own fullscreen sizing (fixed, inset 0) is default black
// letterboxing, so this gives it a proper background, breathing room and
// its own scroll for whatever doesn't fit on one screen. board-dark turns
// on the dark version in globals.css.
const FULLSCREEN_CLASSES = ['bg-canvas', 'p-6', 'overflow-y-auto', 'h-screen', 'w-screen', 'board-dark'];

/**
 * Puts one element — found by id, not a React ref, since this button
 * doesn't share a parent with what it's fullscreening — on the whole
 * screen: browser chrome, and this app's own sidebar and header (neither
 * of which are inside that element), disappear along with it. Handy for
 * pinning the board on a spare monitor in the yard office. Escape exits
 * fullscreen in every browser without any code here.
 *
 * While fullscreen, the board re-fetches its data every five minutes. It's
 * an in-place refresh rather than a page reload, because a reload would
 * drop the browser out of fullscreen.
 */
export function FullscreenToggle({ targetId }: { targetId: string }) {
  const [active, setActive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  // A refresh can re-render the board's class list and wipe the fullscreen
  // styling added below, so put it back whenever that happens mid-fullscreen.
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (document.fullscreenElement === el && FULLSCREEN_CLASSES.some((c) => !el.classList.contains(c))) {
        el.classList.add(...FULLSCREEN_CLASSES);
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [active, targetId]);

  useEffect(() => {
    const onChange = () => {
      const el = document.getElementById(targetId);
      const isActive = !!el && document.fullscreenElement === el;
      setActive(isActive);
      if (el) FULLSCREEN_CLASSES.forEach((c) => el.classList.toggle(c, isActive));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [targetId]);

  function toggle() {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  }

  return (
    <button
      type="button" onClick={toggle} className="btn-secondary p-2.5"
      aria-label={active ? 'Exit full screen' : 'Full screen'}
      title={active ? 'Exit full screen' : 'Full screen'}
    >
      {active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { resizeImageToDataUrl } from '@/lib/image';

/**
 * Take a photo or pick some from the gallery. Each is shrunk on the phone
 * before it goes anywhere, then posted with the form as `photoData`.
 */
export function PhotoPicker({ max, onCountChange }: { max: number; onCountChange?: (n: number) => void }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = (next: string[]) => { setPhotos(next); onCountChange?.(next.length); };

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, max - photos.length)) {
      try { added.push(await resizeImageToDataUrl(file, 1600, 0.8)); } catch { /* not an image the browser can read — skip it */ }
    }
    set([...photos, ...added]);
    setBusy(false);
  }

  const full = photos.length >= max;
  const button = 'flex flex-col items-center justify-center gap-1 h-24 w-24 rounded-xl border-2 border-dashed border-hairline text-ink-muted text-xs cursor-pointer hover:bg-canvas';

  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((src, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-xl object-cover border border-hairline" />
          <input type="hidden" name="photoData" value={src} />
          <button type="button" onClick={() => set(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
            className="absolute -top-2 -right-2 grid place-items-center h-6 w-6 rounded-full bg-ink text-white shadow">
            <X size={14} />
          </button>
        </div>
      ))}
      {!full && (
        <>
          <label className={button}>
            <Camera size={20} /> {busy ? 'Adding…' : 'Take photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
              onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
          <label className={button}>
            <ImagePlus size={20} /> {busy ? 'Adding…' : 'From gallery'}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={busy}
              onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
        </>
      )}
    </div>
  );
}

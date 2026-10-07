'use server';

import { getCurrentUser, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { mergeSchedule, type ScheduleMerge } from '@/lib/barSchedule';
import { readBarSchedulePages } from '@/lib/barScheduleExtraction';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export type ScheduleImport =
  | ({ ok: true; fileName: string; pages: number; rowsRead: number; unreadable: string[]; pageErrors: string[] } & ScheduleMerge)
  | { ok: false; error: string };

/**
 * Reads an uploaded bar schedule into bending schedule lines for the new
 * order form, with duplicates added together. Nothing is saved: the lines
 * go into the form to be checked and priced before the order is created.
 * Errors come back as a message rather than thrown, so they reach the page.
 */
export async function readBarSchedule(formData: FormData): Promise<ScheduleImport> {
  const user = await getCurrentUser();
  if (!user || !can(user, 'orders.create')) return { ok: false, error: 'You do not have permission to do that.' };

  const file = formData.get('schedule');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose the bar schedule to upload.' };
  if (!ACCEPTED.includes(file.type)) return { ok: false, error: 'Upload the schedule as a PDF, or a photo of it.' };

  try {
    const read = await readBarSchedulePages({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type });
    const merged = mergeSchedule(read.readings);
    if (merged.bars.length === 0) {
      return { ok: false, error: read.errors[0] ? `Couldn't read the schedule: ${read.errors.join('; ')}` : 'No bar marks were found in that file. Is it a bar schedule?' };
    }
    await logActivity('BarScheduleImport', user.id, 'Bar schedule read', `${file.name}: ${read.readings.length} rows, ${merged.bars.length} lines after duplicates`, user.id);
    return {
      ok: true, fileName: file.name, pages: read.pages, rowsRead: read.readings.length,
      unreadable: read.unreadable, pageErrors: read.errors, ...merged,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'The schedule could not be read.' };
  }
}

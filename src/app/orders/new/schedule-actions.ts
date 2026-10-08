'use server';

import { getCurrentUser, logActivity } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { mergeSchedule, type ScheduleMerge } from '@/lib/barSchedule';
import { readBarScheduleFiles } from '@/lib/barScheduleExtraction';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILES = 10;

export type ScheduleImport =
  | ({ ok: true; fileNames: string[]; pages: number; rowsRead: number; unreadable: string[]; pageErrors: string[] } & ScheduleMerge)
  | { ok: false; error: string };

/**
 * Reads one or more uploaded bar schedules into bending schedule lines for
 * the new order form, with duplicates added together across all of them.
 * Nothing is saved: the lines go into the form to be checked and priced
 * before the order is created. Errors come back as a message rather than
 * thrown, so they reach the page.
 */
export async function readBarSchedule(formData: FormData): Promise<ScheduleImport> {
  const user = await getCurrentUser();
  if (!user || !can(user, 'orders.create')) return { ok: false, error: 'You do not have permission to do that.' };

  const files = formData.getAll('schedule').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: 'Choose the bar schedule to upload.' };
  if (files.length > MAX_FILES) return { ok: false, error: `Upload up to ${MAX_FILES} files at a time.` };
  const wrong = files.find((f) => !ACCEPTED.includes(f.type));
  if (wrong) return { ok: false, error: `${wrong.name} isn't a PDF or a photo. Upload schedules as PDFs or photos.` };

  try {
    const read = await readBarScheduleFiles(
      await Promise.all(files.map(async (f) => ({ name: f.name, mimeType: f.type, bytes: new Uint8Array(await f.arrayBuffer()) }))),
    );
    const merged = mergeSchedule(read.readings);
    if (merged.bars.length === 0) {
      return { ok: false, error: read.errors[0] ? `Couldn't read the schedule: ${read.errors.join('; ')}` : 'No bar marks were found. Is it a bar schedule?' };
    }
    const names = files.map((f) => f.name);
    await logActivity('BarScheduleImport', user.id, 'Bar schedule read', `${names.join(', ')}: ${read.readings.length} rows, ${merged.bars.length} lines after duplicates`, user.id);
    return {
      ok: true, fileNames: names, pages: read.pages, rowsRead: read.readings.length,
      unreadable: read.unreadable, pageErrors: read.errors, ...merged,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'The schedule could not be read.' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertPermission } from '@/lib/auth';

export async function addNote(formData: FormData) {
  const user = await assertPermission('checks.create');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await db.note.create({ data: { body, userId: user.id } });
  revalidatePath('/checks/notes');
}

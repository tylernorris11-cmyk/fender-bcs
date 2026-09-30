'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { canAny } from '@/lib/rbac';
import { parseDay } from '@/lib/hs';
import { postedFile, storeHsFile } from '@/lib/hsFiles';

/** Training records are kept by whoever runs H&S or the app's training. */
async function assertCanManage() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Sign in again.');
  if (!canAny(user, 'hs.edit', 'hs.manageTraining')) throw new Error('You do not have permission to do that.');
  return user;
}

export async function saveTrainingRecord(formData: FormData) {
  const user = await assertCanManage();
  const id = String(formData.get('id') ?? '');
  const existing = id ? await db.hsTrainingRecord.findUniqueOrThrow({ where: { id } }) : null;

  const userId = String(formData.get('userId') ?? '') || null;
  const personName = userId ? '' : String(formData.get('personName') ?? '').trim();
  if (!userId && !personName) throw new Error('Choose who it\'s for, or type their name.');
  const course = String(formData.get('course') ?? '').trim();
  if (!course) throw new Error('Say what the training or ticket is.');
  const achievedOn = parseDay(formData.get('achievedOn'));
  const expiresOn = parseDay(formData.get('expiresOn'));
  if (achievedOn && expiresOn && expiresOn < achievedOn) throw new Error('The expiry date is before the date it was achieved.');

  const file = postedFile(formData, 'certificate');
  const removeFile = formData.get('removeCertificate') === 'on';
  const stored = file ? await storeHsFile(file, 'certificates', { allowWord: true }) : null;
  const fileFields = stored
    ? { certificateUrl: stored.url, certificateName: stored.name }
    : removeFile ? { certificateUrl: '', certificateName: '' } : {};

  const data = { userId, personName, course, achievedOn, expiresOn, notes: String(formData.get('notes') ?? '').trim(), ...fileFields };
  const record = existing
    ? await db.hsTrainingRecord.update({ where: { id: existing.id }, data })
    : await db.hsTrainingRecord.create({ data: { ...data, addedById: user.id } });

  const who = userId ? (await db.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? '' : personName;
  await logActivity('HsTrainingRecord', record.id, existing ? 'Updated' : 'Added', `${who}: ${course}`, user.id);
  revalidatePath('/hs/competence');
  revalidatePath('/hs/training');
  revalidatePath('/hs');
  redirect('/hs/competence');
}

export async function deleteTrainingRecord(formData: FormData) {
  const user = await assertCanManage();
  const id = String(formData.get('id') ?? '');
  const record = await db.hsTrainingRecord.findUniqueOrThrow({ where: { id }, include: { user: { select: { name: true } } } });

  await db.hsTrainingRecord.delete({ where: { id } });
  await logActivity('HsTrainingRecord', id, 'Deleted', `${record.user?.name ?? record.personName}: ${record.course}`, user.id);
  revalidatePath('/hs/competence');
  revalidatePath('/hs/training');
  revalidatePath('/hs');
  redirect('/hs/competence');
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertPermission, logActivity } from '@/lib/auth';
import { runBackupSync } from '@/lib/backupSync';
import { disconnectDrive } from '@/lib/googleDrive';

export async function syncDriveNow() {
  const user = await assertPermission('setup.backups');
  const result = await runBackupSync({ limit: 25 });
  await logActivity(
    'Setting',
    'googleDriveRefreshToken',
    'Google Drive sync run',
    `${result.uploaded} uploaded, ${result.failed} failed`,
    user.id,
  );
  revalidatePath('/setup/backups');
  redirect(`/setup/backups?syncResult=${encodeURIComponent(`${result.uploaded} uploaded, ${result.failed} failed`)}`);
}

export async function disconnectGoogleDrive() {
  const user = await assertPermission('setup.backups');
  await disconnectDrive();
  await logActivity('Setting', 'googleDriveRefreshToken', 'Google Drive disconnected', '', user.id);
  revalidatePath('/setup/backups');
}

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { buildDriveAuthUrl } from '@/lib/googleDrive';

/** Kicks off the one-time Google sign-in that lets the nightly backup upload files. */
export async function GET(request: Request) {
  await requirePermission('setup.backups');
  const redirectUri = new URL('/api/setup/backups/drive/callback', request.url).toString();

  try {
    return NextResponse.redirect(buildDriveAuthUrl(redirectUri));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start the Google sign-in.';
    return NextResponse.redirect(new URL(`/setup/backups?driveError=${encodeURIComponent(message)}`, request.url));
  }
}

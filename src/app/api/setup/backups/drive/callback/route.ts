import { NextResponse } from 'next/server';
import { logActivity, requirePermission } from '@/lib/auth';
import { connectDriveWithCode } from '@/lib/googleDrive';

/** Where Google sends the admin back after they sign in and approve access. */
export async function GET(request: Request) {
  const user = await requirePermission('setup.backups');
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectUri = new URL('/api/setup/backups/drive/callback', request.url).toString();

  if (error) {
    return NextResponse.redirect(new URL(`/setup/backups?driveError=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/setup/backups?driveError=No%20code%20came%20back%20from%20Google.', request.url));
  }

  try {
    await connectDriveWithCode(code, redirectUri);
    await logActivity('Setting', 'googleDriveRefreshToken', 'Google Drive connected', '', user.id);
    return NextResponse.redirect(new URL('/setup/backups?driveConnected=1', request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong connecting Google Drive.';
    return NextResponse.redirect(new URL(`/setup/backups?driveError=${encodeURIComponent(message)}`, request.url));
  }
}

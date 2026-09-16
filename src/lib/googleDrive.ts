import 'server-only';
import { db } from '@/lib/db';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// drive.file only — the app can only see/touch files it creates itself,
// never the rest of whoever's Drive it's connected to.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// The refresh token and the backup folder's id both live in Setting rather
// than an env var — getting the refresh token in the first place means a
// human clicking through a Google sign-in from Set Up -> Backups, so it's
// simpler to just save what comes back there than to make someone copy it
// into Vercel and redeploy.
const REFRESH_TOKEN_KEY = 'googleDriveRefreshToken';
const FOLDER_ID_KEY = 'googleDriveFolderId';
const BACKUP_FOLDER_NAME = 'Fender BCS Backups';

function driveAppConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildDriveAuthUrl(redirectUri: string): string {
  const config = driveAppConfig();
  if (!config) throw new Error('Google Drive is not set up yet — add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET first.');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    // Forces Google to hand back a refresh token every time, not just on
    // the very first-ever authorisation for this account.
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchanges the one-time code from the OAuth redirect for a refresh token and saves it. */
export async function connectDriveWithCode(code: string, redirectUri: string): Promise<void> {
  const config = driveAppConfig();
  if (!config) throw new Error('Google Drive is not set up yet — add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET first.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google didn't accept that sign-in (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error("Google didn't hand back a long-lived token — if you've connected this before, remove Fender BCS from myaccount.google.com/permissions first, then try again.");
  }

  await db.setting.upsert({
    where: { key: REFRESH_TOKEN_KEY },
    create: { key: REFRESH_TOKEN_KEY, value: data.refresh_token },
    update: { value: data.refresh_token },
  });
}

export async function isDriveConnected(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: REFRESH_TOKEN_KEY } });
  return !!row?.value;
}

export async function disconnectDrive(): Promise<void> {
  await db.setting.deleteMany({ where: { key: { in: [REFRESH_TOKEN_KEY, FOLDER_ID_KEY] } } });
}

async function getDriveAccessToken(): Promise<string> {
  const config = driveAppConfig();
  if (!config) throw new Error('Google Drive is not set up yet — add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET first.');

  const row = await db.setting.findUnique({ where: { key: REFRESH_TOKEN_KEY } });
  if (!row?.value) throw new Error('Google Drive is not connected — connect it from Set Up → Backups first.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.value,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google Drive's sign-in has expired or was revoked (${res.status}) — reconnect it from Set Up → Backups.`);

  const data = await res.json();
  return data.access_token as string;
}

async function ensureBackupFolder(accessToken: string): Promise<string> {
  const existing = await db.setting.findUnique({ where: { key: FOLDER_ID_KEY } });
  if (existing?.value) return existing.value;

  const res = await fetch(FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error(`Couldn't create the Drive backup folder (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  await db.setting.upsert({
    where: { key: FOLDER_ID_KEY },
    create: { key: FOLDER_ID_KEY, value: data.id },
    update: { value: data.id },
  });
  return data.id as string;
}

async function uploadFileToDrive(accessToken: string, folderId: string, fileName: string, mimeType: string, bytes: Buffer): Promise<string> {
  const boundary = `bcsbackup-${Date.now()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  return data.id as string;
}

/** A ready-to-use access token plus the (possibly just-created) backup folder id. */
export async function prepareDriveUpload(): Promise<{ accessToken: string; folderId: string }> {
  const accessToken = await getDriveAccessToken();
  const folderId = await ensureBackupFolder(accessToken);
  return { accessToken, folderId };
}

export { uploadFileToDrive };

import 'server-only';
import { get } from '@vercel/blob';
import { db } from '@/lib/db';
import { isPrivateBlobUrl } from '@/lib/blob';
import { prepareDriveUpload, uploadFileToDrive } from '@/lib/googleDrive';

/**
 * Every private Blob file the app has ever stored, across every place a
 * file can be attached — mill/test certs, compliance and H&S documents, bar
 * counter photos, "other work" photos. Certificate.fileUrl is excluded: that
 * one is a plain pasted link (often to somewhere else entirely), not
 * something this app uploaded, so isPrivateBlobUrl filters it out along
 * with anything else that isn't actually ours to back up.
 */
async function getPendingUrls(): Promise<string[]> {
  const [certs, docs, hse, barCounts, otherWork, done] = await Promise.all([
    db.testCertificate.findMany({ select: { fileUrl: true } }),
    db.complianceDocument.findMany({ select: { fileUrl: true } }),
    db.hseDocument.findMany({ select: { fileUrl: true } }),
    db.barCount.findMany({ select: { photoUrl: true } }),
    db.otherWorkTask.findMany({ select: { photoUrl: true } }),
    db.blobBackup.findMany({ select: { sourceUrl: true } }),
  ]);

  const all = [
    ...certs.map((c) => c.fileUrl),
    ...docs.map((c) => c.fileUrl),
    ...hse.map((c) => c.fileUrl),
    ...barCounts.map((c) => c.photoUrl),
    ...otherWork.map((c) => c.photoUrl).filter((u): u is string => !!u),
  ].filter(isPrivateBlobUrl);

  const alreadyDone = new Set(done.map((d) => d.sourceUrl));
  return [...new Set(all)].filter((url) => !alreadyDone.has(url));
}

export async function getBackupStats() {
  const [totalBackedUp, lastBackup, pending] = await Promise.all([
    db.blobBackup.count(),
    db.blobBackup.findFirst({ orderBy: { backedUpAt: 'desc' } }),
    getPendingUrls(),
  ]);
  return { totalBackedUp, lastBackupAt: lastBackup?.backedUpAt ?? null, pendingCount: pending.length };
}

/**
 * Copies up to `limit` not-yet-backed-up files out to Drive. Capped rather
 * than doing everything in one go, both to stay well inside a serverless
 * function's time limit and because a big backlog (the very first run, say)
 * is fine catching up over a few nights rather than needing to succeed
 * entirely in one shot.
 */
export async function runBackupSync({ limit = 25 }: { limit?: number } = {}): Promise<{
  uploaded: number;
  failed: number;
  errors: string[];
}> {
  const pending = await getPendingUrls();
  const urls = pending.slice(0, limit);
  if (urls.length === 0) return { uploaded: 0, failed: 0, errors: [] };

  const { accessToken, folderId } = await prepareDriveUpload();

  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const result = await get(url, { access: 'private' });
      if (!result || result.statusCode !== 200) {
        failed++;
        errors.push(`${url}: not found in Blob storage`);
        continue;
      }
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
      const fileName = decodeURIComponent(url.split('/').pop() ?? `file-${Date.now()}`);

      const driveFileId = await uploadFileToDrive(accessToken, folderId, fileName, result.blob.contentType, bytes);
      await db.blobBackup.create({ data: { sourceUrl: url, fileName, driveFileId } });
      uploaded++;
    } catch (err) {
      failed++;
      errors.push(`${url}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return { uploaded, failed, errors };
}

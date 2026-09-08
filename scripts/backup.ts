/**
 * Full data backup, saved straight into iCloud Drive so it's off this one
 * machine automatically. Not a byte-for-byte pg_dump (this Mac doesn't have
 * the Postgres client tools installed) — instead it walks every model
 * Prisma knows about and exports all of it as JSON, gzipped, and also pulls
 * down the actual files behind every Blob-stored photo/document (only a URL
 * lives in the database for those — the file itself is on Vercel Blob).
 *
 *   npm run backup
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { get } from '@vercel/blob';
import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const db = new PrismaClient();

const BACKUP_DIR = path.join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Fender BCS Backups');

// Same check as src/lib/blob.ts's isPrivateBlobUrl — duplicated since this
// script runs standalone via tsx, outside Next's path-alias resolution.
// Skips manually-pasted external links (Google Drive etc.), which aren't ours to fetch.
const isPrivateBlobUrl = (url: string) => url.includes('.private.blob.vercel-storage.com/');

// Every {model, field} pair known to hold a Vercel Blob URL rather than the
// file itself — these are what get downloaded for real, not just referenced.
const BLOB_FIELDS: { model: string; field: string }[] = [
  { model: 'BarCount', field: 'photoUrl' },
  { model: 'OtherWorkTask', field: 'photoUrl' },
  { model: 'TestCertificate', field: 'fileUrl' },
  { model: 'HseDocument', field: 'fileUrl' },
];

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function dirSize(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

async function main() {
  const modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const data: Record<string, unknown[]> = {};
  const counts: [string, number][] = [];

  for (const name of modelNames) {
    const client = name.charAt(0).toLowerCase() + name.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any)[client].findMany();
    data[name] = rows;
    counts.push([name, rows.length]);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'fender-bcs',
    models: data,
  };

  const runDir = path.join(BACKUP_DIR, `fender-bcs-backup-${timestamp()}`);
  fs.mkdirSync(runDir, { recursive: true });

  const gzipped = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.writeFileSync(path.join(runDir, 'data.json.gz'), gzipped);

  let downloaded = 0;
  let skipped = 0;
  for (const { model, field } of BLOB_FIELDS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (data[model] as any[]) ?? []) {
      const url = row[field];
      if (!url || !isPrivateBlobUrl(url)) continue;
      try {
        const result = await get(url, { access: 'private' });
        if (!result || result.statusCode !== 200) { skipped++; continue; }
        const dest = path.join(runDir, 'files', result.blob.pathname);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
        fs.writeFileSync(dest, bytes);
        downloaded++;
      } catch (err) {
        console.error(`  Failed to download ${model}.${field} (${url}):`, err instanceof Error ? err.message : err);
        skipped++;
      }
    }
  }

  console.log(`Backed up ${counts.length} tables, ${counts.reduce((s, [, n]) => s + n, 0)} rows total.`);
  for (const [name, n] of counts) console.log(`  ${name}: ${n}`);
  console.log(`\nDownloaded ${downloaded} file(s) from Blob storage${skipped ? `, ${skipped} skipped/failed` : ''}.`);
  console.log(`\nSaved to ${runDir} (${(dirSize(runDir) / 1024 / 1024).toFixed(2)} MB) — will sync to iCloud automatically.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());

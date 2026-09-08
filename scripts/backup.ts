/**
 * Full data backup, saved straight into iCloud Drive so it's off this one
 * machine automatically. Not a byte-for-byte pg_dump (this Mac doesn't have
 * the Postgres client tools installed) — instead it walks every model
 * Prisma knows about and exports all of it as JSON, gzipped.
 *
 *   npm run backup
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const db = new PrismaClient();

const BACKUP_DIR = path.join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Fender BCS Backups');

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
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

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `fender-bcs-backup-${timestamp()}.json.gz`);
  const gzipped = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.writeFileSync(file, gzipped);

  console.log(`Backed up ${counts.length} tables, ${counts.reduce((s, [, n]) => s + n, 0)} rows total.`);
  for (const [name, n] of counts) console.log(`  ${name}: ${n}`);
  console.log(`\nSaved to ${file} (${(gzipped.length / 1024 / 1024).toFixed(2)} MB) — will sync to iCloud automatically.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());

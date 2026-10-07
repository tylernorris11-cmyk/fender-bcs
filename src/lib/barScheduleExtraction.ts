import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import type { ScheduleReading } from './barSchedule';

/**
 * Reads the bar mark rows off a customer's bar schedule with Claude. A PDF is
 * split into single pages and each page read in parallel, so a long
 * schedule still comes back well inside the server's time limit; a photo is
 * read in one go. Adding duplicates together happens afterwards, in
 * lib/barSchedule.ts, not here.
 */

// Sonnet rather than Opus to keep the cost down: reading a schedule is
// transcription, which it handles as accurately at half the price.
const MODEL = 'claude-sonnet-5-5';
const MAX_PAGES = 40;
const PARALLEL = 8;

const dim = { anyOf: [{ type: 'integer' }, { type: 'null' }] };
const SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mark: { type: 'string' },
          grade: { type: 'string' },
          dia: { type: 'integer' },
          members: { type: 'integer' },
          each: { type: 'integer' },
          total: { type: 'integer' },
          length: { type: 'integer' },
          shape: { type: 'string' },
          a: dim, b: dim, c: dim, d: dim, e: dim, r: dim,
        },
        required: ['mark', 'grade', 'dia', 'members', 'each', 'total', 'length', 'shape', 'a', 'b', 'c', 'd', 'e', 'r'],
        additionalProperties: false,
      },
    },
    unreadable: { type: 'string' },
  },
  required: ['rows', 'unreadable'],
  additionalProperties: false,
};

const PROMPT = `This is a page from a reinforcement bar schedule (a BS 8666 bending schedule) sent to a steel reinforcement supplier.

List every bar mark row on this page, in the order printed, exactly as printed. Don't calculate, correct or combine anything, and don't add up repeated bar marks; that's done afterwards.

For each row:
- mark: the bar mark.
- grade and dia: from the type and size column, e.g. "H12" is grade H, dia 12. If only a size is printed, use grade H.
- members: the number of members (1 if that column is blank or missing).
- each: the number of bars in each member.
- total: the total number of bars as printed (0 if not printed).
- length: the length of each bar in mm.
- shape: the shape code, e.g. "00", "21", "51".
- a, b, c, d: those dimensions in mm, null where blank.
- e and r: the E/R column. Put it in r when it's a bending radius (marked R or under a radius heading), otherwise in e. null where blank.

Leave out column headings, title blocks, weight summaries, notes, revision tables, and anything crossed out or marked as deleted. If a value on a row can't be read, give your best reading and name that bar mark in "unreadable" (otherwise leave it as an empty string). If the page has no bar schedule rows, return an empty list.`;

type PageResult = { page: number; rows: ScheduleReading[]; unreadable: string; error?: string };

async function readPage(client: Anthropic, page: number, source: { media_type: string; data: string }, isPdf: boolean): Promise<PageResult> {
  try {
    const document = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: source.data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: source.media_type as 'image/jpeg' | 'image/png' | 'image/webp', data: source.data } };

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Reading numbers off a table is transcription, not reasoning.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // Should the model decline, the API re-runs the page on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: [document, { type: 'text', text: PROMPT }] }],
    });

    if (response.stop_reason === 'refusal') return { page, rows: [], unreadable: '', error: `page ${page} could not be read` };
    if (response.stop_reason === 'max_tokens') return { page, rows: [], unreadable: '', error: `page ${page} has more rows than can be read in one go` };

    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const parsed = JSON.parse(text) as { rows: Omit<ScheduleReading, 'page'>[]; unreadable: string };
    return { page, rows: parsed.rows.map((r) => ({ ...r, page })), unreadable: parsed.unreadable.trim() };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { page, rows: [], unreadable: '', error: `page ${page}: too many requests at once, try again in a minute` };
    if (err instanceof Anthropic.APIError) return { page, rows: [], unreadable: '', error: `page ${page}: ${err.message}` };
    return { page, rows: [], unreadable: '', error: `page ${page}: ${err instanceof Error ? err.message : 'could not be read'}` };
  }
}

/** Each page of a PDF as its own one-page PDF; the whole file as one "page" if it can't be split (an encrypted PDF, say). */
async function splitPdf(bytes: Uint8Array): Promise<string[]> {
  try {
    const source = await PDFDocument.load(bytes);
    const count = source.getPageCount();
    if (count > MAX_PAGES) throw new Error(`That schedule has ${count} pages; split it into files of ${MAX_PAGES} pages or fewer.`);
    if (count <= 1) return [Buffer.from(bytes).toString('base64')];
    const pages: string[] = [];
    for (let i = 0; i < count; i++) {
      const doc = await PDFDocument.create();
      const [copied] = await doc.copyPages(source, [i]);
      doc.addPage(copied);
      pages.push(Buffer.from(await doc.save()).toString('base64'));
    }
    return pages;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('That schedule has')) throw err;
    return [Buffer.from(bytes).toString('base64')];
  }
}

export async function readBarSchedulePages({ bytes, mimeType }: { bytes: Uint8Array; mimeType: string }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Reading schedules is not set up yet: ANTHROPIC_API_KEY is missing.');
  const client = new Anthropic();
  const isPdf = mimeType === 'application/pdf';
  const sources = isPdf ? await splitPdf(bytes) : [Buffer.from(bytes).toString('base64')];

  const results: PageResult[] = [];
  for (let i = 0; i < sources.length; i += PARALLEL) {
    const batch = sources.slice(i, i + PARALLEL).map((data, j) => readPage(client, i + j + 1, { media_type: mimeType, data }, isPdf));
    results.push(...(await Promise.all(batch)));
  }

  return {
    pages: sources.length,
    readings: results.flatMap((r) => r.rows),
    unreadable: results.filter((r) => r.unreadable).map((r) => `page ${r.page}: ${r.unreadable}`),
    errors: results.filter((r) => r.error).map((r) => r.error!),
  };
}

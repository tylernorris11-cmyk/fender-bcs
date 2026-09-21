import 'server-only';
import { db } from '@/lib/db';
import {
  OUTREACH_DISCOVERY_BATCH_SIZE, OUTREACH_REQUIRE_APPROVAL, OUTREACH_SENDER, OUTREACH_SIC_CODES,
} from './config';
import { isPecrEligible, searchCompaniesBySic } from './companiesHouse';
import { findContactEmail, guessWebsite } from './contactFinder';
import { draftOutreachEmail } from './draft';
import { isSuppressed } from './mail';

export type DiscoveryResult = {
  found: number;
  newLeads: number;
  skippedIneligible: number;
  contactsFound: number;
  drafted: number;
  errors: string[];
};

const CONCURRENCY = 4;

/** Runs `fn` over `items` a few at a time, stopping early once `deadline` has passed. */
async function inChunks<T>(items: T[], deadline: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    if (Date.now() > deadline) return;
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

/**
 * One discovery run: pulls a fresh page of companies from Companies House
 * under each configured SIC code, saves any not seen before, then works
 * through leads that don't have a contact or a draft yet. Safe to run
 * repeatedly — everything is keyed off the Companies House number or existing
 * status, so nothing is looked up or drafted twice — and safe to cut short:
 * `deadline` (a timestamp) stops it before the serverless function's time
 * limit, and whatever's left is picked up the next day.
 */
export async function runDiscovery({ deadline }: { deadline: number }): Promise<DiscoveryResult> {
  const result: DiscoveryResult = { found: 0, newLeads: 0, skippedIneligible: 0, contactsFound: 0, drafted: 0, errors: [] };

  // 1. Pull the next page of companies from Companies House, per SIC code.
  // Each run continues from where the last one stopped (kept in Setting) —
  // always asking for the first page would return the same companies every
  // day, all already saved, and the pipeline would dry up after day one.
  for (const sicCode of OUTREACH_SIC_CODES) {
    if (Date.now() > deadline) break;
    const offsetKey = `outreachOffset:${sicCode}`;
    try {
      const stored = await db.setting.findUnique({ where: { key: offsetKey } });
      const start = stored ? Number(stored.value) || 0 : 0;
      const hits = await searchCompaniesBySic({ sicCode, startIndex: start, size: OUTREACH_DISCOVERY_BATCH_SIZE });
      result.found += hits.length;

      for (const hit of hits) {
        if (!isPecrEligible(hit.companyType)) {
          result.skippedIneligible += 1;
          continue;
        }
        const existing = await db.lead.findUnique({ where: { companyNumber: hit.companyNumber } });
        if (existing) continue;
        await db.lead.create({
          data: {
            companyName: hit.companyName,
            companyNumber: hit.companyNumber,
            companyType: hit.companyType,
            sicCodes: hit.sicCodes,
            registeredAddress: hit.registeredAddress,
            postcode: hit.postcode,
            status: 'NEW',
          },
        });
        result.newLeads += 1;
      }

      // A short page means the end of this SIC code's list — start over next time.
      const next = hits.length < OUTREACH_DISCOVERY_BATCH_SIZE ? 0 : start + OUTREACH_DISCOVERY_BATCH_SIZE;
      await db.setting.upsert({ where: { key: offsetKey }, create: { key: offsetKey, value: String(next) }, update: { value: String(next) } });
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : `Companies House lookup failed for SIC ${sicCode}`);
    }
  }

  // 2. Find a contact for anything still NEW.
  const needsContact = await db.lead.findMany({ where: { status: 'NEW' }, orderBy: { createdAt: 'asc' }, take: 24 });
  await inChunks(needsContact, deadline, async (lead) => {
    try {
      const website = await guessWebsite(lead.companyName);
      const email = website ? await findContactEmail(website) : null;
      if (email && !(await isSuppressed(email))) {
        await db.lead.update({ where: { id: lead.id }, data: { website: website ?? '', contactEmail: email, status: 'CONTACT_FOUND' } });
        result.contactsFound += 1;
      } else {
        await db.lead.update({ where: { id: lead.id }, data: { website: website ?? '', status: 'NO_CONTACT_FOUND' } });
      }
    } catch (err) {
      result.errors.push(`Contact lookup failed for ${lead.companyName}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  });

  // 3. Draft an email for anything with a contact but no draft yet.
  // With OUTREACH_REQUIRE_APPROVAL=false the draft skips the review queue and
  // goes straight to the send list — off by default on purpose.
  const needsDraft = await db.lead.findMany({ where: { status: 'CONTACT_FOUND' }, orderBy: { createdAt: 'asc' }, take: 24 });
  await inChunks(needsDraft, deadline, async (lead) => {
    try {
      const draft = await draftOutreachEmail({ companyName: lead.companyName, sicCodes: lead.sicCodes });
      if ('error' in draft) {
        result.errors.push(`Draft failed for ${lead.companyName}: ${draft.error}`);
        return;
      }
      const autoApprove = !OUTREACH_REQUIRE_APPROVAL;
      await db.outreachEmail.create({
        data: {
          leadId: lead.id,
          senderLabel: OUTREACH_SENDER.label,
          fromEmail: OUTREACH_SENDER.fromEmail,
          subject: draft.subject,
          bodyText: draft.body,
          status: autoApprove ? 'APPROVED' : 'DRAFT',
          approvedAt: autoApprove ? new Date() : null,
        },
      });
      await db.lead.update({ where: { id: lead.id }, data: { status: autoApprove ? 'APPROVED' : 'DRAFTED' } });
      result.drafted += 1;
    } catch (err) {
      result.errors.push(`Draft failed for ${lead.companyName}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  });

  return result;
}

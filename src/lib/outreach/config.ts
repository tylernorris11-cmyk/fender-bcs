import 'server-only';

/**
 * Everything about *who this is going out as* lives here, in one place, so
 * switching the module from testing on BCS Products / BS Supplies over to
 * Fender Steel later is a config change, not a rewrite. See
 * docs/OUTREACH_SETUP.md for the full setup (the Microsoft 365 mailbox, DNS, Companies House).
 */
export const OUTREACH_SENDER = {
  // Shown as the display name on every email and in the footer — the two
  // trading names together, since prospects may know the business by either.
  // (The display name people see in their inbox is the mailbox's own, set in
  // Microsoft 365 — keep the two the same.)
  label: 'BCS Products / BS Supplies',
  // The dedicated Microsoft 365 mailbox everything is sent from, and where
  // replies land. See docs/OUTREACH_SETUP.md — a separate domain from the
  // company's main ones, on purpose.
  fromEmail: process.env.OUTREACH_MAILBOX || '',
  // Required on every commercial email under PECR/UK GDPR. Sends are refused
  // while either is blank (see mail.ts), so they can't go out without them.
  registeredAddress: process.env.OUTREACH_REGISTERED_ADDRESS || '',
  companyNumber: process.env.OUTREACH_COMPANY_NUMBER || '',
} as const;

/** Who gets a heads-up email for every reply (they're also in the mailbox itself). */
export const OUTREACH_FORWARD_TO = process.env.OUTREACH_FORWARD_TO_EMAIL || 'tyler@fendersteel.co.uk';

/**
 * SIC codes for concrete fence post / gravel board manufacturers, and the
 * wholesalers/merchants who buy from BCS. Add more as leads come in from
 * outside these — see docs/OUTREACH_SETUP.md.
 */
export const OUTREACH_SIC_CODES = [
  '23610', // Manufacture of concrete products for construction purposes
  '23690', // Manufacture of other articles of concrete, plaster and cement
  '46739', // Other wholesale of construction materials
] as const;

/**
 * PECR allows unsolicited B2B email to limited companies, PLCs and LLPs, but
 * treats a sole trader or ordinary partnership as an individual — those need
 * opt-in consent this agent never collects, so they're filtered out before a
 * lead is ever drafted, not just before sending.
 */
export const OUTREACH_ALLOWED_COMPANY_TYPES = new Set([
  'ltd', 'plc', 'llp', 'private-limited-guarant-nsc', 'private-limited-guarant-nsc-limited-exemption',
  'private-unlimited', 'private-unlimited-nsc',
]);

/** How many new emails go out per day — start low and raise once you trust the copy and the domain's reputation. */
export const OUTREACH_DAILY_SEND_CAP = Number(process.env.OUTREACH_DAILY_SEND_CAP || 10);

/** How many companies to pull from Companies House per discovery run. */
export const OUTREACH_DISCOVERY_BATCH_SIZE = Number(process.env.OUTREACH_DISCOVERY_BATCH_SIZE || 20);

/** true = every draft needs a person's approval before it sends (recommended while the copy is still being trusted). */
export const OUTREACH_REQUIRE_APPROVAL = process.env.OUTREACH_REQUIRE_APPROVAL !== 'false';

/**
 * Environment variables the agent can't work without, and what each is for —
 * the review queue shows anything missing here as a banner, so a half-finished
 * setup is obvious instead of failing quietly at 6am. See docs/OUTREACH_SETUP.md.
 */
const REQUIRED_ENV: [string, string][] = [
  ['COMPANIES_HOUSE_API_KEY', 'finding companies'],
  ['ANTHROPIC_API_KEY', 'drafting the emails'],
  ['OUTREACH_M365_TENANT_ID', 'signing in to Microsoft 365'],
  ['OUTREACH_M365_CLIENT_ID', 'signing in to Microsoft 365'],
  ['OUTREACH_M365_CLIENT_SECRET', 'signing in to Microsoft 365'],
  ['OUTREACH_MAILBOX', 'the mailbox emails are sent from and replies arrive in'],
  ['OUTREACH_REGISTERED_ADDRESS', "the legally required address in every email's footer"],
  ['OUTREACH_COMPANY_NUMBER', "the legally required company number in every email's footer"],
  ['CRON_SECRET', 'the daily jobs'],
];

export function outreachSetupProblems(): { name: string; purpose: string }[] {
  return REQUIRED_ENV.filter(([name]) => !process.env[name]).map(([name, purpose]) => ({ name, purpose }));
}

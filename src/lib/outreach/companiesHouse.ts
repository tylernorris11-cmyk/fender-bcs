import 'server-only';
import { OUTREACH_ALLOWED_COMPANY_TYPES } from './config';

/**
 * Thin wrapper over the Companies House public API — same house style as
 * lib/email.ts and lib/barCountAI.ts: no SDK, just fetch. Free API key from
 * https://developer.company-information.service.gov.uk (see
 * docs/OUTREACH_SETUP.md). Uses HTTP basic auth with the key as the
 * username and no password, per their docs.
 */
const BASE = 'https://api.company-information.service.gov.uk';

export type CompaniesHouseHit = {
  companyNumber: string;
  companyName: string;
  companyType: string;
  companyStatus: string;
  sicCodes: string[];
  registeredAddress: string;
  postcode: string;
};

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error('COMPANIES_HOUSE_API_KEY is not set.');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

/**
 * Searches active companies under a single SIC code, paginated. Companies
 * House's advanced search takes one SIC code per call, so callers loop over
 * OUTREACH_SIC_CODES and merge/dedupe by company number themselves.
 */
export async function searchCompaniesBySic({
  sicCode, startIndex = 0, size = 20,
}: { sicCode: string; startIndex?: number; size?: number }): Promise<CompaniesHouseHit[]> {
  const params = new URLSearchParams({
    sic_codes: sicCode,
    company_status: 'active',
    size: String(size),
    start_index: String(startIndex),
  });
  const res = await fetch(`${BASE}/advanced-search/companies?${params.toString()}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Companies House returned ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const items: any[] = data.items ?? [];
  return items.map((item) => ({
    companyNumber: item.company_number,
    companyName: item.company_name,
    companyType: item.company_type ?? '',
    companyStatus: item.company_status ?? '',
    sicCodes: item.sic_codes ?? [],
    registeredAddress: [
      item.registered_office_address?.address_line_1,
      item.registered_office_address?.address_line_2,
      item.registered_office_address?.locality,
    ].filter(Boolean).join(', '),
    postcode: item.registered_office_address?.postal_code ?? '',
  }));
}

/** PECR gate: only these company types are ever eligible to be emailed unsolicited. */
export function isPecrEligible(companyType: string): boolean {
  return OUTREACH_ALLOWED_COMPANY_TYPES.has(companyType);
}

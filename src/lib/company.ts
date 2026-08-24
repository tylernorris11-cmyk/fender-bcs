import 'server-only';
import { cookies } from 'next/headers';
import type { Company } from '@prisma/client';

export const COMPANY_COOKIE = 'fs_company';

export const COMPANY_LABEL: Record<Company, string> = {
  FENDER: 'Fender Steel',
  BS_SUPPLIES: 'BCS Products',
};

export const COMPANY_TAGLINE: Record<Company, string> = {
  FENDER: 'Reinforcing steel specialists',
  BS_SUPPLIES: 'Steel & building supplies · Scunthorpe',
};

type Companied = { companies: Company[] };

/**
 * Which company's data the signed-in user is currently looking at. Always
 * clamped against `user.companies` — a forged or stale cookie can never grant
 * a company someone hasn't actually been given access to.
 */
export function getActiveCompany(user: Companied): Company {
  const requested = cookies().get(COMPANY_COOKIE)?.value as Company | undefined;
  if (requested && user.companies.includes(requested)) return requested;
  return user.companies[0] ?? 'FENDER';
}

export function canAccessCompany(user: Companied, company: Company): boolean {
  return user.companies.includes(company);
}

/**
 * Use inside server actions right after fetching a company-scoped record, so
 * someone can't mutate another company's data by posting a known id directly
 * — the page-level guard alone isn't enough since actions are their own
 * entry point.
 */
export function assertCompanyAccess(user: Companied, company: Company) {
  if (!canAccessCompany(user, company)) {
    throw new Error('You do not have permission to do that.');
  }
}

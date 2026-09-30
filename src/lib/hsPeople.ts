import 'server-only';
import type { Company } from '@prisma/client';
import { db } from './db';

/** Everyone who can be given an action or an investigation on this company's side. Shared screens aren't people. */
export function hsPeople(company: Company) {
  return db.user.findMany({
    where: { active: true, staysSignedIn: false, companies: { has: company } },
    select: { id: true, name: true, colour: true },
    orderBy: { name: 'asc' },
  });
}

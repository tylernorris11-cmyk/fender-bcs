import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

console.log('=== Price rows ===');
const prices = await db.price.findMany({ include: { product: { select: { name: true, code: true, company: true } } }, orderBy: { effectiveFrom: 'desc' } });
console.log('total price rows:', prices.length);
for (const p of prices) console.log(p.product.company, p.product.name, p.product.code, '£' + p.unitPrice, 'minQty:', p.minQty.toString(), 'setBy:', p.setByName, p.effectiveFrom.toISOString().slice(0,10));

console.log('\n=== Driver rows ===');
const drivers = await db.driver.findMany({ include: { user: { select: { email: true } } } });
console.log('total driver rows:', drivers.length);
for (const d of drivers) console.log(d.id, d.name, '| phone:', d.phone, '| depot:', d.depot, '| active:', d.active, '| linked user:', d.user?.email ?? 'none');

await db.$disconnect();

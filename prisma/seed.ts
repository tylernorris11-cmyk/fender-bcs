/**
 * Seed data. Mirrors the screenshots so the system is usable the moment it
 * boots. Safe to re-run: it clears the tables it owns first.
 *
 *   npm run db:seed
 *
 * Every account gets the password in SEED_PASSWORD (default ChangeMe123!).
 * Change them from Set Up → Users & roles before anyone real uses this.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const db = new PrismaClient();

// Same defaults as src/lib/checks.ts — duplicated here since this script
// runs standalone via tsx, outside the Next.js path-alias setup.
const VEHICLE_CHECK_ITEMS = [
  'Tyres — condition and pressure', 'Lights, indicators and beacon', 'Mirrors and windscreen', 'Brakes',
  'Fluid levels (oil, water, screenwash)', 'Load securing equipment (straps, chains, headboard)', 'Wheel nuts',
  'Reversing alarm / camera', 'No visible damage, leaks or corrosion', 'Documents in cab (licence, insurance, tacho)',
];
const MACHINE_CHECK_ITEMS = [
  'Guards in place and secure', 'Emergency stop tested', 'No visible damage to blades, dies or rollers',
  'Hydraulic and air lines — no leaks', 'Work area clear and clean', 'Lifting equipment inspected (if fitted)',
  'Noise and vibration normal on start-up',
];
// Matches the site's own FLT Check and Defect Report pad.
const FORKLIFT_CHECK_ITEMS = [
  'Rating plate visible', 'Safety frame / body / cab', 'Emergency stop / foot and park brakes',
  'Forks / load guard / overhead guard', 'Oil level / transmission and brake fluid',
  'Lamps / brake lights / indicators / beacon', 'Windscreen wipers / washers and mirrors',
  'Seat and restraints / seat pressure switch', 'Tyres / pressure / axles / wheel nuts',
  'Mast / chains / pivot pins / hydraulic lines', 'Hydraulic controls and lift', 'Steering / gauges / instruments',
  'Horn and audible warning', 'Battery level / electrical lines', 'Fork attachments and locking pins',
  'Fuel level / fuel tank and restraints', 'Coolant and water level',
];

function hash(plain: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(plain, salt, 64).toString('hex')}`;
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string, time: string) => new Date(`${iso}T${time}:00.000Z`);
const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';

  // Order matters — children before parents.
  await db.bugReport.deleteMany();
  await db.note.deleteMany();
  await db.assetCheckItem.deleteMany();
  await db.assetCheck.deleteMany();
  await db.purchaseOrderLine.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.costCentre.deleteMany();
  await db.qcCheck.deleteMany();
  await db.productionEvent.deleteMany();
  await db.checklistItem.deleteMany();
  await db.barMark.deleteMany();
  await db.orderLine.deleteMany();
  await db.planningEvent.deleteMany();
  await db.ncr.deleteMany();
  await db.order.deleteMany();
  await db.stockMovement.deleteMany();
  await db.batch.deleteMany();
  await db.certificate.deleteMany();
  await db.supplier.deleteMany();
  await db.price.deleteMany();
  await db.purchaseCost.deleteMany();
  await db.product.deleteMany();
  await db.customerDocument.deleteMany();
  await db.customer.deleteMany();
  await db.inspection.deleteMany();
  await db.assetNote.deleteMany();
  await db.assetChecklistItem.deleteMany();
  await db.asset.deleteMany();
  await db.auditAction.deleteMany();
  await db.quarterlyReturn.deleteMany();
  await db.checklistTemplate.deleteMany();
  await db.activityLog.deleteMany();
  await db.town.deleteMany();
  await db.location.deleteMany();
  await db.driver.deleteMany();
  await db.user.deleteMany();

  // ------------------------------------------------------------- people
  const people = [
    { email: 'john.davies@fendersteel.co.uk', name: 'John Davies', jobTitle: 'CEO', role: 'MASTER_ADMIN', colour: '#C0392B' },
    { email: 'tyler@fendersteel.co.uk', name: 'Tyler Norris', jobTitle: '', role: 'MASTER_ADMIN', colour: '#2C3E50' },
    { email: 'claire.bennett@fendersteel.co.uk', name: 'Claire Bennett', jobTitle: 'Quality manager', role: 'QUALITY', colour: '#0D4A42' },
    { email: 'martin.miller@fendersteel.co.uk', name: 'Martin Miller', jobTitle: 'Yard manager', role: 'MANAGER', colour: '#6C3FC5' },
    { email: 'james.ward@fendersteel.co.uk', name: 'James Ward', jobTitle: 'Sales', role: 'SALES', colour: '#16A085' },
    { email: 'rachel.proctor@fendersteel.co.uk', name: 'Rachel Proctor', jobTitle: 'Sales', role: 'SALES', colour: '#B03A6E' },
    { email: 'dave.wilson@fendersteel.co.uk', name: 'Dave Wilson', jobTitle: 'HGV driver', role: 'DRIVER', colour: '#2563EB' },
    { email: 'auditor@fendersteel.co.uk', name: 'Audit Viewer', jobTitle: 'Read-only account', role: 'VIEWER', colour: '#6B7280' },
  ] as const;

  const users: Record<string, string> = {};
  for (const p of people) {
    const u = await db.user.create({
      data: { ...p, passwordHash: hash(password), initials: initials(p.name), mustReset: true },
    });
    users[p.name] = u.id;
  }

  // John Davies and Tyler Norris are both Master Administrators and run both
  // businesses — everyone else defaults to Fender only.
  await db.user.update({ where: { id: users['John Davies'] }, data: { companies: ['FENDER', 'BS_SUPPLIES'] } });
  await db.user.update({ where: { id: users['Tyler Norris'] }, data: { companies: ['FENDER', 'BS_SUPPLIES'] } });

  // -------------------------------------------------------------- towns
  const towns = [
    ['Scunthorpe', 'Lincolnshire'], ['Sunderland', 'Tyne & Wear'], ['Leeds', 'West Yorkshire'],
    ['Hull', 'East Yorkshire'], ['Bradford', 'West Yorkshire'], ['Sheffield', 'South Yorkshire'],
    ['Wakefield', 'West Yorkshire'], ['Harrogate', 'North Yorkshire'], ['Doncaster', 'South Yorkshire'],
  ];
  await db.town.createMany({ data: towns.map(([name, region]) => ({ name, region })) });

  // Our own two branches — shared by both companies, since it's the same
  // yard and the same lorries either way.
  await db.location.createMany({ data: [{ name: 'Scunthorpe' }, { name: 'Houghton le Spring' }] });

  await db.driver.createMany({
    data: [
      { name: 'Dave Wilson', phone: '07700 900112', licence: 'WILSO905123DW9AB', depot: 'Scunthorpe', cpcExpiry: d('2027-03-14') },
      { name: 'Ken Foster', phone: '07700 900318', licence: 'FOSTE802441KF7CD', depot: 'Houghton le Spring', cpcExpiry: d('2026-11-02') },
    ],
  });

  // ---------------------------------------------------------- customers
  const customerData = [
    ['CUST-0001', 'Northside Civils Ltd', 'Paul Hartley', '0113 245 6789', 'accounts@northsidecivils.co.uk', 'Elland Road Depot, Leeds LS11 0ES', 'Leeds', 'LS11 0ES', 250000, 'Martin Miller', '2025-07-06'],
    ['CUST-0002', 'Humber Groundworks', 'Susan Cole', '01482 552 610', 'susan@humbergroundworks.co.uk', 'Priory Park East, Hull HU4 7DY', 'Hull', 'HU4 7DY', 120000, 'James Ward', '2024-02-19'],
    ['CUST-0003', 'Riverside Construction', 'Chris Hargreaves', '01274 733 218', 'chris@riverside-construction.co.uk', 'Canal Road, Bradford BD1 4SJ', 'Bradford', 'BD1 4SJ', 75000, 'Rachel Proctor', '2023-09-11'],
    ['CUST-0004', 'Trent Concrete Frames', 'Amir Shah', '01724 863 114', 'amir@trentconcreteframes.co.uk', 'Foxhills Industrial Estate, Scunthorpe DN15 8QF', 'Scunthorpe', 'DN15 8QF', 180000, 'Martin Miller', '2022-04-28'],
    ['CUST-0005', 'Wearside Piling Ltd', 'Gary Thompson', '0191 512 8890', 'gary@wearsidepiling.co.uk', 'Pallion Industrial Estate, Sunderland SR4 6ST', 'Sunderland', 'SR4 6ST', 90000, 'James Ward', '2024-11-05'],
    ['CUST-0006', 'Yorkshire Concrete Ltd', 'Diane Fox', '01924 331 007', 'diane@yorkshireconcrete.co.uk', 'Calder Vale Road, Wakefield WF1 5PE', 'Wakefield', 'WF1 5PE', 100000, 'Rachel Proctor', '2023-01-30'],
    ['CUST-0007', 'Pennine Housing Developments', 'Rob Ellis', '01423 508 226', 'rob@penninehousing.co.uk', 'Hookstone Park, Harrogate HG2 7DB', 'Harrogate', 'HG2 7DB', 60000, 'James Ward', '2025-03-17'],
    ['CUST-0008', 'Steel City Formwork', 'Janet Mills', '0114 276 4432', 'janet@steelcityformwork.co.uk', 'Attercliffe Road, Sheffield S9 3QS', 'Sheffield', 'S9 3QS', 140000, 'Martin Miller', '2024-06-24'],
  ] as const;

  const customers: Record<string, string> = {};
  for (const [code, name, contactName, phone, email, address, town, postcode, creditLimit, manager, since] of customerData) {
    const c = await db.customer.create({
      data: {
        code, name, contactName, phone, email, address, town, postcode,
        creditLimit, accountManagerId: users[manager], customerSince: d(since),
      },
    });
    customers[name] = c.id;
  }

  // BS Supplies' own book — separate customers, invisible to Fender-only accounts.
  const bsCustomerData = [
    ['BSS-0001', 'Wearmouth Builders Merchants', 'Alan Reid', '0191 567 2210', 'alan@wearmouthbm.co.uk', 'Riverside Trading Estate, Sunderland SR5 2TQ', 'Sunderland', 'SR5 2TQ', 40000, '2025-02-10'],
    ['BSS-0002', 'Doncaster Timber & Building Supplies', 'Michelle Young', '01302 556 214', 'michelle@doncastertimber.co.uk', 'Wheatley Hall Road, Doncaster DN2 4NB', 'Doncaster', 'DN2 4NB', 25000, '2025-09-01'],
  ] as const;

  for (const [code, name, contactName, phone, email, address, town, postcode, creditLimit, since] of bsCustomerData) {
    const c = await db.customer.create({
      data: {
        company: 'BS_SUPPLIES', code, name, contactName, phone, email, address, town, postcode,
        creditLimit, accountManagerId: users['John Davies'], customerSince: d(since),
      },
    });
    customers[name] = c.id;
  }

  // ----------------------------------------------------------- products
  const productData: [string, string, string, string, number, string, number, boolean, number][] = [
    // code, name, category, unit, kgPerUnit, standard, price, isRebar, reorderAt
    ['RB10-500B', 'Rebar 10mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 832, true, 8],
    ['RB12-500B', 'Rebar 12mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 828, true, 8],
    ['RB16-500B', 'Rebar 16mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 822, true, 8],
    ['RB20-500B', 'Rebar 20mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 818, true, 5],
    ['RB25-500B', 'Rebar 25mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 815, true, 4],
    ['RB32-500B', 'Rebar 32mm B500B', 'Reinforcing bar', 't', 1000, 'BS 4449:2005 B500B', 824, true, 3],
    ['MESH-A142', 'Mesh fabric A142', 'Mesh fabric', 'sheets', 24.8, 'BS 4483', 20.4, false, 40],
    ['MESH-A193', 'Mesh fabric A193', 'Mesh fabric', 'sheets', 33.9, 'BS 4483', 27.1, false, 40],
    ['MESH-A252', 'Mesh fabric A252', 'Mesh fabric', 'sheets', 44.3, 'BS 4483', 35.2, false, 30],
    ['MESH-B785', 'Mesh fabric B785', 'Mesh fabric', 'sheets', 71.0, 'BS 4483', 56.8, false, 20],
    ['CB-SERVICE', 'Cut & bent to schedule (BS 8666)', 'Cut & bent', 't', 1000, 'BS 8666:2020', 940, false, 0],
    ['DWL-20-600', 'Clean cropped dowels 20mm x 600mm', 'Dowels', 'each', 1.48, '', 2.35, false, 200],
    ['DWL-25-600', 'Clean cropped dowels 25mm x 600mm', 'Dowels', 'each', 2.31, '', 3.4, false, 150],
    ['SP-CIRC-40', 'Circular spacers 40mm', 'Spacers & accessories', 'each', 0.02, '', 0.09, false, 2000],
    ['SP-CHAIR-100', 'Continuous high chair 100mm x 2m', 'Spacers & accessories', 'each', 1.1, '', 4.2, false, 300],
    ['TW-16G', 'Tying wire 16g coils', 'Spacers & accessories', 'each', 2.5, '', 6.9, false, 100],
    ['FW-CHAMFER', 'Chamfer edge profile 25mm x 3m', 'Formwork accessories', 'each', 0.6, '', 3.1, false, 200],
    ['FW-TIEBAR', 'Tie bar system 15mm x 1.2m', 'Formwork accessories', 'each', 1.9, '', 4.85, false, 250],
    ['WP-DPM-1200', 'Damp proof membrane 1200g 4m x 25m', 'Waterproofing', 'each', 12, '', 68.0, false, 30],
    ['GR-SUPAFLOW', 'Supa Flow grout 25kg bag', 'Chemicals & grouts', 'each', 25, '', 17.4, false, 60],
    ['CH-CURE', 'Concrete curing compound 25L', 'Chemicals & grouts', 'each', 25, '', 62.0, false, 40],
  ];

  const products: Record<string, string> = {};
  for (const [code, name, category, unit, kgPerUnit, standard, price, isRebar, reorderAt] of productData) {
    const p = await db.product.create({
      data: { code, name, category, unit, kgPerUnit, standard, isRebar, reorderAt },
    });
    products[code] = p.id;
    await db.price.create({
      data: { productId: p.id, unitPrice: price, minQty: 0, effectiveFrom: d('2026-07-26'), setByName: 'John Davies' },
    });
  }

  // BS Supplies' own catalogue — general building materials, not reinforcement.
  const bsProductData: [string, string, string, string, number, number, number][] = [
    // code, name, category, unit, kgPerUnit, price, reorderAt
    ['BSS-TIMBER-4X2', 'Timber studwork 4x2 (47x100mm) 4.8m', 'Timber', 'each', 9, 8.5, 500],
    ['BSS-PLY-18MM', 'WBP plywood 18mm 2440x1220', 'Sheet materials', 'each', 28, 42.0, 50],
    ['BSS-CEMENT-25KG', 'General purpose cement 25kg bag', 'Cement & aggregates', 'each', 25, 6.2, 200],
  ];
  for (const [code, name, category, unit, kgPerUnit, price, reorderAt] of bsProductData) {
    const p = await db.product.create({
      data: { company: 'BS_SUPPLIES', code, name, category, unit, kgPerUnit, reorderAt },
    });
    products[code] = p.id;
    await db.price.create({
      data: { productId: p.id, unitPrice: price, minQty: 0, effectiveFrom: d('2026-07-26'), setByName: 'John Davies' },
    });
  }

  // Purchase costs — admin-only, never shown next to selling prices.
  await db.purchaseCost.createMany({
    data: [
      { productId: products['RB12-500B'], unitCost: 690 },
      { productId: products['RB16-500B'], unitCost: 684 },
      { productId: products['MESH-A142'], unitCost: 15.1 },
    ],
  });

  // ---------------------------------------------------------- suppliers
  const suppliers: Record<string, string> = {};
  for (const [name, approvedFor] of [
    ['British Steel (Scunthorpe)', 'BS 4449:2005 B500B bar, 8–40 mm'],
    ['Celsa Steel UK', 'BS 4449:2005 B500B bar and coil'],
    ['ROM Ltd', 'Stockholding and distribution'],
  ]) {
    const s = await db.supplier.create({ data: { name, approvedFor } });
    suppliers[name] = s.id;
  }

  {
    const s = await db.supplier.create({
      data: { company: 'BS_SUPPLIES', name: 'Northern Building Materials Ltd', approvedFor: 'General building materials — timber, sheet goods, cement' },
    });
    suppliers[s.name] = s.id;
  }

  // BCS Products' own cost centres — not a Fender concept.
  const costCentres: Record<string, string> = {};
  for (const name of ['General', 'BS Supplies']) {
    const c = await db.costCentre.create({ data: { company: 'BS_SUPPLIES', name } });
    costCentres[name] = c.id;
  }

  // ---------------------------------------------------- purchase orders
  const poSeeds: {
    number: string; supplier: string; status: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'RECEIVED'; expected: string;
    raisedBy: string; sentAt?: string; confirmedAt?: string; receivedAt?: string; costCentre?: string;
    lines: { code: string; desc: string; qty: number; unitCost: number }[];
  }[] = [
    {
      number: 'PO-26-0001', supplier: 'ROM Ltd', status: 'DRAFT', expected: '2026-09-01',
      raisedBy: 'Martin Miller', lines: [{ code: 'RB20-500B', desc: 'Rebar 20mm B500B', qty: 20, unitCost: 705 }],
    },
    {
      number: 'PO-26-0002', supplier: 'British Steel (Scunthorpe)', status: 'SENT', expected: '2026-08-29',
      raisedBy: 'Martin Miller', sentAt: '2026-08-20', lines: [
        { code: 'RB12-500B', desc: 'Rebar 12mm B500B', qty: 30, unitCost: 690 },
        { code: 'RB25-500B', desc: 'Rebar 25mm B500B', qty: 15, unitCost: 715 },
      ],
    },
    {
      number: 'PO-26-0003', supplier: 'Celsa Steel UK', status: 'RECEIVED', expected: '2026-08-01',
      raisedBy: 'John Davies', sentAt: '2026-07-24', confirmedAt: '2026-07-25', receivedAt: '2026-08-01',
      lines: [{ code: 'RB16-500B', desc: 'Rebar 16mm B500B', qty: 26, unitCost: 684 }],
    },
    {
      number: 'PO-BSS-0001', supplier: 'Northern Building Materials Ltd', status: 'SENT', expected: '2026-08-28',
      raisedBy: 'John Davies', sentAt: '2026-08-21', costCentre: 'BS Supplies', lines: [
        { code: 'BSS-TIMBER-4X2', desc: 'Timber studwork 4x2 (47x100mm) 4.8m', qty: 200, unitCost: 6.8 },
        { code: 'BSS-PLY-18MM', desc: 'WBP plywood 18mm 2440x1220', qty: 40, unitCost: 32.0 },
      ],
    },
  ];

  for (const po of poSeeds) {
    const supplier = await db.supplier.findUniqueOrThrow({ where: { id: suppliers[po.supplier] } });
    await db.purchaseOrder.create({
      data: {
        number: po.number,
        company: supplier.company,
        supplierId: suppliers[po.supplier],
        status: po.status,
        expectedDate: d(po.expected),
        raisedById: users[po.raisedBy],
        costCentreId: po.costCentre ? costCentres[po.costCentre] : null,
        sentAt: po.sentAt ? d(po.sentAt) : null,
        confirmedAt: po.confirmedAt ? d(po.confirmedAt) : null,
        receivedAt: po.receivedAt ? d(po.receivedAt) : null,
        createdAt: d(po.sentAt ?? po.expected),
        lines: {
          create: po.lines.map((l, i) => ({
            productId: products[l.code],
            description: l.desc,
            qty: l.qty,
            unit: 't',
            unitCost: l.unitCost,
            lineTotal: +(l.qty * l.unitCost).toFixed(2),
            sortOrder: i,
          })),
        },
      },
    });
  }

  // ------------------------------------------------------- certificates
  await db.certificate.createMany({
    data: [
      { scheme: 'CARES SRC', title: 'CARES approval — SRC Appendix 02, processing and supply of bar', reference: 'SRC-1981-02', holder: 'Fender Steel', issuedOn: d('2024-05-01'), expiresOn: d('2027-04-30'), fileUrl: '' },
      { scheme: 'ISO 9001', title: 'ISO 9001:2015 quality management', reference: 'QMS-88214', holder: 'Fender Steel', issuedOn: d('2024-09-12'), expiresOn: d('2027-09-11') },
      { scheme: 'ISO 14001', title: 'ISO 14001:2015 environmental management', reference: 'EMS-88215', holder: 'Fender Steel', issuedOn: d('2024-09-12'), expiresOn: d('2027-09-11') },
      { scheme: 'ISO 45001', title: 'ISO 45001:2018 health & safety management', reference: 'OHS-88216', holder: 'Fender Steel', issuedOn: d('2023-11-20'), expiresOn: d('2026-11-19') },
      { scheme: 'Insurance', title: 'Employers liability insurance', reference: 'EL-2026-4471', holder: 'Fender Steel', issuedOn: d('2026-01-01'), expiresOn: d('2026-12-31') },
      { scheme: 'Supplier', title: 'CARES approval — British Steel', reference: 'CARES-BS-1102', holder: 'British Steel (Scunthorpe)', supplierId: suppliers['British Steel (Scunthorpe)'], issuedOn: d('2023-11-04'), expiresOn: d('2026-11-03') },
      { scheme: 'Supplier', title: 'CARES approval — Celsa Steel UK', reference: 'CARES-CE-0884', holder: 'Celsa Steel UK', supplierId: suppliers['Celsa Steel UK'], issuedOn: d('2024-06-07'), expiresOn: d('2027-06-06') },
      // ROM Ltd deliberately has none — it is the finding the Suppliers screen catches.
    ],
  });

  await db.certificate.create({
    data: {
      company: 'BS_SUPPLIES', scheme: 'ISO 9001', title: 'ISO 9001:2015 quality management',
      reference: 'QMS-BSS-0142', holder: 'BCS Products', issuedOn: d('2025-03-01'), expiresOn: d('2028-02-29'),
    },
  });

  // ------------------------------------------------------------ batches
  const batchData: [string, string, string, string, string, number, number, string, number?, string?][] = [
    // heat, productCode, supplier, certNumber, received, received qty, remaining, status, unitCost?, depot?
    ['H260501', 'RB10-500B', 'British Steel (Scunthorpe)', 'CERT-26-1501', '2026-06-14', 24, 18.5, 'Available'],
    ['H260502', 'RB10-500B', 'Celsa Steel UK', 'CERT-26-1502', '2026-07-22', 22, 20.0, 'Available'],
    ['H260503', 'RB12-500B', 'British Steel (Scunthorpe)', 'CERT-26-1503', '2026-06-30', 28, 6.2, 'Available', 690],
    ['H260504', 'RB12-500B', 'Celsa Steel UK', 'CERT-26-1504', '2026-08-01', 30, 30.0, 'Available', 693],
    ['H260505', 'RB16-500B', 'British Steel (Scunthorpe)', 'CERT-26-1505', '2026-06-19', 26, 21.4, 'Available', 684],
    ['H260506', 'RB16-500B', 'British Steel (Scunthorpe)', 'CERT-26-1506', '2026-07-19', 24, 24.0, 'Available'],
    ['H260507', 'RB20-500B', 'Celsa Steel UK', 'CERT-26-1507', '2026-07-03', 16, 14.8, 'Available'],
    ['H260508', 'RB25-500B', 'British Steel (Scunthorpe)', 'CERT-26-1508', '2026-05-28', 12, 11.2, 'Available'],
    ['H260509', 'RB32-500B', 'British Steel (Scunthorpe)', 'CERT-26-1509', '2026-06-05', 8, 7.6, 'Available', 712, 'Houghton le Spring'],
    ['H260512', 'RB16-500B', 'ROM Ltd', '', '2026-08-04', 24, 24.0, 'Quarantined'],
  ];

  const batches: Record<string, string> = {};
  for (const [heatNumber, code, supplier, certNumber, received, qtyReceived, qtyRemaining, status, unitCost, depot] of batchData) {
    const b = await db.batch.create({
      data: {
        heatNumber, productId: products[code], supplierId: suppliers[supplier], certNumber,
        millCertUrl: certNumber ? `https://example.invalid/certs/MTC_${heatNumber}.pdf` : '',
        receivedAt: d(received), qtyReceived, qtyRemaining, status,
        unitCost: unitCost ?? null,
        depot: depot ?? 'Scunthorpe',
        location: status === 'Quarantined' ? 'Yard B2' : 'Yard A',
        deliveryNote: `DN-${heatNumber.slice(-4)}`,
        quarantineRef: status === 'Quarantined' ? 'Mill certificate not received' : '',
      },
    });
    batches[heatNumber] = b.id;
    await db.stockMovement.create({
      data: {
        productId: products[code], batchId: b.id, type: 'GOODS_IN', qty: qtyReceived,
        reference: `DN-${heatNumber.slice(-4)}`, userId: users['Claire Bennett'], at: d(received),
      },
    });
  }

  // Mesh and sundries carry no cast, so they get a nominal batch each.
  for (const code of ['MESH-A142', 'MESH-A193', 'MESH-A252', 'MESH-B785', 'DWL-20-600', 'DWL-25-600', 'SP-CIRC-40', 'SP-CHAIR-100', 'TW-16G', 'FW-CHAMFER', 'FW-TIEBAR', 'WP-DPM-1200', 'GR-SUPAFLOW', 'CH-CURE']) {
    await db.batch.create({
      data: {
        heatNumber: `STK-${code}`, productId: products[code], supplierId: suppliers['ROM Ltd'],
        certNumber: 'N/A — not reinforcement', millCertUrl: 'https://example.invalid/certs/stock.pdf',
        receivedAt: d('2026-07-15'), qtyReceived: 400, qtyRemaining: 400, status: 'Available', location: 'Warehouse',
      },
    });
  }

  // BS Supplies' own stock — separate batches against its own supplier.
  for (const [code, qty] of [['BSS-TIMBER-4X2', 600], ['BSS-PLY-18MM', 120], ['BSS-CEMENT-25KG', 800]] as const) {
    await db.batch.create({
      data: {
        company: 'BS_SUPPLIES', heatNumber: `LOT-${code}`, productId: products[code],
        supplierId: suppliers['Northern Building Materials Ltd'],
        certNumber: 'N/A', millCertUrl: '', receivedAt: d('2026-08-05'),
        qtyReceived: qty, qtyRemaining: qty, status: 'Available', location: 'Warehouse', depot: 'Houghton le Spring',
      },
    });
  }

  // -------------------------------------------------- checklist template
  const checklist = [
    'Order details checked against customer PO',
    'Bending schedule checked (if cut & bent)',
    'Stock allocated and picked',
    'Delivery ticket printed',
    'Loaded and strapped — driver walkaround done',
    'POD received and filed',
  ];
  await db.checklistTemplate.createMany({
    data: checklist.map((label, sortOrder) => ({ label, sortOrder })),
  });

  const bsChecklist = ['Order checked against customer PO', 'Stock picked and loaded', 'Delivery note signed'];
  await db.checklistTemplate.createMany({
    data: bsChecklist.map((label, sortOrder) => ({ label, sortOrder, company: 'BS_SUPPLIES' })),
  });

  // ------------------------------------------------------------- orders
  type LineSeed = [string, number, number];
  type BarSeed = [string, number, string, number, number, number[], number];

  const orderSeeds: {
    number: string; customer: string; stage: any; payment?: any; delivery: string; po: string;
    raisedBy: string; created: string; lines: LineSeed[]; bars?: BarSeed[]; archived?: boolean; checklistDone?: number;
    depot?: string; // which yard dispatches it — defaults to Scunthorpe below when not given
  }[] = [
    {
      number: 'FS-26-05301', customer: 'Northside Civils Ltd', stage: 'READY_FOR_DELIVERY', delivery: '2026-08-13',
      po: 'PO-14102', raisedBy: 'Martin Miller', created: '2026-08-04', checklistDone: 4,
      lines: [['RB12-500B', 12, 828], ['RB16-500B', 8, 822], ['MESH-A142', 60, 20.4]],
      bars: [
        ['B01', 12, '21', 1500, 240, [600, 300, 600, 0, 0], 6.2],
        ['B02', 16, '11', 1200, 120, [800, 400, 0, 0, 0], 9.4],
        ['B03', 12, '51', 1840, 300, [500, 420, 500, 420, 0], 7.1],
      ],
    },
    {
      number: 'FS-26-05302', customer: 'Humber Groundworks', stage: 'OUT_FOR_DELIVERY', delivery: '2026-08-10',
      po: 'PO-14103', raisedBy: 'James Ward', created: '2026-08-03', checklistDone: 5,
      lines: [['RB16-500B', 10, 822], ['SP-CIRC-40', 4000, 0.09], ['TW-16G', 80, 6.9]],
    },
    {
      number: 'FS-26-05303', customer: 'Riverside Construction', stage: 'APPROVED', delivery: '2026-08-14',
      po: 'PO-14104', raisedBy: 'Rachel Proctor', created: '2026-08-05', checklistDone: 1,
      lines: [['RB10-500B', 2.5, 832], ['MESH-A193', 12, 27.1]],
    },
    {
      number: 'FS-26-05304', customer: 'Trent Concrete Frames', stage: 'PENDING_APPROVAL', delivery: '2026-08-16',
      po: 'PO-14105', raisedBy: 'Martin Miller', created: '2026-08-06', checklistDone: 0,
      lines: [['RB25-500B', 30, 815], ['RB32-500B', 24, 824], ['CH-CURE', 20, 62]],
    },
    {
      number: 'FS-26-05305', customer: 'Wearside Piling Ltd', stage: 'DRAFT', delivery: '2026-08-18',
      po: '', raisedBy: 'James Ward', created: '2026-08-07', checklistDone: 0, depot: 'Houghton le Spring',
      lines: [['DWL-25-600', 80, 3.4], ['GR-SUPAFLOW', 24, 17.4]],
    },
    {
      number: 'FS-26-05306', customer: 'Yorkshire Concrete Ltd', stage: 'DELIVERED', delivery: '2026-08-08',
      po: 'PO-14107', raisedBy: 'Rachel Proctor', created: '2026-08-01', checklistDone: 6,
      lines: [['RB12-500B', 9, 828], ['TW-16G', 40, 6.9]],
    },
    {
      number: 'FS-26-05307', customer: 'Pennine Housing Developments', stage: 'COMPLETED', payment: 'PAID',
      delivery: '2026-07-29', po: 'PO-14108', raisedBy: 'James Ward', created: '2026-07-24', checklistDone: 6,
      lines: [['MESH-A252', 40, 35.2], ['FW-CHAMFER', 60, 3.1], ['SP-CHAIR-100', 90, 4.2]],
    },
    {
      number: 'FS-26-05308', customer: 'Steel City Formwork', stage: 'READY_FOR_DELIVERY', delivery: '2026-08-12',
      po: 'PO-14109', raisedBy: 'Martin Miller', created: '2026-08-05', checklistDone: 4,
      lines: [['FW-TIEBAR', 200, 4.85], ['FW-CHAMFER', 150, 3.1]],
    },
    {
      number: 'FS-26-05309', customer: 'Northside Civils Ltd', stage: 'COMPLETED', payment: 'PAID',
      delivery: '2026-07-15', po: 'PO-14090', raisedBy: 'Martin Miller', created: '2026-07-09', checklistDone: 6,
      lines: [['RB12-500B', 15, 828], ['RB20-500B', 12, 818]],
    },
    {
      number: 'FS-26-05310', customer: 'Trent Concrete Frames', stage: 'COMPLETED', payment: 'PAID',
      delivery: '2026-07-01', po: 'PO-14081', raisedBy: 'Martin Miller', created: '2026-06-25', checklistDone: 6,
      lines: [['RB16-500B', 20, 822]],
    },
    {
      number: 'FS-26-05311', customer: 'Wearside Piling Ltd', stage: 'DRAFT', delivery: '2026-08-20',
      po: '', raisedBy: 'James Ward', created: '2026-08-08', archived: true, checklistDone: 0, depot: 'Houghton le Spring',
      lines: [['RB10-500B', 1.5, 832], ['MESH-A142', 10, 20.4]],
    },
  ];

  const orderIds: Record<string, string> = {};

  for (const s of orderSeeds) {
    const customer = await db.customer.findUniqueOrThrow({ where: { id: customers[s.customer] } });
    const order = await db.order.create({
      data: {
        number: s.number,
        company: customer.company,
        customerId: customer.id,
        stage: s.stage,
        paymentStatus: s.payment ?? 'UNPAID',
        deliveryDate: d(s.delivery),
        depot: s.depot ?? 'Scunthorpe',
        town: customer.town,
        address: customer.address,
        poNumber: s.po,
        raisedById: users[s.raisedBy],
        archived: s.archived ?? false,
        createdAt: d(s.created),
        approvedAt: ['DRAFT', 'PENDING_APPROVAL'].includes(s.stage) ? null : d(s.created),
        approvedBy: ['DRAFT', 'PENDING_APPROVAL'].includes(s.stage) ? '' : 'John Davies',
        deliveredAt: ['DELIVERED', 'COMPLETED'].includes(s.stage) ? d(s.delivery) : null,
        completedAt: s.stage === 'COMPLETED' ? d(s.delivery) : null,
        paidAt: s.payment === 'PAID' ? d('2026-07-23') : null,
      },
    });
    orderIds[s.number] = order.id;

    let sort = 0;
    for (const [code, qty, unitPrice] of s.lines) {
      const product = await db.product.findUniqueOrThrow({ where: { id: products[code] } });
      await db.orderLine.create({
        data: {
          orderId: order.id, productId: product.id, description: product.name,
          qty, unit: product.unit, unitPrice, lineTotal: +(qty * unitPrice).toFixed(2),
          weightKg: +(qty * Number(product.kgPerUnit)).toFixed(3),
          batchId: ['DELIVERED', 'COMPLETED', 'OUT_FOR_DELIVERY'].includes(s.stage) && product.isRebar
            ? batches[code === 'RB12-500B' ? 'H260503' : code === 'RB16-500B' ? 'H260505' : 'H260501']
            : null,
          sortOrder: sort++,
        },
      });
    }

    let barSort = 0;
    for (const [mark, diaMm, shapeCode, lengthMm, bars, dims, unitPrice] of s.bars ?? []) {
      const perM = ({ 10: 0.616, 12: 0.888, 16: 1.579, 20: 2.466, 25: 3.854, 32: 6.313 } as Record<number, number>)[diaMm] ?? 0.888;
      await db.barMark.create({
        data: {
          orderId: order.id, mark, diaMm, shapeCode,
          shapeName: { '11': 'L — one 90° bend', '21': 'U — two 90° bends', '51': 'Closed link / stirrup' }[shapeCode] ?? 'Shape',
          lengthMm, bars, a: dims[0], b: dims[1], c: dims[2], d: dims[3], ef: dims[4],
          weightKg: +(perM * (lengthMm / 1000) * bars).toFixed(3),
          unitPrice, lineTotal: +(bars * unitPrice).toFixed(2), sortOrder: barSort++,
        },
      });
    }

    for (const [i, label] of checklist.entries()) {
      const done = i < (s.checklistDone ?? 0);
      await db.checklistItem.create({
        data: {
          orderId: order.id, label, done, sortOrder: i,
          doneById: done ? users[s.raisedBy] : null,
          doneAt: done ? d(s.created) : null,
        },
      });
    }

    await db.activityLog.create({
      data: { entity: 'Order', entityId: order.id, action: 'Created', detail: `Raised as ${s.number}`, userId: users[s.raisedBy], at: d(s.created) },
    });
  }

  // BS Supplies' own orders — simple standard-product orders, no bending schedule.
  const bsOrderSeeds: { number: string; customer: string; stage: any; delivery: string; created: string; lines: LineSeed[]; checklistDone: number; depot: string }[] = [
    {
      number: 'BS-26-0001', customer: 'Wearmouth Builders Merchants', stage: 'READY_FOR_DELIVERY',
      delivery: '2026-08-27', created: '2026-08-20', checklistDone: 2, depot: 'Houghton le Spring',
      lines: [['BSS-TIMBER-4X2', 80, 8.5], ['BSS-PLY-18MM', 20, 42.0]],
    },
    {
      number: 'BS-26-0002', customer: 'Doncaster Timber & Building Supplies', stage: 'PENDING_APPROVAL',
      delivery: '2026-09-02', created: '2026-08-22', checklistDone: 0, depot: 'Scunthorpe',
      lines: [['BSS-CEMENT-25KG', 100, 6.2]],
    },
  ];

  for (const s of bsOrderSeeds) {
    const customer = await db.customer.findUniqueOrThrow({ where: { id: customers[s.customer] } });
    const order = await db.order.create({
      data: {
        number: s.number, company: 'BS_SUPPLIES', customerId: customer.id, stage: s.stage,
        deliveryDate: d(s.delivery), depot: s.depot, town: customer.town, address: customer.address,
        raisedById: users['John Davies'], createdAt: d(s.created),
        approvedAt: ['DRAFT', 'PENDING_APPROVAL'].includes(s.stage) ? null : d(s.created),
        approvedBy: ['DRAFT', 'PENDING_APPROVAL'].includes(s.stage) ? '' : 'John Davies',
      },
    });

    let sort = 0;
    for (const [code, qty, unitPrice] of s.lines) {
      const product = await db.product.findUniqueOrThrow({ where: { id: products[code] } });
      await db.orderLine.create({
        data: {
          orderId: order.id, productId: product.id, description: product.name,
          qty, unit: product.unit, unitPrice, lineTotal: +(qty * unitPrice).toFixed(2),
          weightKg: +(qty * Number(product.kgPerUnit)).toFixed(3), sortOrder: sort++,
        },
      });
    }

    for (const [i, label] of bsChecklist.entries()) {
      const done = i < s.checklistDone;
      await db.checklistItem.create({
        data: { orderId: order.id, label, done, sortOrder: i, doneById: done ? users['John Davies'] : null, doneAt: done ? d(s.created) : null },
      });
    }

    await db.activityLog.create({
      data: { entity: 'Order', entityId: order.id, action: 'Created', detail: `Raised as ${s.number}`, userId: users['John Davies'], at: d(s.created) },
    });
  }

  // --------------------------------------------------------------- NCRs
  await db.ncr.create({
    data: {
      ref: 'NCR-26-011', type: 'CUSTOMER_COMPLAINT', status: 'CLOSED',
      description: "Six bars in bundle B02 bent to 480mm 'B' dimension instead of 420mm.",
      rootCause: 'Bender length stop had drifted and was not picked up at the first-off check.',
      correctiveAction: 'Bars re-bent and redelivered next day. Bender length stop checked and reset; operator briefed.',
      orderId: orderIds['FS-26-05309'], customerId: customers['Northside Civils Ltd'], batchId: batches['H260503'],
      raisedById: users['Martin Miller'], raisedAt: d('2026-07-29'), closedAt: d('2026-08-02'), closedBy: 'Claire Bennett',
    },
  });
  await db.ncr.create({
    data: {
      ref: 'NCR-26-012', type: 'SUPPLIER_ISSUE', status: 'OPEN',
      description: 'Mill certificate not received with delivery from ROM Ltd — steel quarantined in Yard B2 pending paperwork.',
      correctiveAction: 'Chasing ROM for the mill test certificate. Batch flagged not-for-issue until the certificate is on file.',
      batchId: batches['H260512'], supplierId: suppliers['ROM Ltd'],
      raisedById: users['Claire Bennett'], raisedAt: d('2026-08-06'),
    },
  });
  await db.ncr.create({
    data: {
      ref: 'NCR-26-013', type: 'INTERNAL', status: 'OPEN',
      description: 'Delivery note printed with wrong PO number — caught at final check before dispatch.',
      orderId: orderIds['FS-26-05307'], customerId: customers['Pennine Housing Developments'],
      raisedById: users['James Ward'], raisedAt: d('2026-08-08'),
    },
  });

  // ------------------------------------------------------ audit actions
  await db.auditAction.createMany({
    data: [
      { ref: 'ACT-26-04', source: 'CARES audit', description: 'Record first-off dimensional check on every cut & bent order, not only where the customer asks.', owner: 'Claire Bennett', dueOn: d('2026-09-05') },
      { ref: 'ACT-26-05', source: 'CARES audit', description: 'Tighten goods-in so no reinforcement is released before the mill certificate is attached.', owner: 'Martin Miller', dueOn: d('2026-08-29') },
      { ref: 'ACT-26-06', source: 'Internal audit', description: 'Retrain second shift on BS 8666 shape code 51 end projections.', owner: 'Martin Miller', dueOn: d('2026-09-19') },
      { ref: 'ACT-26-03', source: 'Management review', description: 'Bring supplier approval certificates into a single register with expiry warnings.', owner: 'Claire Bennett', dueOn: d('2026-07-31'), closedAt: d('2026-07-28'), evidence: 'Certificate register live in the control centre with ninety-day warnings.' },
    ],
  });

  await db.quarterlyReturn.createMany({
    data: [
      { period: '2026-Q1', tonnage: 412.6, preparedBy: 'Claire Bennett', submittedAt: d('2026-04-08'), reference: 'RET-26-Q1' },
      { period: '2026-Q2', tonnage: 468.2, preparedBy: 'Claire Bennett', submittedAt: d('2026-07-07'), reference: 'RET-26-Q2' },
    ],
  });

  // ------------------------------------------------------------- assets
  type AssetSeed = {
    ref: string; type: 'VEHICLE' | 'MACHINE'; name: string; category: string; makeModel: string;
    year?: number; serialNumber?: string; depot: string; hours?: number; liftingEquipment?: boolean;
    motDue?: string; taxDue?: string; weeklyCheckDue?: string; puwerDue?: string;
    lolerDue?: string; serviceDue?: string; calibrationDue?: string;
  };

  const assetSeeds: AssetSeed[] = [
    { ref: 'VH-001', type: 'VEHICLE', name: 'FJ23 YLK', category: 'HGV', makeModel: 'DAF CF 370 8x4 crane lorry', year: 2023, depot: 'Scunthorpe', motDue: '2026-09-17', taxDue: '2026-10-04', weeklyCheckDue: '2026-08-21', liftingEquipment: true, lolerDue: '2026-09-30' },
    { ref: 'VH-002', type: 'VEHICLE', name: 'WN24 LZZ', category: 'Van', makeModel: 'Ford Transit 350', year: 2024, depot: 'Scunthorpe', motDue: '2027-03-08', taxDue: '2026-11-14' },
    { ref: 'VH-003', type: 'VEHICLE', name: 'PN22 ZTJ', category: 'HGV', makeModel: 'Scania P280 6x2 flatbed', year: 2022, depot: 'Houghton le Spring', motDue: '2026-08-06', taxDue: '2026-12-08', weeklyCheckDue: '2026-10-09' },
    { ref: 'VH-004', type: 'VEHICLE', name: 'FL19 KRU', category: 'Pickup', makeModel: 'Isuzu D-Max', year: 2019, depot: 'Scunthorpe', motDue: '2026-12-28', taxDue: '2026-08-30' },
    { ref: 'MC-001', type: 'MACHINE', name: 'Schnell Bend 42', category: 'Bar bender', makeModel: 'Schnell Bend 42', year: 2018, serialNumber: 'SCH-BB42-99812', depot: 'Scunthorpe', hours: 9420, puwerDue: '2026-09-03', serviceDue: '2026-10-19', calibrationDue: '2026-10-01' },
    { ref: 'MC-002', type: 'MACHINE', name: 'Schnell Cut 50', category: 'Shear line', makeModel: 'Schnell Cut 50', year: 2019, serialNumber: 'SCH-CT50-44127', depot: 'Scunthorpe', hours: 7880, puwerDue: '2026-09-03', serviceDue: '2026-11-02', calibrationDue: '2026-09-14' },
    { ref: 'MC-003', type: 'MACHINE', name: 'MEP Format 16', category: 'Link bender', makeModel: 'MEP Format 16', year: 2021, serialNumber: 'MEP-F16-20881', depot: 'Houghton le Spring', hours: 4310, puwerDue: '2026-10-11', serviceDue: '2026-12-05', calibrationDue: '2026-11-20' },
    { ref: 'MC-004', type: 'MACHINE', name: 'Combilift C4000', category: 'Forklift', makeModel: 'Combilift C4000', year: 2020, serialNumber: 'CBL-40-33219', depot: 'Scunthorpe', hours: 6120, liftingEquipment: true, lolerDue: '2026-08-27', serviceDue: '2026-09-22' },
    { ref: 'MC-005', type: 'MACHINE', name: 'Gantry crane — Bay 2', category: 'Overhead crane', makeModel: 'Street 10t gantry', year: 2016, serialNumber: 'STR-G10-11204', depot: 'Scunthorpe', liftingEquipment: true, lolerDue: '2026-11-08', puwerDue: '2026-11-08' },
  ];

  const assets: Record<string, string> = {};
  for (const a of assetSeeds) {
    const created = await db.asset.create({
      data: {
        ref: a.ref, type: a.type, name: a.name, category: a.category, makeModel: a.makeModel,
        year: a.year ?? null, serialNumber: a.serialNumber ?? '', depot: a.depot,
        hours: a.hours ?? null, liftingEquipment: a.liftingEquipment ?? false,
        motDue: a.motDue ? d(a.motDue) : null,
        taxDue: a.taxDue ? d(a.taxDue) : null,
        weeklyCheckDue: a.weeklyCheckDue ? d(a.weeklyCheckDue) : null,
        puwerDue: a.puwerDue ? d(a.puwerDue) : null,
        lolerDue: a.lolerDue ? d(a.lolerDue) : null,
        serviceDue: a.serviceDue ? d(a.serviceDue) : null,
        calibrationDue: a.calibrationDue ? d(a.calibrationDue) : null,
      },
    });
    assets[a.ref] = created.id;

    // A starting pre-use checklist per type — same defaults the app itself
    // uses when someone adds a new asset from Set Up, editable from there on.
    const defaultItems = a.category === 'Forklift' ? FORKLIFT_CHECK_ITEMS : a.type === 'VEHICLE' ? VEHICLE_CHECK_ITEMS : MACHINE_CHECK_ITEMS;
    await db.assetChecklistItem.createMany({
      data: defaultItems.map((label, i) => ({ assetId: created.id, label, sortOrder: i })),
    });
  }

  await db.assetNote.create({
    data: {
      assetId: assets['MC-001'], userId: users['Claire Bennett'], at: d('2026-08-01'),
      body: 'Length stop drifting about 3mm on long runs — watch it until the next calibration.',
    },
  });

  await db.inspection.createMany({
    data: [
      { assetId: assets['MC-001'], kind: 'PUWER', result: 'Pass', provider: 'SafeCheck Ltd', performedOn: d('2025-09-04'), nextDueOn: d('2026-09-03') },
      { assetId: assets['MC-001'], kind: 'Service', result: 'Pass', provider: 'Schnell UK', performedOn: d('2026-04-22'), nextDueOn: d('2026-10-19') },
      { assetId: assets['MC-001'], kind: 'Calibration', result: 'Pass', provider: 'SafeCheck Ltd', performedOn: d('2025-10-01'), nextDueOn: d('2026-10-01'), notes: 'Length measurement verified to ±2 mm' },
      { assetId: assets['MC-002'], kind: 'Calibration', result: 'Pass', provider: 'SafeCheck Ltd', performedOn: d('2025-09-14'), nextDueOn: d('2026-09-14'), notes: 'Cropper stop verified to ±2 mm' },
      { assetId: assets['VH-001'], kind: 'MOT', result: 'Pass', provider: 'DVSA Scunthorpe', performedOn: d('2025-09-17'), nextDueOn: d('2026-09-17') },
    ],
  });

  // ------------------------------------------------- morning checks
  // Real relative dates (not fixed 2026 ones) so "checked today" is always
  // actually today, however far in the future this seed gets run again.
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const VEHICLE_ITEMS = ['Tyres — condition and pressure', 'Lights, indicators and beacon', 'Brakes', 'Fluid levels (oil, water, screenwash)', 'Load securing equipment (straps, chains, headboard)', 'No visible damage, leaks or corrosion'];
  const MACHINE_ITEMS = ['Guards in place and secure', 'Emergency stop tested', 'No visible damage to blades, dies or rollers', 'Hydraulic and air lines — no leaks', 'Work area clear and clean'];

  async function seedCheck(assetRef: string, when: Date, byName: string, failLabel: string | null, itemLabels: string[]) {
    await db.assetCheck.create({
      data: {
        assetId: assets[assetRef], userId: users[byName], performedAt: when,
        result: failLabel ? 'FAIL' : 'PASS',
        items: {
          create: itemLabels.map((label) => ({
            label, ok: label !== failLabel,
            note: label === failLabel ? 'Nearside rear tyre worn close to the limit — flagged for the yard to look at before it goes out again.' : '',
          })),
        },
      },
    });
  }

  await seedCheck('VH-001', hoursAgo(3), 'Dave Wilson', null, VEHICLE_ITEMS);
  await seedCheck('VH-003', hoursAgo(2), 'Dave Wilson', 'Tyres — condition and pressure', VEHICLE_ITEMS);
  await seedCheck('MC-001', hoursAgo(4), 'Martin Miller', null, MACHINE_ITEMS);
  await seedCheck('VH-004', daysAgo(1), 'Dave Wilson', null, VEHICLE_ITEMS);
  await seedCheck('MC-002', daysAgo(2), 'Martin Miller', null, MACHINE_ITEMS);
  // VH-002 and the remaining machines are left with no checks at all — real
  // yards start somewhere, and it gives the "not checked today" alert
  // something honest to show on first boot.

  // ----------------------------------------------------------- planning
  await db.planningEvent.createMany({
    data: [
      { title: 'Toolbox talk — manual handling', type: 'OTHER', startsAt: at('2026-08-10', '08:30'), detail: 'Warehouse team', assignedTo: 'Martin Miller' },
      { title: 'Lorry safety inspection — FJ23 YLK', type: 'INSPECTION', startsAt: at('2026-08-12', '07:00'), assetId: assets['VH-001'], detail: 'Dave Wilson' },
      { title: 'LOLER exam — Combilift C4000', type: 'INSPECTION', startsAt: at('2026-08-13', '09:30'), assetId: assets['MC-004'], detail: 'Allianz engineer on site' },
      { title: 'Weekly H&S walkround', type: 'OTHER', startsAt: at('2026-08-14', '12:00'), assignedTo: 'Claire Bennett' },
      { title: 'CARES surveillance audit', type: 'AUDIT', startsAt: at('2026-09-16', '09:00'), detail: 'Half day, Scunthorpe. Have the NCR register and calibration records to hand.' },
      { title: 'Bender calibration — Schnell Bend 42', type: 'SERVICE', startsAt: at('2026-10-01', '08:00'), assetId: assets['MC-001'], detail: 'SafeCheck Ltd' },
    ],
  });

  console.log('Seeded.');
  console.log(`Sign in as john.davies@fendersteel.co.uk with the password "${password}".`);
  console.log('Other accounts: claire.bennett (quality), martin.miller (manager), james.ward (sales), dave.wilson (driver), auditor (read only).');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

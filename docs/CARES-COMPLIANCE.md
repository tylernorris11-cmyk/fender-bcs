# CARES compliance — what the scheme asks for, and where it lives in this system

This is the working note behind the Compliance module. It is a summary written
from the public CARES material, **not** the scheme document. The binding
requirements are in the CARES Scheme Manual and the Quality and Operations
Assessment Schedules for the appendices Fender Steel is approved under. Keep a
current copy of those with the audit file.

## The scheme in one paragraph

CARES (the Certification Authority for Reinforcing Steels) certifies both the
mills that make reinforcing steel and the fabricators that process it. The point
of it is that responsibility for conformity sits with the manufacturer and
processor, so steel from a CARES-certified mill can be used in any bar mark at a
CARES-certified fabricator without further testing on site. That only works if
the paper trail holds, which is why the fabricator scheme is built around
traceability and record keeping rather than product testing.

Fabricators are audited **twice yearly**, and audits can be unannounced.

## What the fabricator scheme requires

CARES lists the system a fabricator must operate as covering:

| Requirement | Where it is evidenced here |
|---|---|
| Receipt, in-process and final inspection of reinforcement | Goods in (Stock), the order checklist, and Dimensional checks (Production) |
| Stock control | Stock module, batch quantities and movements |
| Understanding customer requirements | Order record: PO number, delivery address, yard notes, bending schedule |
| Cutting, and cutting and bending, to customer requirements and BS 8666 | Bending schedule on the order; bending ticket print with shape code, dimensions and tolerance |
| Control of non-conforming steel | Batch quarantine in Stock, plus the NCR register |
| Direct deliveries | Order delivery address, separate from the account address |
| Sub-contracting | Not modelled yet — see "Gaps" below |
| Control of measuring devices | Calibration due dates on each machine in Assets, rolled forward when a calibration is logged |
| Purchasing and processing of steel from certified suppliers | Suppliers register cross-checks receipts against approval certificates |
| Full traceability for each cast of steel and each supplier | Batch = one cast. Trace a batch follows a cast both ways |
| Record keeping and retention | Activity log on every order, batch, asset and NCR; CSV exports under Backups |
| Handling of complaints, against us and against our suppliers | NCR types: customer complaint, internal, supplier issue |
| Fabricating by competent people | Not modelled yet — see "Gaps" below |

A management system meeting **ISO 9001** is also required. This software supports
that system; it is not the system on its own.

## Traceability, specifically

CARES material states that reinforcement delivered to site must be fully
traceable to the cast/heat/batch number, the reinforcement supplier and the
reinforcement manufacturer, and must carry a suitable durable tag or label.

How that is enforced in the code:

1. **A batch cannot exist without a cast number and a supplier.** `receiveBatch`
   in `src/app/stock/actions.ts` rejects a blank cast number.
2. **No certificate means quarantine.** Steel booked in without a mill
   certificate, or from a supplier with no in-date approval on file, is created
   with status `Quarantined` and appears on the alerts list until it is fixed.
3. **Picking is oldest-first, and it is not a preference.** `pickOldestFirst` in
   `src/lib/orders.ts` allocates from the oldest available batch and writes the
   batch onto the order line, so the certificate that prints on the delivery
   note is the one covering the steel actually on the lorry.
4. **The delivery note prints the cast and certificate per line.**
   `src/app/orders/[id]/delivery-sheet/page.tsx`.
5. **Trace a batch works both directions** — cast to mill, and cast to every
   order and site it went out on.

## BS 8666:2020

Cut and bent work must conform to BS 8666 and to the customer's schedule.

The important design decision: **this system does not calculate cutting lengths
for you.** The customer issues the schedule; our job is to cut to it accurately
and prove we did. `src/lib/bs8666.ts` holds the shape-code catalogue, the bar
mass table, minimum radii and the tolerance bands, and offers
`estimateCuttingLength` purely as a typing-error cross-check on the commonest
shapes.

**Before the first schedule is run against this software**, check the values in
`src/lib/bs8666.ts` against your own purchased copy of BS 8666:2020 —
specifically the Table 2 minimum radii and end projections and the Table 7
tolerances. They are held in one file precisely so they can be verified and
corrected in one place.

A few things the standard sets that the code encodes:

- Minimum mandrel is 4d up to and including 16 mm and 7d for 20 mm and over, so
  minimum bend radius is half that.
- Shapes with two or more bends need a minimum straight of 4d between the curved
  portions, with the overall dimension X not less than 10d (minimum 75 mm) up to
  16 mm, and 13d above 16 mm.
- Five or more bends may be impractical within tolerance unless agreed with the
  fabricator.
- Anything non-standard is scheduled as shape code 99 with a dimensioned sketch.

## Gaps — things deliberately not built yet

Being straight about this matters more than a longer feature list:

- **Sub-contracting.** If you send work out to another fabricator, the scheme
  expects that controlled and traceable. There is no sub-contract record yet.
- **Operator competence records.** Training, authorisation to run a machine, and
  refresher dates are not modelled. The Users table is access control, not a
  training matrix.
- **Tag and label printing, including the CARES QR code.** The bending ticket
  prints, but bundle tags do not.
- **Document control for the quality manual itself** — procedure versions,
  issue dates, who approved them.
- **Welding and coupling appendices.** Only cut, bend and supply is modelled.

Add these before claiming the system covers the whole scheme.

## Sources

Public CARES material at carescertification.com — the reinforcing steels scheme
pages, the approval process page, and the CARES Guide to Reinforcing Steels
(Parts 1 and 4). BS 8666:2020 itself is a purchased BSI standard and is not
reproduced here.

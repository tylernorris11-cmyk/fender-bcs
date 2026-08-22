# Fender Steel — Business Control System

Orders, production, stock, sales, customers, CARES compliance and assets, in one
web app. Built with Next.js, TypeScript, Tailwind and Prisma on PostgreSQL.
Deploys to Vercel from GitHub.

---

## Getting it running on your own machine first

You need [Node.js 18.18 or newer](https://nodejs.org) and a PostgreSQL database.
The quickest free database is [Neon](https://neon.tech) — sign up, create a
project, copy the connection string.

```bash
npm install

cp .env.example .env
# open .env and paste your DATABASE_URL, then generate a SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npm run setup      # creates the tables and loads the demo data
npm run dev        # http://localhost:3000
```

Sign in as **john.davies@fendersteel.co.uk** with the password in
`SEED_PASSWORD` (default `ChangeMe123!`).

Other seeded accounts, all on the same password, so you can see what each role
actually sees:

| Email | Role | What they get |
|---|---|---|
| john.davies@fendersteel.co.uk | Administrator | Everything, including purchase costs and user management |
| martin.miller@fendersteel.co.uk | Yard manager | The whole job except pricing, costs and user accounts |
| james.ward@fendersteel.co.uk | Sales | Orders and customers. Cannot approve over a credit limit |
| claire.bennett@fendersteel.co.uk | Quality | Compliance, NCRs, certificates, calibration |
| dave.wilson@fendersteel.co.uk | Driver | Runs and delivery sheets |
| auditor@fendersteel.co.uk | Read only | Safe account to hand an auditor |

**Change every one of these before real data goes in.** Set Up → Users & roles.

---

## Putting it on GitHub and Vercel

### 1. GitHub

```bash
git init
git add .
git commit -m "Fender Steel control system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/fender-bcs.git
git push -u origin main
```

`.env` is already git-ignored, so your database password does not go up with it.

### 2. Vercel

1. Go to vercel.com, **Add New → Project**, and import the repository.
2. Leave the framework preset as Next.js. Do not change the build command —
   `package.json` already runs `prisma generate && prisma migrate deploy` before
   the build.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon (or Vercel Postgres / Supabase) connection string
   - `SESSION_SECRET` — a long random string, different from your local one
4. Deploy.

### 3. First run against the live database

From your own machine, pointed at the production database:

```bash
DATABASE_URL="your-production-url" npx prisma db push
DATABASE_URL="your-production-url" SEED_PASSWORD="something-you-choose" npm run db:seed
```

Then sign in on the live site and change the passwords.

> If you would rather start empty than with demo data, skip the seed and create
> your first administrator by running the seed once, deleting the demo customers
> and orders from Set Up, or by adding a user directly in `npx prisma studio`.

### Custom domain

In Vercel, Project → Settings → Domains, add e.g. `bcs.fendersteel.co.uk` and
follow the DNS instructions. HTTPS is automatic.

---

## How it is put together

```
src/
  lib/
    rbac.ts        ← THE permission matrix. Change access here, nowhere else.
    auth.ts        ← password hashing, signed session cookies, page guards
    orders.ts      ← order numbering, totals, stage rules, credit check, FIFO picking
    bs8666.ts      ← shape codes, bar weights, tolerances  (VERIFY — see docs)
    alerts.ts      ← everything the system thinks needs attention
  components/      ← the shell, and shared UI pieces
  app/
    orders/  production/  stock/  compliance/  customers/  planning/  assets/  setup/
prisma/
  schema.prisma    ← the data model
  seed.ts          ← demo data matching the screenshots
docs/
  CARES-COMPLIANCE.md  ← what the scheme requires and where it is evidenced
```

### Roles and permissions

Seven roles, defined once in `src/lib/rbac.ts`. Pages call
`requirePermission('orders.approve')`; server actions call
`assertPermission('orders.approve')`. Nothing decides access on its own, so
changing the matrix changes the whole app.

Two guardrails you cannot switch off: the system refuses to demote or suspend
the last active administrator, and purchase costs live on a separate table only
`finance.costs` can read.

### The order journey

`Draft → Pending approval → Approved → In production → Ready for delivery →
Out for delivery → Delivered → Completed`

Two of those steps do real work:

- **Approving** is the credit gate. An order that would take a customer over
  their limit cannot pass without someone with `orders.approve` ticking the
  override, and the override is logged against their name.
- **Starting production** allocates stock oldest-first and writes the cast onto
  each line, which is what makes the delivery note traceable.

---

## Before you rely on this in the yard

Honest list, in priority order:

1. **Check `src/lib/bs8666.ts` against your purchased copy of BS 8666:2020.**
   The tolerance bands and minimum radii are best-effort defaults. Cutting real
   steel against unverified numbers is the one way this software could cause
   actual harm.
2. **Turn on database backups** with point-in-time recovery, and test a restore.
   The CSV downloads under Set Up → Backups are convenience, not a disaster plan.
3. **File uploads are links, not uploads.** Mill certificates and approval
   certificates are stored as URLs. Wire them to Vercel Blob, S3 or SharePoint
   before you retire the paper.
4. **The sign-in throttle is per server instance.** Fine for one small
   deployment; move it to the database or Vercel KV if you scale out.
5. **Read the Gaps section** in `docs/CARES-COMPLIANCE.md`. Sub-contracting,
   operator competence records and bundle tag printing are not built.

---

## Handy commands

```bash
npm run dev          # local development server
npm run build        # production build
npm run db:studio    # browse and edit the database in a GUI
npm run db:push      # apply schema changes to the database
npm run db:seed      # reload the demo data (wipes what is there)
```

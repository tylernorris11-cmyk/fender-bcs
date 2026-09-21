# Sales outreach agent — setup

The agent finds prospective trade customers for BCS Products / BS Supplies, drafts an introductory email to each, and — once **you** approve a draft — sends it, forwards any reply to your inbox, and honours unsubscribes. This document is everything needed to switch it on.

**Status:** the code is built and its database tables exist, but it will not send anything until the steps below are done. The review queue (Sales Outreach, BCS Products view) shows a yellow banner listing whatever is still missing.

---

## Read this first — two things that can stop you

### 1. Postmark's terms don't allow cold email

The agent sends through Postmark, and this is a cold-outreach tool. Postmark's published [Terms of Service](https://postmarkapp.com/terms-of-service/) say senders may not use it for unsolicited messages, that mailing lists must be permission-based, and that spam complaints above 0.1% or bounces above 10% put an account at risk. As I read them, an introductory email to a company that has never heard of you is exactly what they exclude, even though it is lawful in the UK (see below).

What that means in practice: if you sign up and describe what you're doing honestly, Postmark may decline the account; if you sign up and don't, the account can be suspended later, mid-campaign, with your domain's reputation already affected. **Don't hide the use case from them.**

Your options, in order of how much I'd trust them:

1. **Ask Postmark first, in writing.** Email their support: "We're a UK steel supplier. We want to send a small number (about 10 a day) of one-to-one introductory emails to limited companies in our trade, each with our full company details and a working unsubscribe link. Is that permitted?" Only go live if the answer is a clear yes.
2. **Send from a normal mailbox on a separate domain** (Google Workspace or Microsoft 365) instead of Postmark. Ten a day of targeted B2B email is within what those services tolerate. This needs a code change to the sending step (`src/lib/outreach/postmark.ts`) and changes how replies come back — they'd land in that mailbox rather than through the webhook.
3. **Use a service built for outbound sales email.** Same idea, bigger code change.

The rest of this document is written for Postmark because that's what the code uses today. Steps 1, 2, 5, 6 and 7 apply whichever sender you pick.

### 2. UK law (not legal advice — the ICO's guidance is the authority)

Emailing a **limited company, PLC or LLP** for business purposes without prior consent is allowed under PECR, provided you say who you are, give a postal address, and let them opt out. Sole traders and ordinary partnerships are treated like individuals and need consent, so the agent never emails them. Where a contact address identifies a person (e.g. `john.smith@…`), UK GDPR also applies.

The agent already: only drafts for ltd/plc/llp companies; puts your name, address and company number in every email (and **refuses to send** if either is missing); adds a one-click unsubscribe link and `List-Unsubscribe` header; keeps a permanent suppression list; and never sends anything until a person approves it.

What only you can do:

- Fill in your **real registered address and company number** (Step 2).
- Add a short paragraph to the privacy notice at `/privacy` covering prospect data: where you get it (Companies House and the company's own website), why (introducing your products, legitimate interests), how long you keep it, and how to object.
- Honour every opt-out and reply promptly. The agent handles the mechanics, but replies forward to a person and someone has to read them.

---

## How it works

| When | What happens |
|---|---|
| ~06:00 UK, Mon–Fri | **Discovery.** Pulls the next page of companies from Companies House for each configured SIC code, keeps only ltd/plc/llp, finds each one's website and a contact email, and drafts an email. New drafts appear in **Sales Outreach → Review queue**. |
| You, any time | Read each draft. **Approve to send** or **Reject**. Check the website and contact address too — the website is found by search and is occasionally the wrong company. |
| ~09:00 UK, Mon–Fri | **Send.** Sends approved emails, oldest first, up to the daily cap (default 10). |
| Whenever a reply arrives | Forwarded to `OUTREACH_FORWARD_TO_EMAIL`, the lead is marked **Replied**, and an opt-out ("unsubscribe", "remove me"…) is added to the suppression list automatically. |
| Whenever someone unsubscribes or an address bounces | Suppressed permanently; never emailed again. |

On Vercel's free (Hobby) plan cron jobs run once a day and can fire up to an hour late, so "06:00" and "09:00" mean "sometime in that hour". That's fine here.

---

## Step 1 — Companies House API key (free, ~5 minutes)

1. Register at <https://developer.company-information.service.gov.uk> and sign in.
2. **Your applications → Create an application**, then **Create new key**, key type **REST**.
3. Copy the key into `COMPANIES_HOUSE_API_KEY`.

## Step 2 — Your legal details

Set these to the legal entity the emails go out as — they appear in every email footer and must be accurate:

- `OUTREACH_REGISTERED_ADDRESS` — registered office address, on one line.
- `OUTREACH_COMPANY_NUMBER` — Companies House number.

## Step 3 — Postmark account and DNS (only after Step "Read this first")

Use a **separate subdomain** (`sales.fenderbcs.com`) so anything that goes wrong with cold-email reputation can't touch the app's normal email or `fenderbcs.com` itself.

1. Create a Postmark account and a **Server**. Postmark starts new accounts in a restricted state until they approve them — answer their questions truthfully.
2. In the server, note the two message streams: the default *Transactional* stream (`outbound`) and the *Broadcast* stream (`broadcast`). The agent uses **broadcast** (commercial email with unsubscribe handling). Override with `POSTMARK_MESSAGE_STREAM` if Postmark tells you otherwise.
3. **Sender Signatures → Add Domain →** `sales.fenderbcs.com`. Postmark then shows you the DNS records to create. **Copy the exact values from Postmark's screen** — the ones below are the shape to expect, not values to paste:

| Type | Host | Value | Purpose |
|---|---|---|---|
| TXT | `<something>pm._domainkey.sales` | `k=rsa; p=…` (long key) | DKIM — proves the mail is really yours |
| CNAME | `pm-bounces.sales` | `pm.mtasv.net` | Return-Path — bounce handling and SPF alignment |
| TXT | `_dmarc.sales` | `v=DMARC1; p=none; rua=mailto:<your address>` | DMARC — start at `p=none` (monitor only) |
| MX | `sales` | `inbound.postmarkapp.com`, priority `10` | So replies to `sales@sales.fenderbcs.com` reach Postmark |

   Optional but harmless: TXT on `sales` with `v=spf1 include:spf.mtasv.net ~all`.

4. Add them wherever `fenderbcs.com`'s DNS is managed. If you don't know where that is, run `dig NS fenderbcs.com +short` — the name servers tell you (Vercel, Cloudflare, GoDaddy, 123-reg…). Some DNS panels want the host as just `sales`, others as the full name; if a record doesn't verify, try the other form.
5. Back in Postmark, click **Verify** next to each record. DNS can take from minutes to a few hours. You can check from a terminal, e.g. `dig TXT _dmarc.sales.fenderbcs.com +short`.
6. Don't host real mailboxes on `sales.fenderbcs.com` — its MX points at Postmark.

## Step 4 — Tell Postmark where to send replies and bounces

1. Generate a secret and keep it — it goes in `POSTMARK_WEBHOOK_SECRET` (Step 5) and in the URLs below:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
2. **Inbound (replies):** Server → *Default Inbound Stream* → Settings. Set the inbound domain to `sales.fenderbcs.com` and the webhook to
   `https://fenderbcs.com/api/outreach/webhook?secret=<your secret>`
3. **Bounces and spam complaints:** Server → the broadcast stream → Webhooks → Add webhook, same URL, tick **Bounce** and **Spam complaint**.

Postmark doesn't sign these requests, which is why the secret is in the URL. Treat that URL like a password.

## Step 5 — Environment variables

Add each in **Vercel → your project → Settings → Environment Variables** (Production), then redeploy. For local testing put them in `.env`.

| Variable | Required | Where it comes from |
|---|---|---|
| `COMPANIES_HOUSE_API_KEY` | yes | Step 1 |
| `ANTHROPIC_API_KEY` | yes | already set for Bar Counter |
| `POSTMARK_SERVER_TOKEN` | yes | Postmark → Server → API Tokens |
| `POSTMARK_WEBHOOK_SECRET` | yes | Step 4 |
| `OUTREACH_REGISTERED_ADDRESS` | yes | Step 2 |
| `OUTREACH_COMPANY_NUMBER` | yes | Step 2 |
| `CRON_SECRET` | yes | already set for the Drive backup |
| `OUTREACH_FROM_EMAIL` | no | default `sales@sales.fenderbcs.com` — must be on the verified domain |
| `OUTREACH_REPLY_TO_EMAIL` | no | default = from address |
| `OUTREACH_FORWARD_TO_EMAIL` | no | default `tyler@fendersteel.co.uk` — every reply is forwarded here |
| `OUTREACH_APP_URL` | no | default `https://fenderbcs.com` — used for the unsubscribe link |
| `OUTREACH_DAILY_SEND_CAP` | no | default `10` |
| `OUTREACH_DISCOVERY_BATCH_SIZE` | no | default `20` companies per SIC code per day |
| `OUTREACH_REQUIRE_APPROVAL` | no | default on. `false` sends drafts with **no human review** — don't, at least not until you've read a few dozen |
| `POSTMARK_MESSAGE_STREAM` | no | default `broadcast` |

When the yellow banner on the review queue disappears, the required ones are all in.

## Step 6 — Deploy

Push to `main`. The database tables were created when the code was prepared, so there's nothing to migrate. Vercel picks up the two daily jobs from `vercel.json`.

## Step 7 — Test before anything real goes out

1. **Discovery.** Trigger it by hand (replace the secret):
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://fenderbcs.com/api/cron/outreach-discover
   ```
   It returns counts: `found`, `newLeads`, `contactsFound`, `drafted`, and any `errors`. `found: 0` means the SIC codes or API key are wrong. Lots of `NO_CONTACT_FOUND` is normal — the contact finder is a best-effort web search, and those leads wait for someone to add an address by hand.
2. **Read the drafts** in the review queue. Are they something you'd put your name to? Are the website and address the right company? Reject the ones that aren't. If the wording is off, it's the prompt in `src/lib/outreach/draft.ts`.
3. **Send one to yourself first.** Run `npx prisma studio`, open a lead that has a draft, change its `contactEmail` to your own address, approve that draft in the app, then trigger the send job:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://fenderbcs.com/api/cron/outreach-send
   ```
   Check it arrives, the footer has your real address and company number, and the unsubscribe link works ("You're unsubscribed").
4. **Reply to it.** The reply should land in `OUTREACH_FORWARD_TO_EMAIL` with `[BCS outreach reply]` in the subject, and the lead should show **Replied**.
5. **Unsubscribe check.** After clicking unsubscribe, approve another draft to the same address — it should fail with "suppressed", not send.

## Step 8 — Going live, gently

Leave the cap at 10 a day and approval on. Watch the **Sent** and **Failed** tabs. Keep bounces well under Postmark's 10% and complaints under 0.1% — one complaint in the first few hundred is a sign the targeting or copy needs work, not a number to shrug off. Raise the cap only after a couple of clean weeks. Move DMARC from `p=none` to `p=quarantine` once it's been quiet for a month.

---

## Tuning

- **Who it targets:** `OUTREACH_SIC_CODES` in `src/lib/outreach/config.ts`. Check each code is what you think it is on Companies House before relying on it.
- **What it says:** the prompt in `src/lib/outreach/draft.ts`. The compliance footer is added separately and can't be reworded by the model.
- **Better contact hit rate:** `src/lib/outreach/contactFinder.ts` scrapes DuckDuckGo's plain HTML results, which can be blocked from server IPs. A paid search API is a drop-in improvement if too many leads come back empty.
- **Switching to Fender Steel later:** change `OUTREACH_SENDER.label`, the SIC codes and the prompt, and drop the `company: 'BS_SUPPLIES'` restriction on the module in `src/lib/rbac.ts`. Nothing in the tables is company-specific.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Yellow "Setup isn't finished" banner | An environment variable from Step 5 is missing, or you haven't redeployed since adding it |
| Discovery returns `Companies House returned 401` | Wrong or missing `COMPANIES_HOUSE_API_KEY` |
| No new leads after the first few days | Should not happen — discovery pages through results. If it does, check the `outreachOffset:*` rows in the `Setting` table |
| Emails show as Failed: `OUTREACH_REGISTERED_ADDRESS and OUTREACH_COMPANY_NUMBER must both be set` | Step 2 not done — nothing was sent |
| Failed: a Postmark error about sender or domain | The from address isn't on the verified domain, or DNS records haven't verified yet |
| Replies never arrive | MX record for `sales.fenderbcs.com` missing, or the inbound webhook URL/secret is wrong (a wrong secret returns 401 in Postmark's activity log) |
| "That email has already been dealt with" when approving | Someone else approved or rejected it — refresh |

## Where things live

| What | File |
|---|---|
| Review queue, all leads | `src/app/outreach/` |
| Daily jobs | `src/app/api/cron/outreach-discover`, `outreach-send` (schedules in `vercel.json`) |
| Reply/bounce webhook, unsubscribe link | `src/app/api/outreach/` |
| Companies House, contact finder, drafting, sending | `src/lib/outreach/` |
| Tables | `Lead`, `OutreachEmail`, `OutreachSuppression` in `prisma/schema.prisma` |

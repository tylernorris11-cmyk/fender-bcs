# Sales outreach agent — setup

The agent finds prospective trade customers for BCS Products / BS Supplies, drafts an introductory email to each, and — once **you** approve a draft — sends it from a dedicated Microsoft 365 mailbox, watches that mailbox for replies, and honours unsubscribes. This document is everything needed to switch it on.

**Status:** the code is built and its database tables exist, but nothing sends until the steps below are done. The review queue (Sales Outreach, BCS Products view) shows a yellow banner listing whatever is still missing.

---

## Read this first

### 1. Why it sends from a mailbox and not from an email service

Postmark and Resend both ban cold email in their terms ([Postmark](https://postmarkapp.com/terms-of-service/), [Resend](https://resend.com/legal/acceptable-use) — both require recipients to have opted in). Resend is also the account that sends the app's own password resets and notifications, so a suspension there would break those too. The agent therefore sends from its **own Microsoft 365 mailbox on its own domain**, which is how small-volume B2B outreach is normally done.

Keep it on a **separate domain** from `fendersteel.co.uk` and `bcsproducts.co.uk`. If cold email ever damages the sending reputation, it damages a throwaway domain, not the one your real customers' mail comes from.

### 2. UK law (not legal advice — the ICO's guidance is the authority)

Emailing a **limited company, PLC or LLP** for business purposes without prior consent is allowed under PECR, provided you say who you are, give a postal address, and let them opt out. Sole traders and ordinary partnerships are treated like individuals and need consent, so the agent never emails them. Where a contact address identifies a person (e.g. `john.smith@…`), UK GDPR also applies.

The agent already: only drafts for ltd/plc/llp companies; puts your name, address and company number in every email (and **refuses to send** if either is missing); adds an unsubscribe link; keeps a permanent suppression list; and never sends anything until a person approves it.

What only you can do:

- Fill in your **real registered address and company number** (Step 2).
- Add a short paragraph to the privacy notice at `/privacy` covering prospect data: where you get it (Companies House and the company's own website), why (introducing your products, legitimate interests), how long you keep it, and how to object.
- Read the replies and honour every opt-out. The agent handles the mechanics, but a person has to read what comes back.

---

## How it works

| When | What happens |
|---|---|
| ~06:00 UK, Mon–Fri | **Discovery.** Pulls the next page of companies from Companies House for each configured SIC code, keeps only ltd/plc/llp, finds each one's website and a contact email, and drafts an email. New drafts appear in **Sales Outreach → Review queue**. |
| You, any time | Read each draft. **Approve to send** or **Reject**. Check the website and contact address too — the website is found by search and is occasionally the wrong company. |
| ~09:00 UK, Mon–Fri | **Read the mailbox, then send.** First it reads anything new in the outreach mailbox — replies, opt-outs, bounce notices — and updates the leads and suppression list. Then it sends approved emails, oldest first, up to the daily cap (default 10). |
| Whenever someone replies | The reply arrives in the outreach mailbox straight away, so you can read and answer it there like any email. The app notices it at the next morning run, marks the lead **Replied**, and sends a heads-up email to `OUTREACH_FORWARD_TO_EMAIL`. |
| Whenever someone unsubscribes | The link in every email suppresses the address immediately. |

Replies are picked up once a day, not instantly. An opt-out reply is honoured before the next batch goes out, but if you want to answer a reply quickly, watch the mailbox itself. On Vercel's free (Hobby) plan cron jobs run once a day and can fire up to an hour late, so "06:00" and "09:00" mean "sometime in that hour".

---

## Step 1 — Companies House API key (free, ~5 minutes)

1. Register at <https://developer.company-information.service.gov.uk> and sign in.
2. **Your applications → Create an application**, then **Create new key**, key type **REST**.
3. Copy the key into `COMPANIES_HOUSE_API_KEY`.

## Step 2 — Your legal details

Set these to the legal entity the emails go out as — they appear in every email footer and must be accurate:

- `OUTREACH_REGISTERED_ADDRESS` — registered office address, on one line.
- `OUTREACH_COMPANY_NUMBER` — Companies House number.

## Step 3 — A separate domain and a mailbox

Both your company domains already use Microsoft 365, so this is a second domain added to the same tenant.

> **Using an existing domain instead** (e.g. `salesoutreach@bcsproducts.co.uk`)? It works — set `OUTREACH_MAILBOX` to that address and skip points 1–2 (no domain to buy) — but it puts cold-email complaints and spam-folder placement on the domain your staff's real mail comes from. If you do it, first make sure the domain is authenticated. As checked in September 2026, `fendersteel.co.uk` has DKIM and DMARC; **`bcsproducts.co.uk` has neither**, so do points 4 (the `_dmarc` record) and 5 (DKIM) for it before sending anything, or the emails will very likely land in spam. Keep to the daily cap of 10.

1. **Buy a domain** that's clearly yours but not your main ones — for example `bcsproducts-sales.co.uk`. A few pounds a year from any registrar.
2. In the **Microsoft 365 admin centre → Settings → Domains → Add domain**, add it and follow the prompts. Microsoft gives you a TXT record to prove you own it; add that at the registrar's DNS panel.
3. **Create a user** on that domain, e.g. `sales@bcsproducts-sales.co.uk`, and give it a mailbox licence (Exchange Online or a Microsoft 365 Business plan — check current pricing). Set its **display name** to `BCS Products / BS Supplies`, because that's the name recipients see in their inbox.
4. **Add these DNS records** for the new domain (the M365 admin centre lists them; copy from there if any value differs):

| Type | Host | Value | Purpose |
|---|---|---|---|
| MX | `@` | `<your-domain-with-dashes>.mail.protection.outlook.com`, priority `0` | Mail for the domain reaches Microsoft (replies!). Your existing domains show the pattern, e.g. `fendersteel-co-uk.mail.protection.outlook.com` |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` | SPF — says Microsoft may send for this domain |
| CNAME | `selector1._domainkey`, `selector2._domainkey` | values shown in the Defender portal | DKIM — proves mail is really yours (next point) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<your address>` | DMARC — start at `p=none` (monitor only) |

5. **Turn on DKIM:** Microsoft Defender portal (security.microsoft.com) → Email & collaboration → Policies & rules → Threat policies → Email authentication settings → DKIM. Select the new domain, add the two CNAME records it shows you at your DNS host, then switch signing **on**.
6. Sign in to the new mailbox once (outlook.office.com) and send yourself a test message, then reply to it. Check it arrives, isn't in spam, and shows the right display name. A brand-new domain has no reputation, so this is also the start of warming it up.

If you're unsure where a domain's DNS is managed, `dig NS <domain> +short` tells you (the name servers show the provider).

## Step 4 — Register the app that sends the mail

This gives the agent its own sign-in to Microsoft 365, so no one's password is involved.

1. Go to <https://entra.microsoft.com> → **Identity → Applications → App registrations → New registration**. Name it `BCS Outreach`, single tenant, no redirect URI.
2. On the overview page copy **Application (client) ID** → `OUTREACH_M365_CLIENT_ID` and **Directory (tenant) ID** → `OUTREACH_M365_TENANT_ID`.
3. **Certificates & secrets → New client secret.** Copy the **Value** (not the Secret ID) into `OUTREACH_M365_CLIENT_SECRET` straight away — it's only shown once. Secrets expire (24 months at most); put the expiry date in a calendar, because when it lapses sending stops.
4. **Do not add any API permissions here.** Step 5 grants exactly what's needed, and only for the one mailbox.

## Step 5 — Lock the app to that one mailbox (don't skip this)

Left unrestricted, a "send mail" permission lets an app send as **anyone in your company**. Microsoft's Exchange Online RBAC for Applications limits it to a single mailbox. You need to be an Exchange or global administrator. In PowerShell:

```powershell
Install-Module ExchangeOnlineManagement    # once
Connect-ExchangeOnline
```

Find the two IDs: the **Application (client) ID** from Step 4, and the **Object ID** of the same app under **Entra → Enterprise applications** (search for `BCS Outreach`). These are different numbers — use the one from Enterprise applications for `-ObjectId`.

```powershell
New-ServicePrincipal -AppId <client-id> -ObjectId <enterprise-app-object-id> -DisplayName "BCS Outreach"

New-ManagementScope -Name "BCS outreach mailbox" `
  -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'sales@bcsproducts-sales.co.uk'"

New-ManagementRoleAssignment -App <enterprise-app-object-id> -Role "Application Mail.Send" -CustomResourceScope "BCS outreach mailbox"
New-ManagementRoleAssignment -App <enterprise-app-object-id> -Role "Application Mail.Read" -CustomResourceScope "BCS outreach mailbox"
```

Then check it:

```powershell
Test-ServicePrincipalAuthorization -Identity <enterprise-app-object-id> -Resource sales@bcsproducts-sales.co.uk
Test-ServicePrincipalAuthorization -Identity <enterprise-app-object-id> -Resource <any real employee's address>
```

The first should show `InScope = True` for both roles, the second `False`. Microsoft says changes can take **30 minutes to 2 hours** to take effect in real use, though the test command shows the true state immediately.

Source: [Role Based Access Control for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

## Step 6 — Environment variables

Add each in **Vercel → your project → Settings → Environment Variables** (Production), then redeploy. For local testing put them in `.env`.

| Variable | Required | Where it comes from |
|---|---|---|
| `COMPANIES_HOUSE_API_KEY` | yes | Step 1 |
| `ANTHROPIC_API_KEY` | yes | already set for Bar Counter |
| `OUTREACH_M365_TENANT_ID` | yes | Step 4 |
| `OUTREACH_M365_CLIENT_ID` | yes | Step 4 |
| `OUTREACH_M365_CLIENT_SECRET` | yes | Step 4 |
| `OUTREACH_MAILBOX` | yes | Step 3 — the full address, e.g. `sales@bcsproducts-sales.co.uk` |
| `OUTREACH_REGISTERED_ADDRESS` | yes | Step 2 |
| `OUTREACH_COMPANY_NUMBER` | yes | Step 2 |
| `CRON_SECRET` | yes | already set for the Drive backup |
| `OUTREACH_FORWARD_TO_EMAIL` | no | default `tyler@fendersteel.co.uk` — gets a heads-up email for every reply |
| `OUTREACH_APP_URL` | no | default `https://fenderbcs.com` — used for the unsubscribe link |
| `OUTREACH_DAILY_SEND_CAP` | no | default `10` |
| `OUTREACH_DISCOVERY_BATCH_SIZE` | no | default `20` companies per SIC code per day |
| `OUTREACH_REQUIRE_APPROVAL` | no | default on. `false` sends drafts with **no human review** — don't, at least not until you've read a few dozen |

When the yellow banner on the review queue disappears, the required ones are all in.

## Step 7 — Deploy

Push to `main`. The database tables already exist, so there's nothing to migrate. Vercel picks up the two daily jobs from `vercel.json`.

## Step 8 — Test before anything real goes out

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
   Careful: this sends **every approved email** up to the daily cap, so approve nothing else first. The response shows `inbox` (what it read from the mailbox) and `send` (what it sent). Check the email arrives, the footer has your real address and company number, and the unsubscribe link works ("You're unsubscribed").
4. **Reply to it** from that address. The reply shows in the outreach mailbox at once. Run the send job again: `inbox.replies` should be 1, the lead should show **Replied**, and `OUTREACH_FORWARD_TO_EMAIL` should get a `[BCS outreach reply]` email.
5. **Unsubscribe check.** After clicking unsubscribe, approve another draft to the same address — it should fail with "suppressed", not send.

## Step 9 — Going live, gently

Leave the cap at 10 a day and approval on. Watch the **Sent** and **Failed** tabs, and read every reply. A brand-new domain is treated with suspicion by mail providers, so a low volume is what builds its reputation — raise the cap only after a couple of clean weeks. Move DMARC from `p=none` to `p=quarantine` once it's been quiet for a month. If several emails land in recipients' spam, stop and check Step 3's DKIM and DMARC records before sending more.

---

## Tuning

- **Who it targets:** `OUTREACH_SIC_CODES` in `src/lib/outreach/config.ts`. Check each code is what you think it is on Companies House before relying on it.
- **What it says:** the prompt in `src/lib/outreach/draft.ts`. The compliance footer is added separately and can't be reworded by the model.
- **Better contact hit rate:** `src/lib/outreach/contactFinder.ts` scrapes DuckDuckGo's plain HTML results, which can be blocked from server IPs. A paid search API is a drop-in improvement if too many leads come back empty.
- **Switching to Fender Steel later:** change `OUTREACH_SENDER.label`, the SIC codes and the prompt, use a separate mailbox and domain for it, and drop the `company: 'BS_SUPPLIES'` restriction on the module in `src/lib/rbac.ts`. Nothing in the tables is company-specific.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Yellow "Setup isn't finished" banner | An environment variable from Step 6 is missing, or you haven't redeployed since adding it |
| Failed: `Microsoft sign-in failed: … invalid client secret` | Wrong value pasted (use the secret's **Value**, not its ID), or the secret has expired — create a new one in Step 4 |
| Failed: `Microsoft 365 returned 403` / `ErrorAccessDenied` | Step 5 not done, not yet propagated (wait up to 2 hours), or the mailbox address doesn't match the scope filter. Run `Test-ServicePrincipalAuthorization` |
| Failed: `Microsoft 365 returned 404` / `MailboxNotFound` | `OUTREACH_MAILBOX` is mistyped, or the user has no mailbox licence |
| Failed: `OUTREACH_REGISTERED_ADDRESS and OUTREACH_COMPANY_NUMBER must both be set` | Step 2 not done — nothing was sent |
| Sends succeed but land in spam | DKIM not switched on, missing DMARC/SPF, or the domain is new — see Steps 3 and 9 |
| Discovery returns `Companies House returned 401` | Wrong or missing `COMPANIES_HOUSE_API_KEY` |
| No new leads after the first few days | Should not happen — discovery pages through results. If it does, check the `outreachOffset:*` rows in the `Setting` table |
| A reply is in the mailbox but the lead isn't marked Replied | It's picked up at the next morning run (or trigger the send job by hand). Replies from a different person at the same company are matched by domain, but not from free-mail addresses like Gmail |
| "That email has already been dealt with" when approving | Someone else approved or rejected it — refresh |

## Where things live

| What | File |
|---|---|
| Review queue, all leads | `src/app/outreach/` |
| Daily jobs | `src/app/api/cron/outreach-discover`, `outreach-send` (schedules in `vercel.json`) |
| Unsubscribe link | `src/app/api/outreach/unsubscribe/` |
| Companies House, contact finder, drafting | `src/lib/outreach/` |
| Microsoft 365 sending and reading | `src/lib/outreach/mailbox.ts` |
| Footer, suppression list, send guards | `src/lib/outreach/mail.ts` |
| Reading replies, opt-outs and bounces | `src/lib/outreach/replies.ts` |
| Tables | `Lead`, `OutreachEmail`, `OutreachSuppression` in `prisma/schema.prisma` |

import 'server-only';

/**
 * Finds a company's website and a contact email from it. Uses DuckDuckGo's
 * plain HTML search endpoint (no API key needed) to guess the website, then
 * fetches the homepage and a couple of likely contact pages and pulls out
 * an email address. This is a best-effort heuristic, not a guarantee — a
 * meaningful share of leads will come back with nothing found, and those
 * sit as NO_CONTACT_FOUND for someone to fill in by hand. Swap in a paid
 * search API (SerpApi, Bing) here later for a better hit rate; see
 * docs/OUTREACH_SETUP.md.
 */

const UA = 'Mozilla/5.0 (compatible; BCSProductsOutreach/1.0; +https://fenderbcs.com)';

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function guessWebsite(companyName: string): Promise<string | null> {
  const query = encodeURIComponent(`${companyName} official website`);
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${query}`);
  if (!html) return null;

  const linkMatches = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)];
  for (const m of linkMatches) {
    let href = m[1];
    // DuckDuckGo's HTML endpoint wraps results in a redirect URL with the
    // real target URL-encoded in `uddg`.
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, '');
      // Skip directories/aggregators that turn up for company-name searches
      // far more often than the company's own site.
      if (/(companieshouse|linkedin|facebook|yell\.com|checkatrade|endole|duedil|bloomberg|opencorporates|wikipedia)/i.test(host)) continue;
      return `${u.protocol}//${host}`;
    } catch {
      continue;
    }
  }
  return null;
}

const GENERIC_JUNK = /(sentry|wixpress|example\.com|your@email|noreply|no-reply|@2x|placeholder)/i;
const PREFERRED_PREFIX = /^(info|sales|enquiries|enquiry|contact|hello|office)@/i;

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  const mailto = [...html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map((m) => m[1]);
  const bare = [...html.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map((m) => m[1]);
  [...mailto, ...bare].forEach((e) => {
    const email = e.toLowerCase();
    if (!GENERIC_JUNK.test(email) && !email.endsWith('.png') && !email.endsWith('.jpg')) found.add(email);
  });
  return [...found];
}

export async function findContactEmail(website: string): Promise<string | null> {
  const homepage = await fetchText(website);
  const candidates: string[] = [];
  if (homepage) candidates.push(...extractEmails(homepage));

  if (!candidates.some((e) => PREFERRED_PREFIX.test(e))) {
    for (const path of ['/contact', '/contact-us', '/contact-us.html', '/about/contact']) {
      const page = await fetchText(`${website.replace(/\/$/, '')}${path}`);
      if (page) candidates.push(...extractEmails(page));
      if (candidates.some((e) => PREFERRED_PREFIX.test(e))) break;
    }
  }

  if (candidates.length === 0) return null;
  const preferred = candidates.find((e) => PREFERRED_PREFIX.test(e));
  return preferred ?? candidates[0];
}

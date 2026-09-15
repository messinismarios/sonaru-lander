/**
 * Checks that the live site's URLs are the URLs it serves - SEO audit C1 (2026-09-15).
 *
 *     npm run check:production                # https://sonaru.app
 *     npm run check:production -- <origin>    # a preview, or `npx wrangler pages dev dist`
 *
 * The sitemap always names `https://sonaru.app`; with another origin each URL is requested
 * there instead, and the canonical is still expected to name the production URL.
 *
 * **What a build cannot show.** `dist/` proved that every canonical, sitemap entry and link
 * said `/pricing`; it took production to show Cloudflare Pages answering that URL with a 308
 * to `/pricing/`. So every claim here is made against a real response, redirects not
 * followed, because a redirect that resolves to a 200 is exactly the defect being guarded:
 *
 * - every sitemap `<loc>` returns **200**, not a redirect;
 * - every page's `<link rel="canonical">` is **its own sitemap URL**;
 * - every internal `<a href>` on those pages returns **200**;
 * - every RSS item `<link>` returns **200**.
 *
 * `.github/workflows/production-check.yml` runs it after each production deploy.
 */

const origin = new URL(process.argv[2] ?? 'https://sonaru.app').origin;
const headers = { 'user-agent': 'sonaru-production-check' };

const failures = [];
/** Every status already fetched, so a link on fourteen footers is requested once. */
const statuses = new Map();

async function get(url) {
  const response = await fetch(url, { redirect: 'manual', headers });
  statuses.set(url, response.status);
  return response;
}

async function expect200(url, from) {
  const status = statuses.get(url) ?? (await get(url)).status;
  if (status !== 200) failures.push(`${url} returned ${status} (${from})`);
  return status === 200;
}

async function text(url, from) {
  const response = await get(url);
  if (response.status !== 200) {
    failures.push(`${url} returned ${response.status} (${from})`);
    return null;
  }
  return response.text();
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
/** The same path on the origin being checked. */
const here = (url) => new URL(new URL(url).pathname, origin).href;

const index = await text(`${origin}/sitemap-index.xml`, 'sitemap index');
const pages = [];
for (const chunk of index ? locs(index) : []) {
  const xml = await text(here(chunk), 'sitemap-index.xml');
  if (xml) pages.push(...locs(xml));
}
if (index && pages.length === 0) failures.push('the sitemap lists no pages');

for (const page of pages) {
  const html = await text(here(page), 'sitemap');
  if (html === null) continue;

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical !== page) failures.push(`${page} has canonical ${canonical ?? '(none)'}`);

  const links = [...html.matchAll(/<a\s[^>]*href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const href of new Set(links)) {
    /* A file is a download or an asset, not a page with a canonical form. */
    if (/\.[a-z0-9]+$/i.test(href)) continue;
    await expect200(new URL(href, origin).href, `linked from ${page}`);
  }
}

const feed = await text(`${origin}/blog/rss.xml`, 'feed');
for (const [, link] of feed?.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g) ?? []) {
  await expect200(here(link), 'RSS item');
}

/*
 * **One host, one scheme** - SEO audit C2. `www.sonaru.app` served the whole site as a
 * duplicate. Every other entry point must end on the apex through permanent redirects only,
 * keeping path and query. Production only: a preview or a local server has no `www`.
 */
const APEX = 'https://sonaru.app';
if (origin === APEX) {
  const target = `${APEX}/pricing?ref=production-check`;
  for (const start of [
    'http://sonaru.app/pricing?ref=production-check',
    'https://www.sonaru.app/pricing?ref=production-check',
    'http://www.sonaru.app/pricing?ref=production-check',
  ]) {
    let url = start;
    for (let hop = 0; hop < 3 && url !== target; hop++) {
      const response = await fetch(url, { redirect: 'manual', headers });
      const location = response.headers.get('location');
      if (response.status !== 301 || location === null) {
        failures.push(`${url} returned ${response.status}, not a 301 (from ${start})`);
        break;
      }
      url = new URL(location, url).href;
    }
    if (url !== target && !failures.some((f) => f.endsWith(`(from ${start})`))) {
      failures.push(`${start} does not redirect to ${target}`);
    }
  }
}

/*
 * **Headers a build can only promise** - SEO audit M2 and L3. `tests/unit/security-headers.spec.ts`
 * checks `dist/_headers`; this checks Pages actually serves them.
 */
const home = await text(`${origin}/`, 'home');
const stylesheet = home?.match(/href="(\/_astro\/[^"]+\.css)"/)?.[1];
if (home && !stylesheet) failures.push('the home page links no /_astro/ stylesheet');
if (stylesheet) {
  const cache = (await get(`${origin}${stylesheet}`)).headers.get('cache-control') ?? '(none)';
  if (!cache.includes('max-age=31536000') || !cache.includes('immutable')) {
    failures.push(`${stylesheet} is cached as "${cache}", not a year immutable`);
  }
}
const aasa = await get(`${origin}/.well-known/apple-app-site-association`);
const aasaType = aasa.headers.get('content-type') ?? '(none)';
if (aasa.status !== 200 || !aasaType.startsWith('application/json')) {
  failures.push(`apple-app-site-association returned ${aasa.status} as ${aasaType}`);
}
/* SEO audit L1 and L8: files clients request by name, which a 404 page would answer as HTML. */
for (const [path, type] of [
  ['/favicon.ico', 'image/'],
  ['/.well-known/security.txt', 'text/plain'],
]) {
  const response = await get(`${origin}${path}`);
  const served = response.headers.get('content-type') ?? '(none)';
  if (response.status !== 200 || !served.startsWith(type)) {
    failures.push(`${path} returned ${response.status} as ${served}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.length} problem(s) on ${origin}:\n`);
  for (const failure of failures) process.stderr.write(`  ${failure}\n`);
  process.exit(1);
}
process.stdout.write(
  `${origin}: ${pages.length} sitemap pages and ${statuses.size} URLs checked, all 200 with matching canonicals\n`,
);

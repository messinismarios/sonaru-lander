import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCALE, LOCALES, PUBLISHED_LOCALES, hasCatalogue } from '../../src/i18n';
import { localePath } from '../../src/i18n/routing';
import { ROUTES, isShippingRoute } from '../visual/routes';

/**
 * The Spanish route tree, against the build - phases.md 8.11b.
 *
 * **Against `dist/`, not the dev server**, for 8.10c's reason: every claim here is about
 * shipped bytes. Three of them cannot be made any other way - the sitemap and `robots.txt`
 * do not exist under `astro dev` at all, and `dist/es/404.html` is written by a build hook.
 *
 * `npm run verify` builds before it tests, so this reads a fresh `dist`.
 */

const ROOT = new URL('../../', import.meta.url);
const DIST = new URL('dist/', ROOT);

function built(path: string): string {
  const file = fileURLToPath(new URL(path, DIST));
  if (!existsSync(file)) throw new Error(`dist/${path} is missing - run \`npm run build\`.`);
  return readFileSync(file, 'utf8');
}

/**
 * The locales this build actually emits a prefixed tree for - 8.11e.
 *
 * **Empty while `es` is withheld**, which makes two of the tests below cover nothing. That is
 * deliberate and it is not silent: `tests/unit/withheld-locales.spec.ts` asserts the absence
 * positively, and these come back the moment the array does.
 */
const PREFIXED = PUBLISHED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/* The English tree. Derived from the prefixes rather than matching `/es` by hand, which is
 * the narrowing `tests/visual/routes.ts` has been bitten by three times. */
const SHIPPING = ROUTES.filter(
  (route) => isShippingRoute(route) && !PREFIXED.some((locale) => route.startsWith(`/${locale}/`)),
);

test('every shipping route exists in every locale', () => {
  // Discovery, not a list: a route added to `src/pages/[...locale]/` is covered the moment
  // the file exists, and one added outside it fails here rather than being forgotten.
  const missing: string[] = [];
  for (const locale of PREFIXED) {
    for (const route of SHIPPING) {
      if (!ROUTES.includes(localePath(locale, route))) missing.push(localePath(locale, route));
    }
  }
  expect(missing).toEqual([]);
});

test('no development-only route has a translation', () => {
  // A tool 8.13 deletes does not get a Spanish twin. The failure this catches is a dev route
  // moved under `[...locale]` by habit, which would ship /es/kit to a stranger.
  const translated = ROUTES.filter((route) => route.startsWith('/es/') && !isShippingRoute(route));
  expect(translated).toEqual([]);
});

test('the English tree is exactly where it was', () => {
  // 8.11b moves seventeen page files one directory deeper. Not one URL may move with them:
  // /privacy and /terms are filed with App Store Connect and linked from the iOS app.
  for (const route of ['/', '/pricing', '/privacy', '/terms', '/support', '/blog', '/changelog']) {
    const path = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
    expect(() => built(path), `dist/${path}`).not.toThrow();
  }
});

test('each prefixed locale has a 404.html where Pages will look for it', () => {
  /*
   * Astro special-cases only the root `404.astro` into `dist/404.html` - measured at Gate B,
   * and true whichever way the Spanish one is authored. Cloudflare Pages serves the nearest
   * `404.html` walking up the path, so without this file a mistyped Spanish URL gets the
   * English 404: built correctly, served wrongly. `scripts/locale-404.mjs` writes it.
   */
  for (const locale of PREFIXED) {
    const html = built(`${locale}/404.html`);
    expect(html, `dist/${locale}/404.html`).toContain(`<html lang="${locale}"`);
    expect(html, 'the 404 must stay out of the index').toContain('noindex');
  }
});

test('the sitemap is one file per locale under an index', () => {
  // superlist's shape, measured at Gate A. The integration's default is numbered files split
  // by size; `chunks` in astro.config.mjs is what makes them per-locale.
  const index = built('sitemap-index.xml');
  for (const locale of LOCALES) {
    const chunk = `sitemap-${locale}-0.xml`;
    /*
     * **Two conditions, and a locale needs both.** A locale with no catalogue contributes no
     * URLs, because until it has words its pages canonicalise to the English ones and a
     * sitemap lists canonical pages. And a **withheld** locale (8.11e) emits no page at all,
     * so there is nothing to list either way. `es` fails both today; keeping the loop over
     * every *declared* locale is what makes the absence an assertion rather than a gap.
     */
    const listed = hasCatalogue(locale) && PUBLISHED_LOCALES.includes(locale);
    expect(index.includes(chunk), `${chunk} in the index`).toBe(listed);
  }
});

test('the sitemap lists shipping pages only, and no URL it lists is a tool', () => {
  const urls = [...built('sitemap-en-0.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(urls.length).toBeGreaterThan(10);
  const paths = urls.map((url) => new URL(url).pathname);
  const tools = paths.filter((path) => !isShippingRoute(path.replace(/(.)\/$/, '$1')));
  expect(tools, 'the first sitemap this site built listed all nine of them').toEqual([]);
});

test('no URL in the sitemap carries a trailing slash the canonical disclaims', () => {
  /*
   * `Base.astro` strips it, because `trailingSlash: 'ignore'` serves both forms. The
   * integration emits `/pricing/` - so without `serialize` the sitemap advertises a URL the
   * page itself points away from, which is what a search engine dedupes on.
   */
  const urls = [...built('sitemap-en-0.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  /* The root keeps its slash, exactly as the canonical does - `/` is the one path where
   * stripping it would leave no path at all. */
  const slashed = urls.filter((url) => new URL(url).pathname !== '/' && url.endsWith('/'));
  expect(slashed).toEqual([]);
});

test('robots.txt points at the sitemap index and forbids nothing', () => {
  const robots = built('robots.txt');
  expect(robots).toContain('Sitemap: https://sonaru.app/sitemap-index.xml');
  /* A Disallow list is a published list of the pages we would rather you did not look at,
   * which is an invitation. The dev-only routes are kept out of the sitemap instead.
   * Asserted on directive lines rather than on the text, since the file's own comment
   * explains this and would otherwise fail the test that checks it. */
  const directives = robots.split('\n').filter((line) => /^\s*Disallow:/i.test(line));
  expect(directives).toEqual([]);
});

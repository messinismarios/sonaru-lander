import { expect, test } from '@playwright/test';
import { DEFAULT_LOCALE, LOCALES, PUBLISHED_LOCALES, WITHHELD_LOCALES } from '../../src/i18n';
import { isShippingRoute } from '../../src/data/routes';

/**
 * A locale you are in is a locale you stay in - phases.md 8.11b, Gate C rev 3.
 *
 * **The defect this was written for shipped and the owner caught it.** Every link on every
 * `/es/` page pointed at the unprefixed English route, so a visitor who switched language
 * was thrown back to English by the next thing they clicked. The switcher was the only
 * locale-aware link on the site, because `localePath()` had exactly one caller.
 *
 * The fix is `src/middleware.ts` and not a change at the call sites, because there is no
 * single call site: `src/data/nav.ts` feeds the footer, `Button` and `Link` take an `href`
 * prop, eighteen raw `<a>` tags are authored directly in components and pages, and blog
 * posts are MDX where the author writes markdown links. A rule applied in the primitives
 * would have missed most of those, and - the part that matters - it would have missed them
 * *silently*, which is the failure mode this suite exists to prevent.
 */

/**
 * **Empty while `es` is withheld** - 8.11e - which means this file walks nothing today.
 *
 * A spec file that covers nothing is a trap, so the test below gives the emptiness a subject:
 * every prefixed locale is either walked here or is on the withheld list, and a locale that
 * stops routing for any *other* reason fails rather than quietly removing this file's job.
 */
const PREFIXED = PUBLISHED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

test('every prefixed locale is either walked here or deliberately withheld', () => {
  const unaccounted = LOCALES.filter(
    (locale) =>
      locale !== DEFAULT_LOCALE &&
      !PREFIXED.includes(locale) &&
      !(WITHHELD_LOCALES as readonly string[]).includes(locale),
  );
  expect(unaccounted, 'a locale stopped routing and nothing says why').toEqual([]);
});

/** Routes worth walking: enough shape to cover nav, prose, assets and the blog. */
const SAMPLE = ['/', '/pricing', '/press', '/brand', '/blog', '/blog/what-is-sonaru'];

for (const locale of PREFIXED) {
  test(`every internal link on a /${locale}/ page keeps the locale`, async ({ page }) => {
    for (const route of SAMPLE) {
      await page.goto(`/${locale}${route === '/' ? '' : route}`);
      const stray = await page.evaluate(
        ([prefix]) =>
          [...document.querySelectorAll('a[href]')]
            // The switcher is the one element whose whole job is to leave the locale.
            .filter((a) => !a.closest('.locales'))
            .map((a) => a.getAttribute('href') ?? '')
            // Only site-internal, page-shaped links are in scope. A file is served from one
            // place in any language, and an anchor, a mailto and an external host are not
            // ours to prefix.
            .filter((href) => href.startsWith('/') && !href.startsWith('//'))
            .filter((href) => !/\.[a-z0-9]+$/i.test(href.split(/[?#]/)[0] ?? ''))
            .filter((href) => href !== `/${prefix}` && !href.startsWith(`/${prefix}/`)),
        [locale] as const,
      );
      expect(stray, `unprefixed links on /${locale}${route}`).toEqual([]);
    }
  });

  test(`a link followed from /${locale}/ lands on a page still in /${locale}/`, async ({
    page,
  }) => {
    // The assertion the unit failed in practice: not what the markup says, but where a
    // click actually puts you, and what language the page you land on is in.
    await page.goto(`/${locale}/pricing`);
    await page.locator('footer a', { hasText: 'Changelog' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/changelog$`));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });
}

test('the default locale is untouched, and nothing gained a prefix it should not have', async ({
  page,
}) => {
  /*
   * The other half: `en` is unprefixed at the apex, so a rewrite that fires on English
   * pages would break every link on the site. This fails if the middleware stops checking
   * which locale it is in.
   */
  await page.goto('/pricing');
  // Every link except the switcher's own, which points across locales by definition and is
  // the one anchor on an English page that is *supposed* to carry the prefix.
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .filter((a) => !a.closest('.locales'))
      .map((a) => a.getAttribute('href') ?? ''),
  );
  /* Every declared non-default prefix, not a hardcoded `es`, so a withheld locale's prefix
   * is caught here too - a link to a tree that is not built is a 404 rather than a mirror. */
  const prefixes = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
  const prefixed = hrefs.filter((href) =>
    prefixes.some((locale) => new RegExp(`^/${locale}(/|$)`).test(href)),
  );
  expect(prefixed).toEqual([]);
  expect(hrefs).toContain('/changelog');
});

test('assets, anchors and external links are never prefixed', async ({ page }) => {
  /*
   * `/press` is the route that proves it: it links a zip, a PDF, full-size screenshots, a
   * `mailto:` and two ordinary pages from the same document. A rewrite that cannot tell
   * them apart takes the downloads down with it, and a 404 on a press kit is found by a
   * journalist rather than by us.
   */
  test.skip(
    PREFIXED.length === 0,
    'no locale is published under a prefix - every prefixed locale is withheld (8.11e)',
  );
  await page.goto(`/${PREFIXED[0]}/press`);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''),
  );
  for (const href of hrefs.filter((h) => /\.[a-z0-9]+$/i.test(h.split(/[?#]/)[0] ?? ''))) {
    expect(href, 'a file is served from one place in any language').not.toMatch(
      new RegExp(`^/${PREFIXED[0]}/`),
    );
  }
  expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(true);
  expect(hrefs.filter((h) => h.startsWith('mailto:/'))).toEqual([]);
});

test('the rewrite covers prose links inside a post, not just the chrome', async ({ page }) => {
  /*
   * Blog posts are MDX: their links are written as markdown by an author who will never
   * think about locales, which is the strongest argument for doing this centrally.
   */
  test.skip(
    PREFIXED.length === 0,
    'no locale is published under a prefix - every prefixed locale is withheld (8.11e)',
  );
  await page.goto(`/${PREFIXED[0]}/blog/what-is-sonaru`);
  const inArticle = await page.evaluate(() =>
    [...document.querySelectorAll('article a[href^="/"]')].map((a) => a.getAttribute('href') ?? ''),
  );
  for (const href of inArticle.filter((h) => !/\.[a-z0-9]+$/i.test(h.split(/[?#]/)[0] ?? ''))) {
    expect(href).toMatch(new RegExp(`^/${PREFIXED[0]}(/|$)`));
  }
});

test('every shipping route is reachable under a prefix without changing any link', () => {
  // A guard on the premise rather than on the output: the rewrite is only safe because a
  // route is the same path in every locale (Gate A - English path segments under the prefix).
  expect(isShippingRoute('/pricing')).toBe(true);
  expect(isShippingRoute('/kit')).toBe(false);
});

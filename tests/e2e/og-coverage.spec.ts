import { test, expect } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';
import { DEFAULT_LOCALE, hasCatalogue } from '../../src/i18n';
import { localePath, splitLocale } from '../../src/i18n/routing';
import { isShippingRoute } from '../../src/data/routes';
import { ROUTE_CARDS } from '../../src/data/og-cards';

/**
 * Every route unfurls with a card - phases.md 8.10a.
 *
 * **This guard exists because the gap it closes was invisible.** Before 8.10a exactly
 * three routes emitted an `og:image`, all of them blog posts, and the other twelve emitted
 * none - including `/` and `/waitlist`, the two routes whose entire job is conversion. No
 * test failed, no build went red, and nothing looked wrong from inside the site: a bare
 * `<head>` is only visible in somebody else's timeline. It was found by reading the
 * markup, which is not a mechanism.
 *
 * It runs against the **rendered** page rather than the source, because that is the only
 * place a layout, a page and a head slot are all resolved together - and the specific bug
 * worth catching is two of them each contributing an `og:image`.
 *
 * Camera stands are excluded: they render no `Base` at all, deliberately, because whatever
 * is in the document ends up in the photograph.
 */
const PAGES = ROUTES.filter((route) => !isCameraStand(route));

/**
 * The tags a route may emit **exactly once**.
 *
 * *Exactly*, not *at least*. The direction that matters is the duplicate: `/blog/[slug]`
 * emitted its own `og:title`, `og:description`, `og:image` and `og:url` by hand until
 * 8.10a moved them into `Base`, and a half-finished cleanup leaves a page with two of
 * each. Scrapers pick one without saying which, so the wrong card renders and the site
 * looks fine.
 */
const SINGLETONS = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:image:alt',
] as const;

const SITE = 'https://sonaru.app';

test.describe('social cards', () => {
  for (const route of PAGES) {
    test(`${route} carries exactly one complete card`, async ({ page }) => {
      await page.goto(route);

      for (const property of SINGLETONS) {
        const values = await page
          .locator(`head meta[property="${property}"]`)
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') ?? ''));

        expect(values, `${route} should have one ${property}`).toHaveLength(1);
        expect(values[0]?.trim(), `${route}'s ${property} should not be empty`).not.toBe('');
      }

      await expect(page.locator('head meta[name="twitter:card"]')).toHaveCount(1);
      /* The 404 is noindex and names no canonical at all - SEO audit L2. */
      const indexed = splitLocale(route).path !== '/404';
      await expect(page.locator('head link[rel="canonical"]')).toHaveCount(indexed ? 1 : 0);
    });

    test(`${route}'s card URLs are absolute`, async ({ page }) => {
      await page.goto(route);

      /*
       * A scraper does not resolve a relative URL against the page it found it on, so a
       * relative `og:image` is a card that silently does not render. This is the assertion
       * that would have caught it, and it cannot be checked by looking at the site.
       */
      const image = await page.locator('head meta[property="og:image"]').getAttribute('content');
      expect(image, `${route}'s og:image should be absolute`).toMatch(new RegExp(`^${SITE}/`));
      if (splitLocale(route).path === '/404') return;

      const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${route}'s canonical should be absolute`).toMatch(new RegExp(`^${SITE}`));

      /*
       * And it must name *this* route. A canonical that points somewhere else is how a
       * page removes itself from an index - the failure is total and entirely silent.
       * `Base` strips the trailing slash for this reason; the root keeps its own.
       */
      /*
       * **8.11b: the expectation is the page's *canonical* route, not its own.** A page whose
       * words are not in its own language points at its English twin (Gate A, and
       * `Base.astro` has the rule) - so between 8.11b and 8.11c every `/es/` page does. This
       * derives the same answer from the same predicate rather than exempting those routes:
       * the day `es` has a catalogue, `hasCatalogue` flips and this starts demanding that
       * each Spanish page be its own canonical, with nothing edited here.
       */
      const { locale, path } = splitLocale(route);
      const canonicalRoute = hasCatalogue(locale) ? route : localePath(DEFAULT_LOCALE, path);
      const expected = canonicalRoute === '/' ? `${SITE}/` : `${SITE}${canonicalRoute}`;
      expect(canonical).toBe(expected);
    });
  }

  test('a route names its own card, and the rest fall back to the site card', async ({ page }) => {
    await page.goto('/');
    const home = await page.locator('head meta[property="og:image"]').getAttribute('content');
    expect(home).toBe(`${SITE}/og/site.jpg`);

    /*
     * **SEO audit M12 reversed half of 8.10a's rule, and this is the half that changed.**
     * The five routes people actually share carry their own picture; everything else still
     * borrows the site's, which is what keeps a new route covered by default. The direction
     * worth guarding is unchanged - a page must never point at a card that is not its own.
     */
    for (const card of ROUTE_CARDS) {
      await page.goto(card.route);
      const image = await page.locator('head meta[property="og:image"]').getAttribute('content');
      expect(image, `${card.route} carries its own card`).toBe(`${SITE}/og/${card.slug}.jpg`);
    }

    const shared = PAGES.filter(
      (route) => splitLocale(route).path === '/support' || splitLocale(route).path === '/privacy',
    );
    for (const route of shared) {
      await page.goto(route);
      const image = await page.locator('head meta[property="og:image"]').getAttribute('content');
      expect(image, `${route} falls back to the site card`).toBe(home);
    }

    /*
     * The other half of the same rule, and the one a "share the default everywhere"
     * refactor would quietly break: a post keeps the cover generated from its own
     * frontmatter. Both reference sites were measured doing exactly this at Gate A.
     */
    /*
     * `isShippingRoute`, because `/blog/lab` is a dev-only page under the same prefix. It
     * was never picked while a seed post sorted ahead of `lab`; `what-is-sonaru` does not.
     */
    const post = PAGES.find(
      (route) =>
        route.startsWith('/blog/') && !route.startsWith('/blog/tags/') && isShippingRoute(route),
    );
    expect(post, 'there should be at least one post to check').toBeDefined();
    await page.goto(post as string);
    const cover = await page.locator('head meta[property="og:image"]').getAttribute('content');
    expect(cover, 'a post carries its own cover').not.toBe(home);
    expect(await page.locator('head meta[property="og:type"]').getAttribute('content')).toBe(
      'article',
    );
  });
});

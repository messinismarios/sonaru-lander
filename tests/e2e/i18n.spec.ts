import { expect, test } from '@playwright/test';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  PUBLISHED_LOCALES,
  hasCatalogue,
} from '../../src/i18n';
import { localePath } from '../../src/i18n/routing';

/**
 * What a visitor and a crawler meet in each locale - phases.md 8.11b.
 *
 * The build-output half is `tests/unit/i18n-routes.spec.ts`. This is the half that needs a
 * rendered page: the head's alternates, the mirror rule, and the switcher.
 */

/**
 * **The prefixed locales this build emits** - 8.11e, and empty while `es` is withheld.
 *
 * The tests below split on which question they ask. Anything about *a page that exists* walks
 * `PUBLISHED_LOCALES`; anything about *what the head claims* walks `LOCALES`, so that a
 * withheld locale is asserted absent rather than skipped over. The switcher's own tests
 * `test.skip` themselves with a reason, which is how a dormant assertion stays visible in the
 * report instead of disappearing from it.
 */
const PREFIXED = PUBLISHED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
/* One conversion route, one content route, one long-form document - enough shapes to catch a
 * layout that opts out of the rule, without walking all 34 twice. */
const SAMPLE = ['/', '/pricing', '/blog', '/privacy'] as const;

test('each locale declares its own language on <html>', async ({ page }) => {
  for (const locale of PUBLISHED_LOCALES) {
    await page.goto(localePath(locale, '/pricing'));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  }
});

test('hreflang names only the locales that actually have words', async ({ page }) => {
  /*
   * The one hreflang error Search Console reports loudly is an alternate that is not really
   * in that language. Between 8.11b and 8.11c every /es/ page is the English page at a
   * second address, so it must not be advertised as Spanish - and the day `es` lands in the
   * catalogue this assertion starts requiring the opposite, with no edit here.
   */
  for (const route of SAMPLE) {
    await page.goto(route);
    for (const locale of LOCALES) {
      const alternate = page.locator(`link[rel="alternate"][hreflang="${locale}"]`);
      /* Words **and** a published tree. A withheld locale has no page to point an alternate
       * at, which is the same error as pointing one at an untranslated page. */
      const claimed = hasCatalogue(locale) && PUBLISHED_LOCALES.includes(locale);
      await expect(alternate, `${route}: hreflang=${locale}`).toHaveCount(claimed ? 1 : 0);
    }
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  }
});

test('x-default and every alternate point at a real page', async ({ page, request }) => {
  await page.goto('/pricing');
  const hrefs = await page
    .locator('link[rel="alternate"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    // Against the dev server, so the origin is swapped for the one under test.
    const response = await request.get(new URL(href).pathname);
    expect(response.status(), href).toBe(200);
  }
});

test('a page whose words are not in its own language says so', async ({ page }) => {
  /*
   * Gate A's rule, and the whole of the mitigation the owner was given when they chose to
   * serve English at the Spanish URL rather than 404: the chrome is Spanish, `<main lang>`
   * is English, so a screen reader switches voice at the body and back. Nobody sighted can
   * see this, which is exactly why it is a test.
   */
  for (const locale of PREFIXED.filter((candidate) => !hasCatalogue(candidate))) {
    await page.goto(localePath(locale, '/pricing'));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('main')).toHaveAttribute('lang', DEFAULT_LOCALE);
    // And it points home rather than claiming to be the canonical version of itself.
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/pricing$/);
    await expect(canonical).not.toHaveAttribute('href', /\/es\//);
  }
});

test('the share card is tagged with the language of the words, not of the address', async ({
  page,
}) => {
  /*
   * `og:locale` follows the body (owner, 8.11b Gate C rev 4). A share card quotes the page's
   * title and description, which on a mirror page are English, so tagging the card `es` would
   * tell every scraper that an English paragraph is Spanish. It was the last tag on an `/es/`
   * page still claiming a language the page does not speak.
   *
   * Asserted against `hasCatalogue` rather than hardcoded, so it keeps meaning the same thing
   * at 8.11c when the two values converge instead of needing to be rewritten.
   */
  for (const locale of PUBLISHED_LOCALES) {
    await page.goto(localePath(locale, '/pricing'));
    const expected = hasCatalogue(locale) ? locale : DEFAULT_LOCALE;
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', expected);
  }
});

test('a page in its own language carries no override on <main>', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('main')).not.toHaveAttribute('lang', /./);
});

test('the switcher is in the footer and names every published locale once', async ({ page }) => {
  test.skip(
    PUBLISHED_LOCALES.length < 2,
    'one published locale: the switcher does not render at all - 8.11e',
  );
  await page.goto('/pricing');
  const switcher = page.locator('footer .locales');
  await expect(switcher).toBeVisible();
  for (const locale of PUBLISHED_LOCALES) {
    await expect(switcher.getByText(LOCALE_NAMES[locale], { exact: true })).toHaveCount(1);
  }
});

test('one published language means no switcher at all, not a switcher of one', async ({ page }) => {
  /*
   * **The other side of the same rule, and the one that is live today** - 8.11e. A control
   * showing a single language name asks to be clicked and cannot be, and an empty `<ul>` would
   * still take the `.identity` row's flex gap. So the element is absent, not disabled.
   */
  test.skip(PUBLISHED_LOCALES.length > 1, 'more than one language is published');
  await page.goto('/pricing');
  await expect(page.locator('footer .locales')).toHaveCount(0);
});

test('the current language is marked and is not a link to where you already are', async ({
  page,
}) => {
  test.skip(
    PUBLISHED_LOCALES.length < 2,
    'one published locale: the switcher does not render at all - 8.11e',
  );
  for (const locale of PUBLISHED_LOCALES) {
    await page.goto(localePath(locale, '/pricing'));
    const current = page.locator('footer .locales [aria-current="true"]');
    await expect(current).toHaveText(LOCALE_NAMES[locale]);
    await expect(current).toHaveAttribute('lang', locale);
    expect(await current.evaluate((node) => node.tagName)).not.toBe('A');
  }
});

test('every locale but the current one is a link, translated or not', async ({ page }) => {
  /*
   * **Reversed at 8.11b's Gate C, on the owner's call, and the reason is worth keeping.**
   *
   * This test used to assert the opposite: a locale with no catalogue rendered as inert text,
   * on `Footer.astro`'s `live`/pending idiom from 8.9a. That followed 8.11b's Gate A, and it
   * made the switcher **one-way** - a visitor lands on English, and the only direction they
   * would ever use was the dead one, which left all 21 `/es/` pages this unit builds reachable
   * only by typing the URL. The owner met that at Gate C and called it broken, correctly.
   *
   * The argument it overturns was that offering *Español* would advertise a language and
   * deliver English. That risk is real and is already answered four times over on the page
   * itself - canonical points at the English twin, no `es` alternate is emitted, the page stays
   * out of the Spanish sitemap, and `<main lang="en">` switches a screen reader's voice at the
   * body. The inert span was a fifth guard on top of those and the only one that cost a
   * visitor anything. **Nothing here changes when 8.11c writes Spanish**, which is the point:
   * the switcher stops being a thing that reverses on catalogue state.
   */
  test.skip(
    PUBLISHED_LOCALES.length < 2,
    'one published locale: the switcher does not render at all - 8.11e',
  );
  await page.goto('/pricing');
  for (const locale of PREFIXED) {
    const entry = page.locator('footer .locales').getByText(LOCALE_NAMES[locale], { exact: true });
    expect(await entry.evaluate((node) => node.tagName)).toBe('A');
    await expect(entry).toHaveAttribute('href', `/${locale}/pricing`);
  }
});

test('the switcher reaches a locale that has no words yet, and it is still marked', async ({
  page,
}) => {
  /*
   * The other half of the same decision: the link is live, so what it lands on has to be
   * honest. `Base.astro` already does that work - this pins the two ends together so the
   * live link and the mirror marking cannot drift apart.
   */
  test.skip(
    PUBLISHED_LOCALES.length < 2,
    'one published locale: the switcher does not render at all - 8.11e',
  );
  await page.goto('/pricing');
  await page.locator('footer .locales a', { hasText: LOCALE_NAMES['es'] }).click();
  await expect(page).toHaveURL(/\/es\/pricing$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('main')).toHaveAttribute('lang', DEFAULT_LOCALE);
});

test('switching locale keeps the route, and carries the language to the reader', async ({
  page,
}) => {
  // The switcher failure everyone has met is landing on the other language's home page.
  test.skip(
    PUBLISHED_LOCALES.length < 2,
    'one published locale: the switcher does not render at all - 8.11e',
  );
  await page.goto('/es/pricing');
  const back = page.locator('footer .locales a');
  await expect(back).toHaveAttribute('hreflang', DEFAULT_LOCALE);
  await expect(back).toHaveAttribute('lang', DEFAULT_LOCALE);
  await back.click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_LOCALE);
});

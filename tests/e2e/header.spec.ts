import { expect, test } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * The header's scrim - added at 8.9c's Gate C rev 2.
 *
 * The header has been `position: fixed` with no background since 8.2, so every page's
 * content has always passed underneath it. Nothing showed it until the blog, whose covers
 * are 700px images carrying their own white display type: the wordmark and a post's hook
 * met at the same size, in the same colour, on the same pixels. The owner caught it.
 *
 * The scrim is driven by `animation-timeline: scroll()`, which is CSS - no JavaScript, so
 * the blog routes keep the zero-byte budget `blog.spec.ts` asserts. These are the
 * properties a screenshot cannot check: that it is genuinely absent at the top of the page,
 * genuinely present once content is under it, and that it does not quietly become a
 * permanent dark band under reduced motion.
 *
 * **The home route has no scrim at `md` and up** (owner, 8.9e's Gate C). It is the one page
 * this was never for - a full-bleed composition rather than a column, where the band is
 * legible as a band. **Below `md` it has one** (owner, 8.14c round 5: the logo and action
 * overlap the acts' content on a phone). That exception is asserted here in both directions
 * and at both widths, because it is a rule about one route among many and the next route
 * added is the one that gets it wrong.
 */

/** The camera stands render no header at all - see `footer.spec.ts` for the same exclusion. */
const PAGES = ROUTES.filter((route) => !isCameraStand(route));

async function scrimOpacity(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const header = document.querySelector('.site-header');
    if (header === null) return -1;
    return Number.parseFloat(getComputedStyle(header, '::before').opacity);
  });
}

/**
 * Scroll, then wait for the scrim itself rather than for `scrollY`.
 *
 * A scroll-driven animation resolves on the frame *after* the scroll position changes, so
 * waiting on `scrollY` returns while the opacity is still the old value. It passed alone
 * and failed inside a full run, which is the signature of exactly that race and not of a
 * design defect - the kind of flake that gets a real guard deleted for being unreliable.
 */
async function scrollAndSettle(page: import('@playwright/test').Page, to: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo(0, y), to);
  await page.waitForFunction(() => {
    const header = document.querySelector('.site-header');
    if (header === null) return false;
    return Number.parseFloat(getComputedStyle(header, '::before').opacity) > 0.98;
  });
}

test('the scrim is absent at the top of the page and present once content is under it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/blog');
  await page.evaluate(() => document.fonts.ready);

  expect(await scrimOpacity(page), 'at rest the header must not darken anything').toBeLessThan(
    0.02,
  );

  await scrollAndSettle(page, 400);
  expect(
    await scrimOpacity(page),
    'once the page has scrolled the wordmark needs a ground',
  ).toBeGreaterThan(0.98);
});

test('the scrim still tracks scroll under reduced motion', async ({ page }) => {
  /*
   * `design-system.md` §5 replaces a scrubbed signal with its final state under reduced
   * motion. That rule is deliberately not applied here, and this test is what stops someone
   * applying it later: pinning the scrim on darkens the top 120px of a route **at rest**,
   * where there is nothing behind it - measured at 8.9c as 38,000-168,000 changed pixels
   * across fifteen frozen baselines. Nothing here moves, so there is no motion to reduce.
   *
   * **On `/privacy`, not `/`.** This ran on the home route until 8.9e removed the scrim
   * there; running it on a page that no longer has one would have asserted nothing while
   * still passing its first expectation.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/privacy');
  await page.evaluate(() => document.fonts.ready);

  expect(await scrimOpacity(page), 'reduced motion must not darken the page at rest').toBeLessThan(
    0.02,
  );

  await scrollAndSettle(page, 400);
  expect(await scrimOpacity(page)).toBeGreaterThan(0.98);
});

/*
 * There is deliberately no "the scrim costs no JavaScript" test here.
 *
 * It was written and deleted: under `astro dev` the page loads Vite's client and the dev
 * toolbar's entrypoint, so a strict zero-script assertion fails for reasons that have
 * nothing to do with the header, and filtering those out by name would leave an assertion
 * that passes whatever the header does. The checkable claim is the one
 * `blog.spec.ts` already makes - that no blog route pulls GSAP, ScrollTrigger or Lenis -
 * and the scrim being CSS is visible in `Header.astro` rather than provable from here.
 */

test('every route except the home page renders its scrim on desktop', async ({ page }) => {
  // The header is one component on every route; a page that somehow lost the pseudo-element
  // would be a page where the wordmark stops being legible over its own content. `/` is the
  // deliberate exception and is asserted as one rather than skipped.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of PAGES) {
    await page.goto(route);
    const present = await page.evaluate(() => {
      const header = document.querySelector('.site-header');
      if (header === null) return 'no header';
      return getComputedStyle(header, '::before').content === 'none' ? 'no scrim' : 'ok';
    });
    expect(present, `${route}`).toBe(route === '/' ? 'no scrim' : 'ok');
  }
});

test('the home page never darkens its header, at rest or scrolled', async ({ page }) => {
  /*
   * The direction that actually matters. The scrim is opacity-animated from a scroll
   * timeline, so a page that still had one would look correct at rest and only reveal itself
   * 92px down - which is exactly how it went unnoticed on `/` between 8.9c and 8.9e.
   *
   * **It asserts `content`, not opacity, and that distinction cost a test round.** With the
   * rule gated off there is no generated box at all, and `getComputedStyle(el, '::before')`
   * still answers for a pseudo-element that was never created - reporting `opacity: 1`, the
   * property's initial value. An opacity assertion here fails against a correct page and
   * would have passed against a broken one had the sense been flipped.
   */
  const scrimBox = () =>
    page.evaluate(() => {
      const header = document.querySelector('.site-header');
      if (header === null) return 'no header';
      return getComputedStyle(header, '::before').content;
    });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  expect(await scrimBox(), 'the home header must not generate a scrim at rest').toBe('none');

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => window.scrollY > 590);
  expect(await scrimBox(), 'and must not grow one once scrolled').toBe('none');
});

test('below md the home page has its scrim too, once scrolled', async ({ page }) => {
  // 8.14c round 5 (owner): on a phone the acts' content runs under the logo and the action.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const scrim = () =>
    page.evaluate(() => {
      const header = document.querySelector('.site-header') as Element;
      return getComputedStyle(header, '::before').content;
    });
  expect(await scrim(), 'the home header has no scrim at phone width').not.toBe('none');
  expect(await scrimOpacity(page), 'at rest the header must not darken anything').toBeLessThan(
    0.02,
  );

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => window.scrollY > 590);
  await expect.poll(() => scrimOpacity(page)).toBeGreaterThan(0.98);
});

import { expect, test } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * **No page on this site scrolls sideways.** Owner's rule, given at 8.10b's Gate C.
 *
 * Individual sections have asserted this for themselves since 8.3 - `problem.spec.ts` and
 * `feed.spec.ts` both check it across their own scroll - but nothing asserted it for the
 * site, so a route added later inherited the rule and not the test. Route discovery means
 * this one covers whatever exists.
 *
 * **The condition that produced the report cannot be reproduced on this machine, and that
 * is stated rather than papered over.** `100vw` is the viewport including a classic
 * scrollbar; `clientWidth` excludes it. macOS draws overlay scrollbars, which take no
 * space, so the two are equal here and every width from 320 to 1600 measured clean while
 * the owner was looking at a page that scrolled. So the first test pins the rule, and the
 * second pins the *mechanism* that guarantees it on the platforms this machine cannot
 * imitate - `clip`, specifically, because `hidden` would establish a scroll container and
 * silently break every pinned section on the home route.
 */

const PAGES = ROUTES.filter((route) => !isCameraStand(route));
const WIDTHS = [320, 390, 768, 1440];

for (const route of PAGES) {
  test(`${route} never scrolls horizontally`, async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('the floor under that rule is clip, not hidden', async ({ page }) => {
  // `overflow: hidden` on the body would make a sticky element position against the body
  // instead of the viewport, which is the whole home route's motion. See CLAUDE.md.
  await page.goto('/');
  const overflowX = await page.evaluate(() => getComputedStyle(document.body).overflowX);
  expect(overflowX).toBe('clip');
});

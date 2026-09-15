import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The 404's frozen appearance - phases.md 8.9f, Gate C.
 *
 * `tests/visual/waitlist.spec.ts`'s shape, because the page is that page's structure: one
 * screen, a masked bloom field behind a centred block, and nothing scrubbed or pinned.
 * `freeze()` is still called - the bloom drifts on its own CSS timeline and is the only
 * moving thing here.
 *
 * **Not `fullPage`.** The route is `min-height: 100svh` with the footer below it, so a
 * full-page capture would spend most of its pixels re-proving the footer that
 * `tests/visual/footer.spec.ts` already owns, and would carry the `background-attachment:
 * fixed` artifact the taller suites document. The viewport frame is the design.
 *
 * The reduced-motion frame is not a duplicate: the bloom's orbs stop drifting and take
 * their static positions, which moves the atmosphere behind the headline.
 */

for (const viewport of VIEWPORTS) {
  test(`/404 at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/404');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`404-${viewport.name}.png`, SHOT);
  });

  test(`/404 at ${viewport.name}, reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/404');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`404-${viewport.name}-reduced.png`, SHOT);
  });
}

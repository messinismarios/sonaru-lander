import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The footer's frozen appearance - phases.md 8.9a, Gate C.
 *
 * Shot as an **element** rather than a page, which is the one thing worth explaining. The
 * other suites shoot viewports or full pages; both would be wrong here. A full-page shot
 * of the home route carries 13,000px of already-frozen acts, so any change to any of them
 * would fail this suite for a reason that has nothing to do with the footer. And a
 * viewport shot at the bottom of the page would include act four's device, which is still
 * on screen there.
 *
 * `/pricing` is the route it is captured on, not the home route: the footer is identical
 * everywhere (`Base.astro` renders it), and pricing is the cheapest page that has one -
 * no pin to walk, no scrubbed act to settle, and no `?state=` variants.
 *
 * Nothing in this section animates by design (Gate A), so unlike the act suites there is
 * no motion mode to sample at more than one offset - the reduced-motion variant differs
 * only in the link underline, which is drawn at rest rather than on hover.
 */

for (const viewport of VIEWPORTS) {
  test(`footer at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/pricing');
    await freeze(page);
    await expect(page.locator('footer.site-footer')).toHaveScreenshot(
      `footer-${viewport.name}.png`,
      SHOT,
    );
  });

  test(`footer at ${viewport.name}, reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/pricing');
    await freeze(page);
    // Link's reduced-motion rule underlines permanently at 40% rather than drawing in on
    // hover, so this frame genuinely differs from the one above - it is not a duplicate.
    await expect(page.locator('footer.site-footer')).toHaveScreenshot(
      `footer-${viewport.name}-reduced.png`,
      SHOT,
    );
  });
}

import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * `/press`'s frozen appearance - phases.md 8.10b, Gate C.
 *
 * `tests/visual/changelog.spec.ts`'s shape, and for the same reasons: the route runs
 * through `Document.astro`, nothing on it is pinned or scrubbed, and no motion stack is
 * loaded. `freeze()` is still called for the bloom behind the masthead.
 *
 * **The images are forced eager before the shutter.** The gallery is five lazy screenshots
 * below the fold, and a `fullPage` capture does not scroll them into view - the first run
 * of this suite photographed five empty frames and would have frozen *that* as the
 * approved appearance.
 */

for (const viewport of VIEWPORTS) {
  for (const reduced of [false, true]) {
    const name = reduced ? `press-${viewport.name}-reduced` : `press-${viewport.name}`;
    test(`/press at ${viewport.name}${reduced ? ', reduced motion' : ''}`, async ({ page }) => {
      if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/press');
      await page.evaluate(async () => {
        for (const image of document.querySelectorAll('img')) image.loading = 'eager';
        await document.fonts.ready;
      });
      await page.waitForFunction(() =>
        [...document.querySelectorAll('img')].every((image) => image.complete),
      );
      await freeze(page);
      await expect(page).toHaveScreenshot(`${name}.png`, { ...SHOT, fullPage: true });
    });
  }
}

import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * `/brand`'s frozen appearance - phases.md 8.10c, Gate C.
 *
 * `tests/visual/press.spec.ts`'s shape: the route runs through `Document.astro`, nothing on
 * it is pinned or scrubbed, and no motion stack is loaded. `freeze()` is still called for
 * the bloom behind the masthead.
 *
 * **No image-forcing step, unlike `/press`.** That suite has to make five lazy screenshots
 * eager before the shutter, because a `fullPage` capture does not scroll them into view and
 * its first run photographed five empty frames. This page has no `<img>` at all - the mark,
 * every construction figure and all six misuse panels are inline SVG - so there is nothing
 * to wait for beyond the fonts. That is worth stating rather than leaving as an absence: if
 * an image ever appears here, this suite needs `/press`'s eager pass.
 *
 * The motion demonstrations rest at `translateX(-100%)` and only run on hover or focus, so
 * a screenshot catches them at their start state in both motion modes. Nothing on this page
 * animates on its own for `freeze()` to catch.
 */

for (const viewport of VIEWPORTS) {
  for (const reduced of [false, true]) {
    const name = reduced ? `brand-${viewport.name}-reduced` : `brand-${viewport.name}`;
    test(`/brand at ${viewport.name}${reduced ? ', reduced motion' : ''}`, async ({ page }) => {
      if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/brand');
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await freeze(page);
      await expect(page).toHaveScreenshot(`${name}.png`, { ...SHOT, fullPage: true });
    });
  }
}

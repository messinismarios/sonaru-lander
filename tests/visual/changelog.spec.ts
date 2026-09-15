import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The changelog's frozen appearance - phases.md 8.9e, Gate C.
 *
 * `tests/visual/legal.spec.ts`'s shape exactly, and for the same reasons: the route runs
 * through `Document.astro`, nothing on it animates, nothing is pinned or scrubbed, and no
 * motion stack is loaded at all - `tests/e2e/changelog.spec.ts` asserts that rather than
 * assuming it. `freeze()` is still called, because the bloom field behind the masthead
 * drifts on its own CSS timeline.
 *
 * `fullPage`, carrying the same known capture artifact the legal and pricing suites
 * document: the ground is `background-attachment: fixed`, so a capture taller than the
 * viewport paints it once and leaves flat `--ground-solid` below it. An artifact of the
 * capture, not something a visitor can see.
 *
 * The reduced-motion frame is not a duplicate here either - the release notes carry links
 * in running prose, and `Document.astro`'s reduced-motion rule underlines them at rest
 * rather than on hover.
 */

for (const viewport of VIEWPORTS) {
  test(`/changelog at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/changelog');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`changelog-${viewport.name}.png`, {
      ...SHOT,
      fullPage: true,
    });
  });

  test(`/changelog at ${viewport.name}, reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/changelog');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`changelog-${viewport.name}-reduced.png`, {
      ...SHOT,
      fullPage: true,
    });
  });
}

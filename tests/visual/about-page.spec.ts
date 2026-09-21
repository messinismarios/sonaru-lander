import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The `/about` route's frozen appearance - SEO audit M4, Gate C 2026-09-18.
 *
 * **Not `about.spec.ts`**, which is the home page's "About Sonaru" section (SEO audit H3) -
 * a different surface that happens to share the word.
 *
 * The same shape as `legal.spec.ts`, for the same reason: `/about` is a `Document` page with
 * no motion, no pin and no entrance, so a full-page capture at each width - and a reduced-
 * motion one, where `Document`'s prose links underline at rest - is all there is to freeze.
 * It shares that suite's known artifact too: the fixed ground paints once, so a capture
 * taller than the viewport shows a flat edge at `viewport.height` that no visitor sees.
 */

for (const viewport of VIEWPORTS) {
  test(`/about at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/about');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`about-page-${viewport.name}.png`, {
      ...SHOT,
      fullPage: true,
    });
  });

  test(`/about at ${viewport.name}, reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/about');
    await page.evaluate(() => document.fonts.ready);
    await freeze(page);
    await expect(page).toHaveScreenshot(`about-page-${viewport.name}-reduced.png`, {
      ...SHOT,
      fullPage: true,
    });
  });
}

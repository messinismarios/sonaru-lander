import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The documents' frozen appearance - phases.md 8.9b, Gate C.
 *
 * The simplest suite on the site, and deliberately: nothing on these routes animates,
 * nothing is pinned, nothing is scrubbed, and there are no one-shot entrances to spend
 * before the shot. There is no motion stack loaded here at all.
 *
 * `fullPage`, like `/pricing` and `/waitlist`, and it carries the same known artifact:
 * the ground is `background-attachment: fixed`, so a capture taller than the viewport
 * paints it once and leaves flat `--ground-solid` below, producing a hard edge at exactly
 * `viewport.height`. It is an artifact of the capture, not something a visitor can see.
 *
 * The reduced-motion frame is not a duplicate: `Link`'s reduced-motion rule underlines at
 * rest rather than on hover, and these pages are the ones with links in running prose.
 */

const ROUTES = ['/privacy', '/terms', '/support'] as const;

for (const route of ROUTES) {
  const name = route.slice(1);

  for (const viewport of VIEWPORTS) {
    test(`${route} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await freeze(page);
      await expect(page).toHaveScreenshot(`${name}-${viewport.name}.png`, {
        ...SHOT,
        fullPage: true,
      });
    });

    test(`${route} at ${viewport.name}, reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await freeze(page);
      await expect(page).toHaveScreenshot(`${name}-${viewport.name}-reduced.png`, {
        ...SHOT,
        fullPage: true,
      });
    });
  }
}

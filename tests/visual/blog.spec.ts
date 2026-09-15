import { expect, test } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze, settleImages } from './support';

/**
 * The blog's frozen appearance - phases.md 8.9c, Gate C.
 *
 * Three routes, because they are three compositions: the index, an article, and a tag
 * page. The article is the one that could most easily be left uncovered - it is
 * `Document.astro`, which 8.9b already has baselines for - and it is covered anyway,
 * because what is new here is what sits *inside* that layout: the meta line, the code
 * block, and MDX rendering a live component into running prose.
 *
 * `fullPage`, like `/privacy` and `/pricing`, with the same known capture artifact those
 * suites document: the ground is `background-attachment: fixed`, so a capture taller than
 * the viewport paints it once and leaves flat `--ground-solid` below.
 *
 * The reduced-motion frames are not duplicates. Every link on these pages - the card
 * titles, the tag links, the prose links inside a post - is underlined at rest under
 * reduced motion and only on hover otherwise, so the two sets differ everywhere a link
 * appears.
 */

/*
 * One article since the seed posts were replaced (2026-09-14). The code-block and MDX
 * articles went with them, so neither of those compositions has a baseline until a post
 * carries one again.
 */
const ROUTES = [
  { route: '/blog', name: 'blog-index' },
  { route: '/blog/what-is-sonaru', name: 'blog-article' },
  { route: '/blog/tags/product', name: 'blog-tag' },
] as const;

for (const { route, name } of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await settleImages(page);
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
      await settleImages(page);
      await freeze(page);
      await expect(page).toHaveScreenshot(`${name}-${viewport.name}-reduced.png`, {
        ...SHOT,
        fullPage: true,
      });
    });
  }
}

import { expect, test } from '@playwright/test';

/**
 * On a phone, the wide blocks on `/press` and `/brand` keep the page's gutter - 8.14 (owner).
 *
 * Both pages break their non-prose blocks (swatches, screenshots, the contents box, the
 * pairings table) out of the reading column by up to one gutter. At desktop that is a little
 * extra width; on a phone the column is already the screen less its gutters, so the same rule
 * put those blocks flush against both edges while the prose around them was inset. Asserted
 * against every such block rather than one, since the rule is written per page.
 */

const GUTTER = 24;
const WIDTHS = [320, 390];

const BLOCKS: Record<string, readonly string[]> = {
  '/press': ['.ways', '.swatches', '.screens'],
  '/brand': ['.toc', '.misuses', '.swatches', '.table-wrap', '.figure-block', '.ramp'],
};

for (const width of WIDTHS) {
  for (const [route, selectors] of Object.entries(BLOCKS)) {
    test(`${route} at ${width}px: wide blocks keep the gutter`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(route);

      const boxes = await page.evaluate((list) => {
        const found: { selector: string; left: number; right: number }[] = [];
        for (const selector of list) {
          for (const element of document.querySelectorAll(`main ${selector}`)) {
            const box = element.getBoundingClientRect();
            found.push({ selector, left: box.left, right: box.right });
          }
        }
        return { found, client: document.documentElement.clientWidth };
      }, selectors);

      expect(boxes.found.length, `${route} has none of its wide blocks`).toBeGreaterThan(0);
      for (const box of boxes.found) {
        expect(box.left, `${box.selector} left edge`).toBeGreaterThanOrEqual(GUTTER - 0.5);
        expect(box.right, `${box.selector} right edge`).toBeLessThanOrEqual(
          boxes.client - GUTTER + 0.5,
        );
      }
    });
  }
}

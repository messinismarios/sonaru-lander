import { expect, test } from '@playwright/test';

/**
 * The font swap must cost nothing.
 *
 * acceptance-criteria.md §3 requires zero layout shift from the font swap, inside a total
 * CLS budget of 0.01. This asserts the property directly rather than trusting the
 * @font-face descriptors to be right: it lays the page out in Satoshi, then in the
 * metrics-matched fallback alone, and requires every block to occupy the same space.
 *
 * It has already caught two real defects - a fallback @font-face that mapped every weight
 * to Arial Regular, and `ch`-based measure widths that were 23% narrower in the fallback
 * (docs/adr-0002-no-ch-for-measure.md).
 */

/** Blocks that carry real copy at the sizes the site actually sets. */
const BLOCKS = ['.display', '.act', '.body', '.muted', 'section'] as const;

/** Sub-pixel tolerance. Anything larger is a real reflow, not a rounding difference. */
const TOLERANCE_PX = 0.5;

test.describe('metrics-matched fallback', () => {
  test('swapping Satoshi for the fallback shifts nothing', async ({ page }) => {
    await page.goto('/specimen');
    await page.evaluate(() => document.fonts.ready);

    const measure = () =>
      page.evaluate(
        (selectors) => {
          const result: Record<string, { height: number; top: number }> = {};
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Specimen is missing ${selector}`);
            const box = element.getBoundingClientRect();
            result[selector] = { height: box.height, top: box.top };
          }
          return { blocks: result, documentHeight: document.documentElement.scrollHeight };
        },
        BLOCKS as readonly string[],
      );

    const withWebfont = await measure();
    await page.getByRole('button', { name: /fallback/i }).click();
    const withFallback = await measure();

    for (const selector of BLOCKS) {
      const before = withWebfont.blocks[selector];
      const after = withFallback.blocks[selector];
      expect(before, `${selector} measured before the swap`).toBeDefined();
      expect(after, `${selector} measured after the swap`).toBeDefined();
      if (!before || !after) continue;

      expect(Math.abs(after.height - before.height), `${selector} height`).toBeLessThanOrEqual(
        TOLERANCE_PX,
      );
      expect(Math.abs(after.top - before.top), `${selector} position`).toBeLessThanOrEqual(
        TOLERANCE_PX,
      );
    }

    expect(withFallback.documentHeight, 'document height').toBe(withWebfont.documentHeight);
  });
});

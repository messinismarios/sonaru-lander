import { expect, test, type Page } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The pricing route's frozen appearance - phases.md 8.7, Gate C.
 *
 * Simpler than the home route's suites by design: nothing here is scrubbed or pinned, so
 * there is no travel to settle at and no per-section offset to compute. The whole page is
 * one still frame in each motion mode.
 *
 * **These are `fullPage` shots, and that puts one artifact in every baseline.** The ground
 * is `background-attachment: fixed` on `<html>` (`Base.astro`, approved at 8.1), so a
 * full-page capture paints it for one viewport and leaves the remainder on the flat
 * `--ground-solid` beneath - a hard horizontal edge at exactly `viewport.height`, 900px at
 * 1440. It is an artifact of capturing a fixed background at more than viewport height,
 * not something a visitor can ever see, and it cost one round of chasing a bloom bug that
 * did not exist. The home route's suites never meet it because they shoot viewport frames
 * at settled scroll offsets; this page has no travel to settle at, so it is shot whole.
 *
 * The other thing that needs care is that the entrances are `once: true` ScrollTriggers -
 * they fire as their group enters the viewport and stay resolved. A full-page screenshot
 * taken from the top would freeze the page mid-arrival, so the page is walked to the
 * bottom first to spend every trigger, then returned to the top before the shot.
 */

/** Walks the page so every one-shot entrance fires, then returns to the top and settles. */
async function resolveEntrances(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);

  for (let offset = 0; offset < height; offset += step) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await page.waitForTimeout(120);
  }

  await page.evaluate(() => window.scrollTo(0, 0));

  // Every entrance is DURATION.section (0.6s) plus at most two STAGGER.sequence steps.
  await page.waitForTimeout(1400);
}

for (const viewport of VIEWPORTS) {
  test(`pricing at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/pricing');
    await resolveEntrances(page);
    await freeze(page);

    await expect(page).toHaveScreenshot(`pricing-${viewport.name}.png`, {
      ...SHOT,
      fullPage: true,
    });

    await context.close();
  });

  test(`pricing at ${viewport.name}, yearly`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/pricing');
    await resolveEntrances(page);

    await page.locator('[data-plans-toggle]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.documentElement.dataset['billing'] !== undefined);
    await page.getByRole('radio', { name: /Yearly/ }).check();
    await page.evaluate(() => window.scrollTo(0, 0));
    // The cross-fade is --dur-2 (300ms).
    await page.waitForTimeout(500);

    await freeze(page);
    await expect(page).toHaveScreenshot(`pricing-${viewport.name}-yearly.png`, {
      ...SHOT,
      fullPage: true,
    });

    await context.close();
  });

  test(`pricing at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/pricing');

    /*
     * No walk needed: `pricing.ts`'s reduced branch sets every group to its finished state
     * on definition rather than on a trigger. Waiting for a card to be opaque is what
     * proves that happened, instead of trusting a timeout.
     */
    await expect(page.locator('[data-plan-card]').first()).toHaveCSS('opacity', '1');

    await freeze(page);
    await expect(page).toHaveScreenshot(`pricing-${viewport.name}-reduced.png`, {
      ...SHOT,
      fullPage: true,
    });

    await context.close();
  });
}

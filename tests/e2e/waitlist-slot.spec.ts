import { expect, test } from '@playwright/test';

/**
 * The room `/waitlist` holds for its form before the form exists - SEO audit M1.
 *
 * The layout shift this prevents cannot be reproduced reliably here: it needs a first paint
 * that lands between Astro's island runtime scripts and the island, which only a throttled,
 * cold load produces. So the guard is on the thing that prevents it. If the reservation is
 * smaller than the resting form, the centred block moves when the form arrives; if it is
 * larger, the page has grown a gap. Either way the number in `waitlist.astro` has drifted from
 * the form it was measured against, and this says so.
 */
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const) {
  test(`the form slot reserves exactly the resting form at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/waitlist', { waitUntil: 'load' });
    await page.waitForSelector('[data-form-slot] form');
    await page.evaluate(() => document.fonts.ready);

    const measured = await page.evaluate(() => {
      const slot = document.querySelector('[data-form-slot]') as HTMLElement;
      const island = slot.querySelector('astro-island') as HTMLElement;
      const form = island.firstElementChild as HTMLElement;
      return {
        reserved: Number.parseFloat(getComputedStyle(slot).minHeight),
        form: form.getBoundingClientRect().height,
      };
    });
    expect(Math.abs(measured.form - measured.reserved), JSON.stringify(measured)).toBeLessThan(1);
  });
}

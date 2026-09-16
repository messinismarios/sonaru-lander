import { expect, test } from '@playwright/test';
import { LATE_START } from '../../src/motion/tokens';

/**
 * A plan card that has been on screen is not hidden again - SEO audit M1 (owner, Gate B,
 * 2026-09-15).
 *
 * `pricing.ts` waits for ScrollTrigger and Lenis before it sets its entrance baseline, so on a
 * slow load the toggle and cards were already painted when `gsap.set(opacity: 0)` arrived:
 * they vanished and rose back in. Measured on production at 1440 under throttling (painted
 * 1.45 s, hidden 2.07 s), and worse under `astro dev`.
 *
 * **The lateness is made, not waited for.** Every motion module is held back by 1.2 s, so the
 * timeline always starts long after first paint, on a warm cache or a cold one.
 *
 * **A card has to have been visible for `LATE_START` before a drop counts.** On a prompt load
 * the cards are painted a few frames before the baseline lands, and that brief hide is the
 * 8.7 entrance the owner kept - so "never drops at all" would fail the approved behaviour.
 */
test('a plan card that has been on screen is not hidden by a late timeline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/\/src\/motion\//, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.addInitScript((lateMs) => {
    const store = window as unknown as { __cardDrops: string[] };
    store.__cardDrops = [];
    const seenAt: number[] = [];
    const tick = () => {
      document.querySelectorAll<HTMLElement>('[data-plan-card]').forEach((card, index) => {
        const opacity = Number.parseFloat(getComputedStyle(card).opacity);
        const now = performance.now();
        if (opacity > 0.99) seenAt[index] ??= now;
        else if (seenAt[index] !== undefined && opacity < 0.5 && now - seenAt[index] > lateMs) {
          store.__cardDrops.push(
            `card ${index} hidden at ${Math.round(now)}ms, visible since ${Math.round(seenAt[index])}ms`,
          );
          seenAt[index] = Number.POSITIVE_INFINITY;
        }
      });
      if (performance.now() < 8000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, LATE_START * 1000);

  await page.goto('/pricing', { waitUntil: 'load' });
  await page.waitForFunction(() => performance.now() > 8000, undefined, { timeout: 20_000 });

  const drops = await page.evaluate(
    () => (window as unknown as { __cardDrops: string[] }).__cardDrops,
  );
  expect(drops).toEqual([]);
});

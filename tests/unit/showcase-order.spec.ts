import { expect, test } from '@playwright/test';

/**
 * The feed is in strict reverse-chronological order, newest first.
 *
 * This is not a cosmetic assertion. "Chronological and complete - no algorithm deciding
 * what you see" is the differentiator `mission.md` §6.2 puts second only to the product's
 * one-line promise, and the device mockup is where the site demonstrates it. A feed that
 * silently sorts by anything else is advertising the behaviour we say we do not have.
 *
 * It has already been wrong once: `getCollection` returns entries keyed by id, so the
 * first build of this section ran the feed in alphabetical order by slug and nothing
 * failed.
 */
test('the device feed runs newest release first', async ({ page }) => {
  await page.goto('/');

  const dates = await page.$$eval('[data-feed-track] .date', (nodes) =>
    nodes.map((node) => new Date(node.textContent?.trim() ?? '').getTime()),
  );

  expect(dates.length).toBeGreaterThan(1);
  expect(dates.every((value) => Number.isFinite(value))).toBe(true);

  const newestFirst = [...dates].sort((a, b) => b - a);
  expect(dates).toEqual(newestFirst);
});

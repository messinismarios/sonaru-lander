import { expect, test } from '@playwright/test';

/**
 * "About Sonaru" on `/` - SEO audit H3 (absorbing H2), Gate B approved 2026-09-15.
 *
 * What the section is for is text a crawler can read, so that is what is asserted: the
 * category words in the heading and intro, the questions matching their `FAQPage` markup,
 * and the one link on the site that reaches `/pricing`. How it looks is the visual suite's.
 */

test('states what Sonaru is in the words people search', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('[data-about]');
  await expect(about.locator('h2')).toHaveText(
    'New music release notifications for every artist you follow.',
  );
  await expect(about.locator('.intro')).toContainText('Spotify and Apple Music');
});

test('links to /pricing, which nothing else on the site does', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('[data-about] .intro a');
  await expect(link).toHaveAttribute('href', '/pricing');
  await expect(link).toHaveText('pro features');
});

test('its FAQPage markup describes exactly the questions it shows', async ({ page }) => {
  await page.goto('/');
  const rendered = await page
    .locator('[data-about] [data-faq-item] summary .question')
    .allTextContents();
  const faq = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) =>
      nodes
        .flatMap((node) => JSON.parse(node.textContent ?? '[]'))
        .find((block) => block['@type'] === 'FAQPage'),
    );

  expect(rendered).toHaveLength(4);
  expect(faq.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(rendered);
});

test('the hero headline reads as two sentences to a text extractor', async ({ page }) => {
  // SEO audit H3-h1 (owner, Gate A): "They dropped itYou always catch it" was what anything
  // reading `textContent` got, because a `<br>` is not text. The full stop is visually hidden.
  await page.goto('/');
  // `main h1`: in dev the Astro toolbar injects h1s of its own.
  const text = await page.locator('main h1').evaluate((node) => node.textContent?.trim());
  expect(text).toBe('They dropped it. You always catch it');

  const stop = page.locator('main h1 .extract-stop');
  const box = await stop.boundingBox();
  expect(box?.width ?? 0, 'the full stop must not be visible').toBeLessThanOrEqual(1);
});

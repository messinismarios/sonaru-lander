import { expect, test } from '@playwright/test';
import { SOCIAL_PROFILES } from '../../src/data/social';

/**
 * The home page's `Organization` and `WebSite` JSON-LD - SEO audit H1.
 *
 * `blog.spec.ts` and `pricing.spec.ts` cover the post's and the FAQ's. What is pinned here is
 * what the owner decided on 2026-09-15, so a change to any of it is a visible diff rather than
 * a quiet one: the app icon as the logo, three contact points, `sameAs` naming only Sonaru's
 * own profiles (M10), and no `MobileApplication` before there is an App Store URL for it to point at.
 */

async function blocks(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  return page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.flatMap((node) => JSON.parse(node.textContent ?? '[]')));
}

test('the home page names the organisation and the site', async ({ page }) => {
  const found = await blocks(page, '/');
  const organization = found.find((block) => block['@type'] === 'Organization');
  const website = found.find((block) => block['@type'] === 'WebSite');

  expect(organization).toMatchObject({
    '@id': 'https://sonaru.app/#organization',
    name: 'Sonaru',
    url: 'https://sonaru.app',
    logo: 'https://sonaru.app/icons/icon-512.png',
  });
  expect(organization.contactPoint.map((point: { email: string }) => point.email)).toEqual([
    'support@sonaru.app',
    'press@sonaru.app',
    'hello@sonaru.app',
  ]);
  // Sonaru's own profiles, once they exist (audit M10) - and only those.
  expect(organization.sameAs).toEqual(SOCIAL_PROFILES);

  expect(website).toMatchObject({
    name: 'Sonaru',
    url: 'https://sonaru.app',
    publisher: { '@id': 'https://sonaru.app/#organization' },
  });

  const app = found.find((block) => /Application$/.test(block['@type']));
  expect(app, 'MobileApplication lands with the App Store URL (audit M13)').toBeUndefined();
});

test('the logo it names is served', async ({ request }) => {
  const response = await request.get('/icons/icon-512.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
});

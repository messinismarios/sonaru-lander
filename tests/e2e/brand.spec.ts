import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CHAPTERS, MISUSES } from '../../src/data/brand';
import { catalogue } from '../../src/i18n';

/* 8.11a: the chapter titles moved to the catalogue; the chapter list did not. */
const copy = catalogue('en').brand;
import { PRESET, minGap } from '../../src/components/brand/mark-geometry';
import { score } from '../../src/lib/contrast';
import { palette } from '../../src/lib/tokens';

/**
 * `/brand`'s behaviour - phases.md 8.10c.
 *
 * The unit's promise at Gate A was that **the document cannot print a number the source
 * disagrees with**, and a promise like that is worth exactly as much as the test that
 * fails when it stops being true. So the assertions below do not check that the page says
 * `−1.75`; they compute `minGap(PRESET)` and check the page agrees. Hard-coding the
 * expected string here would move the literal from the page into the test and prove
 * nothing.
 *
 * The page's other structural claim - that the contents cannot lie about the chapters -
 * is here too. The claim that the route ships no JavaScript is **not**: see the note in
 * `the document` below.
 */

const tokensCss = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

test.describe('the document', () => {
  test('is one route with seven chapters, in the declared order', async ({ page }) => {
    await page.goto('/brand');
    await expect(page.locator('main h1')).toHaveText('Brand');

    const ids = await page.locator('main h2').evaluateAll((nodes) => nodes.map((n) => n.id));
    expect(ids).toEqual(CHAPTERS.map((chapter) => chapter.id));
  });

  test('the contents lists every chapter and nothing else', async ({ page }) => {
    /*
     * Both directions. A contents page that omits a chapter is a navigation bug; one that
     * lists a chapter that does not exist is a link to nowhere, and on a single-route
     * document a dead fragment fails silently - the browser simply does not move.
     */
    await page.goto('/brand');
    const links = page.locator('nav[aria-label="Contents"] a');
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href')),
    );
    expect(hrefs).toEqual(CHAPTERS.map((chapter) => `#${chapter.id}`));
    await expect(links).toHaveText(CHAPTERS.map((chapter) => copy.chapters[chapter.id]));

    for (const chapter of CHAPTERS) {
      await expect(page.locator(`main #${chapter.id}`)).toHaveCount(1);
    }
  });

  /*
   * **The "no JavaScript" claim is not testable here and is asserted against the build
   * instead** - see `tests/unit/brand-inventory.spec.ts`. This suite runs against
   * `astro dev`, which injects its own HMR client and mounts a dev toolbar, so the page
   * carries scripts in dev that it does not ship. It is 8.10a's lesson in a new place:
   * assert against what the visitor gets, not against what the dev server renders.
   */
});

test.describe('the construction chapter reads its numbers from the geometry', () => {
  test('prints the overlap the module computes', async ({ page }) => {
    const gap = minGap(PRESET);
    // The preset crosses the S rather than clearing it. If this ever goes positive the
    // chapter is describing a clearance and its prose is wrong, so assert the sign too.
    expect(gap).toBeLessThan(0);

    await page.goto('/brand');
    const caption = page.locator('#construction ~ figure figcaption').last();
    await expect(caption).toContainText(gap.toFixed(2));
    await expect(caption).toContainText(String(PRESET.sonarOpacity));
  });

  test('states the two radii the preset actually has', async ({ page }) => {
    // The sonar is *larger* than the C and concentric with it. This file's own header said
    // the opposite until 8.10c, which is what the chapter had to be checked against.
    expect(PRESET.sonarRadius).toBeGreaterThan(PRESET.radius);
    expect(PRESET.sonarOffset).toBe(0);

    await page.goto('/brand');
    const caption = page.locator('#construction ~ figure figcaption').nth(1);
    await expect(caption).toContainText(String(PRESET.sonarRadius));
    await expect(caption).toContainText(String(PRESET.radius));
  });

  test('draws three figures, each labelled for a screen reader', async ({ page }) => {
    await page.goto('/brand');
    const figures = page.locator('#construction ~ figure svg[role="img"]');
    await expect(figures).toHaveCount(3);
    for (const label of await figures.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('aria-label')),
    )) {
      expect(label?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

test('the colour table prints exactly what the contrast validator enforces', async ({ page }) => {
  /*
   * The chapter's whole claim. Computed here from the same shared table `npm run contrast`
   * runs on, then compared against the rendered rows - so a page that drifted from the
   * validator, in either direction, fails here rather than misinforming a reader who
   * trusted a published accessibility number.
   */
  const expected = score(palette(tokensCss));

  await page.goto('/brand');
  const rows = page.locator('table.pairings tbody tr');
  await expect(rows).toHaveCount(expected.length);

  const printed = await rows.evaluateAll((nodes) =>
    nodes.map((row) => ({
      pair: row.querySelector('th code')?.textContent?.trim() ?? '',
      ratio: row.querySelector('.ratio')?.textContent?.trim() ?? '',
    })),
  );

  expect(printed).toEqual(
    expected.map((pairing) => ({
      pair: `${pairing.fg} on ${pairing.bg}`,
      ratio: `${pairing.ratio.toFixed(2)}:1`,
    })),
  );
});

test('every misuse panel is a live mark, named as something not to do', async ({ page }) => {
  /*
   * They are rendered rather than photographed so they cannot go stale - which only holds
   * while they really are renders. An `<img>` appearing in this grid is the regression.
   */
  await page.goto('/brand');
  const panels = page.locator('.misuse');
  await expect(panels).toHaveCount(MISUSES.length);
  await expect(page.locator('.misuse img')).toHaveCount(0);
  /*
   * Five of the six are the mark, drawn by the same component the real one uses. The
   * sixth is the *wordmark* reset in another face, and the wordmark is live text rather
   * than outlines - so it is deliberately not an SVG, and counting six here would be
   * asserting the opposite of what §9.5 records about the logotype.
   */
  await expect(page.locator('.misuse svg')).toHaveCount(MISUSES.length - 1);
  await expect(page.locator('.misuse[data-misuse="reface"] .word')).toHaveCount(1);

  for (const misuse of MISUSES) {
    const panel = page.locator(`.misuse[data-misuse="${misuse.id}"] [role="img"]`);
    await expect(panel).toHaveAttribute('aria-label', /^Don’t: /);
  }
});

test('the footer offers /brand now that it exists', async ({ page }) => {
  /*
   * `nav.ts`'s pending-entry machinery asserts this in the unit suite too, but from the
   * data rather than from the rendered page. This is the reader's version: the route is
   * reachable from any page on the site.
   */
  await page.goto('/');
  await expect(page.locator('footer a[href="/brand"]')).toHaveCount(1);
});

test('/logo is gone', async ({ page }) => {
  // It folded into `/brand`, which is what removed it - it was never on 8.13's list.
  const response = await page.goto('/logo');
  expect(response?.status()).toBe(404);
});

import { expect, test } from '@playwright/test';
import { ALL_PRESS_FILES, BOILERPLATE, PRESS_EMAIL, SCREENS } from '../../src/data/press';
import { catalogue } from '../../src/i18n';

/* 8.11a: the words moved to the catalogue; the inventory they describe did not. */
const copy = catalogue('en').press;

/**
 * `/press`'s behaviour - phases.md 8.10b.
 *
 * `tests/unit/press-assets.spec.ts` checks that the files exist; this checks the page that
 * hands them out. Two of these are the unit's real risks rather than routine coverage:
 * **every download actually resolves**, because a broken `<a download>` looks exactly like
 * a working one, and **the copy buttons do not exist when the clipboard API does not** -
 * `navigator.clipboard` is undefined outside a secure context, which includes the LAN URL
 * used for a Gate C check on a real phone.
 */

test.describe('the page', () => {
  test('is a press kit, not a newsroom', async ({ page }) => {
    /*
     * Gate A's finding, expressed as something that can fail. cash.app and revolut both
     * lead with a list of news items; Sonaru has no news, so the sections are the kit and
     * the page carries no dated entries at all.
     */
    await page.goto('/press');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText('Press');
    await expect(page.locator('main time')).toHaveCount(0);

    const sections = await page.locator('main h2').evaluateAll((nodes) => nodes.map((n) => n.id));
    expect(sections).toEqual(['boilerplate', 'logo', 'colour', 'screenshots', 'contact']);
  });

  test('states that Sonaru has not launched', async ({ page }) => {
    // The one sentence on this page with a real chance of misleading somebody in print if
    // it were missing. `/changelog` refuses the same fabrication from the other direction.
    await page.goto('/press');
    await expect(page.getByText('Sonaru has not launched yet')).toBeVisible();
  });

  test('every asset the page names resolves, and it names them all', async ({ page, request }) => {
    /*
     * Both ways of pointing at a file count: the logos and the full-size screenshots are
     * links, the gallery's own thumbnails are `<img src>`. Asserting only links was the
     * first version of this test, and it failed for the right reason - the five files the
     * visitor actually *sees* were the ones it did not check.
     */
    await page.goto('/press');
    const referenced = await page.evaluate(() => [
      ...[...document.querySelectorAll('main a[href^="/press/"]')].map((node) =>
        node.getAttribute('href'),
      ),
      ...[...document.querySelectorAll('main img[src^="/press/"]')].map((node) =>
        node.getAttribute('src'),
      ),
    ]);

    for (const file of ALL_PRESS_FILES) expect(referenced).toContain(`/press/${file}`);
    for (const url of referenced) {
      const response = await request.get(url ?? '');
      expect(response.status(), url ?? '').toBe(200);
    }
  });

  test('press enquiries go to the press address, not to support', async ({ page }) => {
    await page.goto('/press');
    await expect(page.locator(`main a[href="mailto:${PRESS_EMAIL}"]`)).toBeVisible();
  });

  test('every screenshot and both logo previews are described', async ({ page }) => {
    await page.goto('/press');
    for (const screen of SCREENS) {
      await expect(page.locator(`img[src="/press/screens/${screen.id}.jpg"]`)).toHaveAttribute(
        'alt',
        copy.screenshots.screens[screen.id].alt,
      );
    }
    /*
     * The previews were `alt=""` as decoration until SEO audit L5 (owner, 2026-09-16): they
     * are the download itself, so image search and a screen reader should both be told what
     * they are.
     */
    const previews = page.locator('.preview img');
    await expect(previews).toHaveCount(2);
    await expect(previews.nth(0)).toHaveAttribute('alt', copy.logo.ways.dark.alt);
    await expect(previews.nth(1)).toHaveAttribute('alt', copy.logo.ways.light.alt);
  });

  test('every image reserves its own space, so nothing shifts as they load', async ({ page }) => {
    // CLS is a Lighthouse-100 requirement (acceptance-criteria.md §3) and the gallery is
    // 272 KB of lazy images below the fold.
    await page.goto('/press');
    for (const image of await page.locator('main img').all()) {
      expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
    }
  });
});

test.describe('copying', () => {
  test('a boilerplate button puts that boilerplate on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/press');

    const entry = BOILERPLATE[0];
    if (entry === undefined) throw new Error('BOILERPLATE is empty');
    const block = page.locator(`[data-copy-value="${copy.boilerplate.entries[entry.id].text}"]`);
    await block.getByRole('button').click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      copy.boilerplate.entries[entry.id].text,
    );
    await expect(block.locator('.status')).toHaveText('Copied');
  });

  test('a swatch copies the hex, not the label around it', async ({ page, context }) => {
    /*
     * The expected value is read off the page rather than imported: the hexes live in
     * `tokens.css` and nowhere else, so a test carrying its own copy would be the seventh
     * unchecked literal this page exists to avoid. What is asserted is that the clipboard
     * gets exactly what the swatch prints - and that the role beside it does not come too.
     */
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/press');

    const swatch = page.locator('ul.swatches > li').first();
    const printed = (await swatch.locator('.swatch-hex').textContent())?.trim();
    expect(printed).toMatch(/^#[0-9a-f]{6}$/);
    await swatch.getByRole('button').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(printed);
  });

  test('the announcement is a live region, not a tooltip', async ({ page, context }) => {
    // A visitor who cannot see the label change is told the copy happened.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/press');
    const status = page.locator('.copy .status').first();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('role', 'status');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('offers no button it cannot honour, and loses nothing else', async ({ page }) => {
    /*
     * The failure this guards is not hypothetical: `navigator.clipboard` is undefined on
     * `npm run dev:host`, so a button rendered in the markup would be dead on the phone the
     * owner checks Gate C on. The buttons are created by the script; the text they would
     * have copied is on the page either way.
     */
    await page.goto('/press');
    await expect(page.locator('.copy-button')).toHaveCount(0);

    const entry = BOILERPLATE[0];
    if (entry === undefined) throw new Error('BOILERPLATE is empty');
    await expect(page.getByText(copy.boilerplate.entries[entry.id].text)).toBeVisible();
    await expect(page.locator('main a[href^="/press/"]').first()).toBeVisible();
  });
});

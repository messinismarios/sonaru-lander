import { expect, test } from '@playwright/test';

/**
 * The documents' behaviour - phases.md 8.9b. Appearance is `tests/visual/legal.spec.ts`.
 *
 * Three things here are worth more than the rest.
 *
 * **The measure.** 8.9b's Gate B rests on a measured number - 68 characters - and a
 * number nothing asserts is a number that drifts the first time a token is touched. It is
 * checked by rendering a string in the page's own font and dividing, which is the same
 * method the gate used, not by reading the CSS back.
 *
 * **Prose link parity.** Markdown renders a bare `<a>`, so the `Link` primitive cannot be
 * used inside a document, and its styles cannot be globalised either - `.link` is already
 * taken by `WaitlistForm.svelte`'s suggestion button. The inline variant's declarations
 * are therefore written twice, which is a drift risk; this asserts the two computed
 * results agree, so they cannot part company quietly.
 *
 * **JavaScript off.** `/waitlist` is the site's one route that requires it (8.8, owner
 * decision). These three are not, and a legal document that needs a script to be read is
 * a legal document some regulators would say was never published.
 */

const DOCUMENTS = [
  { route: '/privacy', title: 'Privacy Policy', effective: true },
  { route: '/terms', title: 'Terms of Service', effective: true },
  { route: '/support', title: 'Support', effective: false },
] as const;

test.describe('structure', () => {
  for (const { route, title, effective } of DOCUMENTS) {
    test(`${route} renders one h1, and it is the document's title`, async ({ page }) => {
      await page.goto(route);
      const h1 = page.locator('main h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(title);
    });

    test(`${route} has a heading outline with no level skipped`, async ({ page }) => {
      await page.goto(route);
      const levels = await page.evaluate(() =>
        [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((heading) =>
          Number(heading.tagName.slice(1)),
        ),
      );
      expect(levels[0]).toBe(1);
      for (let index = 1; index < levels.length; index += 1) {
        const step = (levels[index] ?? 0) - (levels[index - 1] ?? 0);
        expect(
          step,
          `${route} jumps from h${levels[index - 1]} to h${levels[index]}`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test(`${route} ${effective ? 'carries' : 'omits'} a machine-readable effective date`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator('main time[datetime]')).toHaveCount(effective ? 1 : 0);
    });
  }
});

test.describe('the reading measure', () => {
  for (const { route } of DOCUMENTS) {
    test(`${route} sets prose at roughly 80 characters`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);

      const characters = await page.evaluate(() => {
        const paragraph = document.querySelector('.prose p');
        if (paragraph === null) return null;
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
        probe.textContent = paragraph.textContent ?? '';
        paragraph.append(probe);
        const average = probe.getBoundingClientRect().width / (probe.textContent?.length || 1);
        const width = paragraph.getBoundingClientRect().width;
        probe.remove();
        return width / average;
      });

      /*
       * Measured, not read back from CSS - the same method Gate B used to pick the token.
       * `--measure` would land at 111 here, which is the defect this token exists for.
       *
       * **The band moved at 8.9c's Gate C change round** (owner, band D): the reading
       * column went from 540px of 18px type to **700px of 20px type**, and this page went
       * with it, because `/privacy`, `/terms`, `/support` and the blog are one layout and
       * the owner chose not to fork them.
       *
       * The probe below averages over *the paragraph's own text*, which weights letters
       * the way English actually uses them. That matters: an even a–z probe reports 73 for
       * the same column, and reporting the wrong one of those two numbers is how the site
       * ended up believing `68ch` was 68 characters. This method is the realistic one, and
       * by it the old column was 68 - so `docs/adr-0002`'s recorded figure was right.
       */
      expect(characters).not.toBeNull();
      expect(characters ?? 0).toBeGreaterThan(72);
      expect(characters ?? 0).toBeLessThan(86);
    });
  }
});

test('a prose link is visually identical to the Link primitive', async ({ page }) => {
  await page.goto('/terms');
  const prose = await page
    .locator('.prose a')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const underline = getComputedStyle(element, '::after');
      return {
        color: style.color,
        decoration: style.textDecorationLine,
        height: underline.height,
        bottom: underline.bottom,
      };
    });

  // The footer's links are the `muted` variant, so the comparison needs an `inline` one,
  // and `/kit` is where the site actually renders that variant - the design-system page
  // is the only route using it, which is itself worth knowing.
  await page.goto('/kit');
  const primitive = await page
    .locator('a.link.is-inline')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const underline = getComputedStyle(element, '::after');
      return {
        color: style.color,
        decoration: style.textDecorationLine,
        height: underline.height,
        bottom: underline.bottom,
      };
    });

  expect(prose).toEqual(primitive);

  // The waitlist island's own `.link` was compared here as a third copy until 8.13's copy
  // pass (owner, 2026-09-14) removed the form's privacy line - the only `<a class="link">`
  // the island rendered at rest. Its remaining `.link` is the typo suggestion, which exists
  // only after a mistyped submit.
});

test('prose lists have visible markers', async ({ page }) => {
  // Tailwind's preflight resets `ul, ol` to `list-style: none`, which is correct for the
  // rest of the site and silently turned the privacy policy's lists into indented
  // paragraphs. Nothing failed; it was found by looking at the page. This is the guard.
  await page.goto('/privacy');
  const style = await page
    .locator('.prose ul')
    .first()
    .evaluate((element) => getComputedStyle(element).listStyleType);
  expect(style).toBe('disc');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { route, title } of DOCUMENTS) {
    test(`${route} reads in full`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main h1')).toHaveText(title);
      // Not just the title: the body has to be in the HTML too, since a document that
      // renders its own heading and nothing else is not a published document.
      const words = await page.locator('.prose').innerText();
      expect(words.length).toBeGreaterThan(500);
    });
  }
});

test.describe('the links the rest of the site owes these pages', () => {
  /* The waitlist form's link to /privacy was asserted here until the owner removed the
   * form's privacy line at 8.13's copy pass (2026-09-14); the footer below still links it. */

  test('the footer offers all three as real links now', async ({ page }) => {
    await page.goto('/');
    for (const { route } of DOCUMENTS) {
      await expect(page.locator(`footer.site-footer a[href="${route}"]`).first()).toBeVisible();
    }
  });

  test('the takedown contact reaches a page that publishes one', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer.site-footer a[href="/support"]').last().click();
    await expect(page.locator('main h1')).toHaveText('Support');
    await expect(page.locator('.prose a[href="mailto:support@sonaru.app"]').first()).toBeVisible();
  });
});

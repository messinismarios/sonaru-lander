import { expect, test, type Page } from '@playwright/test';
import { CURRENCY, PRO_PLAN, formatPrice, monthlyEquivalentCents } from '../../src/data/pricing';

/**
 * The pricing route's behaviour - phases.md 8.7.
 *
 * Three things here are guards rather than coverage, and each has a specific failure
 * behind it:
 *
 * - **The `h1` is the claim, and the eyebrow is not a heading.** superlist.com/pricing
 *   inverts both: its `h1` is a 10px eyebrow and the huge wordmark is an unheaded `div`.
 *   `reference-study.md` flagged that as an SEO and heading-outline failure and marked it
 *   "Don't take", and it is the one part of that page's anatomy this page never copied -
 *   through two full rewrites of the band around it.
 * - **Both prices exist without JavaScript.** The island owns state, never content. If
 *   someone later makes the toggle rewrite the DOM, the no-JS test is what fails.
 * - **Hydration is observed, never assumed.** The toggle is `client:visible` and below the
 *   fold, so `data-billing` on `<html>` - which only the island's effect writes - is the
 *   discriminator, the same discipline `tests/motion-ready.ts` establishes for motion.
 */

const monthly = `${CURRENCY}${formatPrice(PRO_PLAN.monthlyCents)}`;
const yearlyPerMonth = `${CURRENCY}${formatPrice(monthlyEquivalentCents(PRO_PLAN))}`;

/** Waits until the billing island has mounted and claimed its state. */
async function waitForToggle(page: Page): Promise<void> {
  await page.locator('[data-plans-toggle]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.documentElement.dataset['billing'] !== undefined, {
    timeout: 15_000,
  });
}

/**
 * **There is deliberately no test that the page is linked from anywhere**, because there
 * is deliberately no link. The owner removed the header's `Pricing` link on 2026-09-06 and
 * confirmed it as intentional: it goes in when they decide the site should advertise the
 * route, not because the route exists. `/pricing` resolves for anyone who has the URL and
 * is reachable from nowhere on the site until then - a state `phases.md` 8.7 previously
 * called "not optional polish", now an owner decision that overrides it.
 */

test('the claim is the h1, and it is the only one', async ({ page }) => {
  await page.goto('/pricing');
  // Scoped to <main>: Playwright's locators pierce shadow DOM, and in dev the Astro
  // toolbar contributes an h1 of its own that is not part of the document outline.
  const headings = page.locator('main h1');
  await expect(headings).toHaveCount(1);
  await expect(headings.first()).toHaveText('Everything you came for is free.');
});

/**
 * A price is inside the first viewport - owner, Gate C rev 2: *"It's too big, nothing shows
 * on smaller screens."*
 *
 * The two rejected revisions both opened on a word large enough to fill the fold on its
 * own, which put every number below it. This is that complaint written as something that
 * can fail, at the narrowest and the widest of the approved viewports, so the band cannot
 * quietly grow back into a whole screen.
 */
for (const viewport of [
  { name: '390x844', width: 390, height: 844 },
  { name: '1440x900', width: 1440, height: 900 },
]) {
  test(`a price is visible without scrolling at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/pricing');

    /*
     * The *first* price on the page, whichever card it belongs to. At 1440 the cards sit
     * side by side and that is Free's; at 390 they stack, so Pro's price is a full card
     * below the fold no matter how short this band gets, and asserting on it would be
     * asserting something no layout can satisfy.
     */
    const top = await page
      .locator('[data-price]')
      .first()
      .evaluate((node) => node.getBoundingClientRect().top);

    expect(top).toBeLessThan(viewport.height);
  });
}

test('the monthly price is shown by default and the yearly one is hidden', async ({ page }) => {
  await page.goto('/pricing');
  await waitForToggle(page);

  await expect(page.locator('[data-price="monthly"]')).toBeVisible();
  await expect(page.locator('[data-price="yearly"]')).toBeHidden();
  await expect(page.locator('[data-price="monthly"]')).toContainText(monthly);
});

test('the toggle switches billing period with the keyboard alone', async ({ page }) => {
  await page.goto('/pricing');
  await waitForToggle(page);

  // A radiogroup, so the arrow key is the correct gesture and no click is needed.
  await page.getByRole('radio', { name: 'Monthly' }).focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByRole('radio', { name: /Yearly/ })).toBeChecked();
  await expect(page.locator('[data-price="yearly"]')).toBeVisible();
  await expect(page.locator('[data-price="yearly"]')).toContainText(yearlyPerMonth);
  await expect(page.locator('[data-price="monthly"]')).toBeHidden();
});

test('switching to yearly reveals the annualised line', async ({ page }) => {
  await page.goto('/pricing');
  await waitForToggle(page);

  await expect(page.locator('[data-note="yearly"]')).toBeHidden();
  await page.getByRole('radio', { name: /Yearly/ }).check();
  await expect(page.locator('[data-note="yearly"]')).toBeVisible();
  await expect(page.locator('[data-note="yearly"]')).toContainText(
    formatPrice(PRO_PLAN.yearlyTotalCents),
  );
});

/**
 * The page must not claim a price it cannot honour (`mission.md`). The numbers are the
 * owner's temporary ones, so the sentence admitting that is load-bearing copy, not
 * decoration - deleting it is a product statement and should fail a test.
 */
test('the indicative-pricing disclaimer is on the paid card', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText(/Indicative beta pricing/)).toBeVisible();
});

test('the FAQ opens and closes, and its structured data matches what is rendered', async ({
  page,
}) => {
  await page.goto('/pricing');

  const first = page.locator('[data-faq-item]').first();
  await expect(first.locator('p')).toBeHidden();
  await first.locator('summary').click();
  await expect(first.locator('p')).toBeVisible();

  const rendered = await page.$$eval('[data-faq-item] summary .question', (nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? ''),
  );
  const structured = await page.$eval('script[type="application/ld+json"]', (node) =>
    JSON.parse(node.textContent ?? '{}'),
  );

  expect(structured['@type']).toBe('FAQPage');
  expect(structured.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(rendered);
});

/**
 * The comparison table never grows a vertical scrollbar - owner, Gate C rev 1.
 *
 * The box scrolls **horizontally** on narrow viewports and in no other direction, but
 * `overflow-x: auto` promotes the other axis from `visible` to `auto`, and the entrance
 * animation leaves the last row 16px low until it lands. Measured, that overflowed the box
 * by exactly `ROW_RISE` for ~1.3 seconds - 42 frames of 60 - and Chrome drew a scrollbar
 * beside a section with nothing to scroll to.
 *
 * **The assertion is `scrollHeight > clientHeight`, and the first version of this test got
 * that wrong.** It compared `clientWidth` against `offsetWidth`, on the reasoning that a
 * scrollbar narrows the content box - which is true only of classic scrollbars. macOS
 * draws overlay scrollbars that consume no layout space at all, so that test passed
 * happily against the live bug. Scrollable overflow is the thing that actually makes the
 * scrollbar appear, and it is visible to script whether or not the scrollbar takes width.
 *
 * Sampled across the whole entrance rather than at the end: the defect existed only while
 * the rows were in flight, so an assertion after they settle passes against the bug too.
 */
test('the comparison table never shows a vertical scrollbar as it arrives', async ({ page }) => {
  await page.goto('/pricing');

  const overflowing = await page.evaluate(async () => {
    const scroller = () => document.querySelector('[data-compare-table]')?.parentElement;

    // Scrolled into view mid-sampling, so the entrance fires while we are watching it.
    setTimeout(() => scroller()?.scrollIntoView({ block: 'center' }), 300);

    const frames: { scrollHeight: number; clientHeight: number }[] = [];
    for (let i = 0; i < 60; i += 1) {
      const element = scroller();
      if (element) {
        frames.push({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight });
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return frames.filter((frame) => frame.scrollHeight > frame.clientHeight);
  });

  expect(overflowing).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('both prices are in the HTML and the monthly one is shown', async ({ page }) => {
    await page.goto('/pricing');

    // Present in the document - the island renders state, not content.
    await expect(page.locator('[data-price="monthly"]')).toContainText(monthly);
    await expect(page.locator('[data-price="yearly"]')).toContainText(yearlyPerMonth, {
      useInnerText: false,
    });

    // ...and monthly is the state a page with no island resolves to.
    await expect(page.locator('[data-price="monthly"]')).toBeVisible();
  });

  test('the FAQ still opens', async ({ page }) => {
    await page.goto('/pricing');

    const first = page.locator('[data-faq-item]').first();
    await first.locator('summary').click();
    await expect(first.locator('p')).toBeVisible();
  });

  test('the comparison table is complete', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('[data-compare-row]')).toHaveCount(5);
  });
});

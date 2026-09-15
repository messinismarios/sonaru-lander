import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, isShippingRoute } from '../visual/routes';
import { waitForOpacityToSettle } from '../motion-ready';

/**
 * Zero WCAG 2.2 A/AA violations, on every shipping route - phases.md 8.12a.
 *
 * **The state a page is in when axe runs decides what axe reports**, and that is not a
 * theoretical worry: measured 600ms after load, `/pricing`'s primary call to action reports
 * **3.9:1** - `#838283` on `#4c0b35`. Settled, the same element is `#fafafa` on `#8d0b5e`
 * and clean. The grey is the button part-way through an entrance it has not finished. A
 * guard that races the entrance fails intermittently, and an intermittent guard teaches
 * everyone to re-run it, which is worse than not having one.
 *
 * **So the blocking matrix is the deterministic one: reduced motion.** Under
 * `prefers-reduced-motion` no entrance runs at all - `tests/e2e/reduced-motion.spec.ts`
 * asserts exactly that, route by route - so every section is at its resting, visible state
 * from the first frame and two runs cannot disagree. Three widths, every route.
 *
 * **Default motion is checked too, at one width, after the entrances have played.** It is a
 * cross-check rather than the bar: it catches anything the reduced-motion branch hides, which
 * this repo has been bitten by twice (8.11b's prose underline, and 8.11e's +38px baselines).
 * Getting there needs the page scrolled, because ScrollTrigger holds a section at its
 * pre-entrance opacity until it is reached - which is what the CTA above actually was.
 *
 * **Both matrices wait on two things, and each one alone is insufficient.** This took three
 * attempts and the failures are worth keeping, because they are the same defect from three
 * sides:
 *
 *   1. A fixed pause. Failed on a different width every run.
 *   2. `waitForOpacityToSettle` alone - sample every element's opacity, wait, sample again,
 *      require agreement. It made the failure **reproducible**, which looked like progress,
 *      and it was measuring a page whose JavaScript had not run yet: **a page that has not
 *      started animating is exactly as stable as one that has finished.** That is the trap
 *      `tests/motion-ready.ts`'s own header describes - "a dead page and a page scrolled to
 *      the top are indistinguishable".
 *   3. `networkidle` **and then** the opacity settle. The first closes the window before the
 *      motion module has executed; the second closes the window while it is still running.
 *
 * `networkidle` is not being used as a motion-ready signal here - that is the thing
 * `motion-ready.ts` correctly warns against. It is the precondition that makes the settle
 * check mean something, because a module that has not been fetched cannot have run.
 *
 * There is no better signal to wait on: GSAP is bundled as a module and never reaches
 * `window`, and `motion-ready.ts`'s other two helpers watch one section's own inline
 * property, which is per-section by construction and does not generalise to seventeen routes.
 *
 * **`best-practice` is measured and logged, never blocking.** The owner's bar is WCAG 2.2 AA.
 * That rule set moves between axe releases, and a dependency bump must not turn this suite red.
 */

/**
 * The precondition that makes the opacity check mean something.
 *
 * **Bounded, and it is allowed to give up.** `/waitlist` embeds Cloudflare Turnstile, whose
 * script keeps the connection busy, so that route **never** reaches `networkidle` - left
 * unbounded it failed all four of its checks on a 30s timeout while reporting nothing about
 * accessibility at all. Five seconds is far longer than any local module needs, and when it
 * lapses the settle check below still has to pass.
 *
 * `load` alone is not enough, which is the subtlety: module scripts execute before it, but
 * `initScrollMotion()` reaches ScrollTrigger and Lenis through `await import(...)`, and those
 * resolve *after* `load` has already fired.
 */
async function waitForModulesToRun(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await waitForOpacityToSettle(page);
}

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHIPPING = ROUTES.filter(isShippingRoute);

/** Reported so a regression names its rule and its element, not just a count. */
function summarise(
  violations: { id: string; impact?: string | null; nodes: { target: unknown }[] }[],
): string {
  // The targets as well as the count: "color-contrast x1" alone, at 8.14's copy pass, named a
  // rule and no element, and could not be reproduced outside the suite to find one.
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.map((n) => String(n.target)).join(' | ')}`,
    )
    .join(', ');
}

test.describe('accessibility - reduced motion, the blocking matrix', () => {
  for (const width of [1280, 768, 390]) {
    for (const route of SHIPPING) {
      test(`${route} has no WCAG 2.2 A/AA violation at ${width}`, async ({ page }) => {
        /* `emulateMedia` and not `test.use`, which is the idiom `prose-decoration.spec.ts`
         * already uses - and the only one that type-checks against this Playwright's fixtures.
         * Set before navigating, so the first render is already the reduced one. */
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: 'load' });
        await waitForModulesToRun(page);

        const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(summarise(results.violations), `${route} at ${width}`).toBe('');
      });
    }
  }
});

test.describe('accessibility - default motion, after the entrances have played', () => {
  for (const route of SHIPPING) {
    test(`${route} has no WCAG 2.2 A/AA violation in default motion`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'load' });
      await waitForModulesToRun(page);

      /*
       * Walk the page the way a reader does, so every ScrollTrigger entrance has fired before
       * anything is measured. Back to the top afterwards, because a scrubbed section left
       * part-way through its own timeline is the state this file exists to avoid measuring.
       *
       * **`instant`, because `Base.astro` sets `scroll-behavior: smooth`** and a bare
       * `scrollTo` animates. The return to the top was still travelling when axe ran (8.14,
       * measured at 63px), leaving act one's first word mid-scrub at 0.28 opacity 1,835px below
       * the fold. It only surfaced once `bloom-rest.ts` stopped drawing the far-away act one
       * bloom: over a gradient axe cannot measure contrast and reported nothing.
       */
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.75;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 90));
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 600));
      });
      await waitForOpacityToSettle(page);

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(summarise(results.violations), route).toBe('');
    });
  }
});

test('best-practice rules are reported, and do not block', async ({ page }) => {
  /* One test walks every shipping route sequentially, so the default 30s budget is a route
   * count away from failing on a loaded CI runner - not a defect in what it is checking. */
  test.setTimeout(120_000);
  const noted: string[] = [];
  for (const route of SHIPPING) {
    await page.goto(route, { waitUntil: 'load' });
    const results = await new AxeBuilder({ page }).withTags(['best-practice']).analyze();
    if (results.violations.length) noted.push(`${route}: ${summarise(results.violations)}`);
  }
  /* Printed rather than asserted - see this file's header. A build is never red for these.
   * `console.warn` because the lint rule allows only `warn` and `error`, and advisory is
   * exactly what this is. */
  if (noted.length) console.warn(`axe best-practice:\n  ${noted.join('\n  ')}`);
  expect(true).toBe(true);
});

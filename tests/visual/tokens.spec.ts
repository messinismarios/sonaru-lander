import { expect, test } from '@playwright/test';

import { ROUTES } from './routes';

/**
 * Every custom property the stylesheets reference must actually resolve.
 *
 * This exists because of a real failure. `tokens.css` binds the design tokens through
 * Tailwind's `@theme`, and Tailwind emits a theme variable only when something
 * references it - so a declared token can resolve to an empty string. `var(--spacing-6)`
 * then falls back to nothing, `padding` computes to `0px`, and the page renders with no
 * spacing at all while every stylesheet still looks correct and the build stays green.
 *
 * It is a silent failure by construction: no error, no warning, no failed assertion
 * anywhere else in the suite. The fix was `@theme static`, but the guard is this test -
 * the class of bug matters more than the instance.
 */

/**
 * Tailwind's internal registers (`--tw-blur`, `--default-font-feature-settings`, …) are
 * referenced with empty fallbacks on purpose - they hold nothing until a utility sets
 * them. They are not our tokens and an empty value is correct, so the check covers
 * Sonaru's own properties only.
 */
const THIRD_PARTY = /^--(tw|default)-/;

/**
 * Referenced-but-undefined names of *ours* that are deliberate, with the reason. Keep
 * this short and justified; it is an allowlist, not a silencer.
 */
const ALLOWED_UNRESOLVED = new Set<string>([
  /*
   * An override slot on Wordmark, read as `var(--wm-face, var(--font-logotype))`. It is
   * set only when a caller passes `face` to compare an alternative typeface, so being
   * undefined is the normal state and the fallback is the point. Listed rather than
   * silenced, because the check is worth more than the one exception.
   */
  '--wm-face',
  /*
   * 8.14c's phone geometry. `Feed.astro` and `Notify.astro` declare these inside their own
   * `max-width: 767px` blocks and read them only inside those blocks, so at the desktop
   * viewport this suite runs at they are referenced by the stylesheet and defined on no
   * element - which is correct, not dead. Every one is exercised at 390 by `feed.spec.ts` and
   * `notify.spec.ts`, whose baselines would not render without them.
   */
  '--aside-fraction',
  '--aside-scale',
  '--aside-span',
  '--aside-x',
  '--copy-gap-above',
  '--copy-gap-below',
  '--copy-h',
  '--copy-zone',
  '--date-start',
  '--date-step',
  '--halo-w',
  '--mobile-device-h',
  '--phone-left',
  '--phone-w',
  '--pin-h',
  '--release-gap',
  '--stamp-h',
]);

for (const route of ROUTES) {
  test(`every custom property referenced by ${route} resolves`, async ({ page }) => {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);

    const unresolved = await page.evaluate(() => {
      /** Names referenced through var() anywhere in our own stylesheets. */
      const referenced = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin; not ours to check
        }
        for (const rule of Array.from(rules)) {
          for (const match of rule.cssText.matchAll(/var\(\s*(--[\w-]+)/g)) {
            const name = match[1];
            if (name !== undefined && !/^--(tw|default)-/.test(name)) referenced.add(name);
          }
        }
      }

      /*
       * A token may be scoped to an element rather than :root - the bloom act hues live
       * on the BloomField element, for instance. So a name counts as resolved if *any*
       * element resolves
       * it, and only counts as dead if nothing on the page does.
       */
      const elements = [document.documentElement, ...Array.from(document.querySelectorAll('*'))];
      const dead: string[] = [];
      for (const name of referenced) {
        const alive = elements.some(
          (element) => getComputedStyle(element).getPropertyValue(name).trim() !== '',
        );
        if (!alive) dead.push(name);
      }
      return dead.sort();
    });

    const unexpected = unresolved.filter(
      (name) => !ALLOWED_UNRESOLVED.has(name) && !THIRD_PARTY.test(name),
    );
    expect(unexpected, `${route} references custom properties that resolve to nothing`).toEqual([]);
  });
}

/**
 * The specific symptom, asserted directly: the spacing scale is what the hand-written
 * CSS leans on hardest, and a zero here is invisible in code review.
 */
test('the spacing scale from design-system.md §4 is present', async ({ page }) => {
  await page.goto('/specimen');

  const scale = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const steps = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48];
    return Object.fromEntries(
      steps.map((step) => [step, root.getPropertyValue(`--spacing-${step}`).trim()]),
    );
  });

  expect(scale).toEqual({
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
    12: '48px',
    16: '64px',
    24: '96px',
    32: '128px',
    48: '192px',
  });
});

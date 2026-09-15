import { expect, test } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * Nothing drifts when a visitor has asked for stillness - every route, measured.
 *
 * **This suite exists because the visual suite cannot see this defect, and that was
 * proved rather than assumed.** From 8.1 until 2026-09-08 `BloomField`'s reduced-motion
 * block set `animation: none` on `.orb > i` - specificity 0-1-1 - while the animation it
 * was cancelling is declared on `.orb.a > i` at 0-2-1. The override lost, and the blooms
 * went on drifting under reduced motion on every route of the site. `design-system.md` §5
 * and the appearance approved at 8.1 both say that field is static.
 *
 * Eighteen running animations on `/` with the media feature matching, and **not one
 * failing test**: `tests/visual/support.ts`'s `freeze()` neutralises every animation before
 * each screenshot, so the snapshot is identical whether the defect is present or not.
 * Re-introducing it on purpose and regenerating produced **0 changed baselines out of 15**.
 * A screenshot suite is the wrong instrument for "is this still moving"; this is the right
 * one.
 *
 * Scroll-driven animations are deliberately in scope but expected: the header's scrim
 * tracks scroll rather than time, moves nothing, and is correct under reduced motion -
 * see `header.spec.ts` for why it is not pinned to a final state.
 */

/** The OG camera stands render no layout at all - the same exclusion `footer.spec.ts` makes. */
const PAGES = ROUTES.filter((route) => !isCameraStand(route));

test.describe('under prefers-reduced-motion', () => {
  for (const route of PAGES) {
    test(`nothing on ${route} is driven by the clock`, async ({ page }) => {
      /*
       * `page.emulateMedia`, not `test.use({ reducedMotion })`.
       *
       * The first version of this file used the fixture option inside this `describe` and
       * it silently did not apply - the media feature was `false` in every test, so the
       * suite reported three passes while measuring a page with no reduced motion emulated
       * at all. The precondition below is what caught it, and it stays for that reason: a
       * guard whose setup can quietly fail is worse than no guard, because it also
       * reports success.
       */
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      /*
       * `load`, not `networkidle`: `/waitlist` embeds Cloudflare Turnstile, which holds a
       * connection open, so the page never goes idle and the wait times out at 30s. The
       * 600ms after it is what actually matters here - long enough for anything deferred
       * to have started if it were going to.
       */
      await page.waitForTimeout(600);

      const matches = await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
      expect(matches, 'the emulation did not take effect').toBe(true);

      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running')
          .filter((animation) => animation.timeline === document.timeline)
          .map((animation) => {
            const name = (animation as unknown as { animationName?: string }).animationName;
            return name ?? animation.constructor.name;
          }),
      );

      expect(running, `${route} runs time-driven animation under reduced motion`).toEqual([]);
    });
  }
});

test.describe('under prefers-reduced-motion, below md', () => {
  /*
   * 8.14c round 8 (owner): phones keep the full motion build under Reduce Motion, and the
   * only effect it still removes is the hero's text glow. Asserted in both directions, so a
   * reduced-motion rule that loses its `min-width` fails here and one that the glow escapes
   * fails too.
   */
  test('the home route keeps its motion and drops only the text glow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(600);

    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => (animation as unknown as { animationName?: string }).animationName),
    );

    expect(running, 'the hero field stopped breathing').toContain('hero-atmosphere-breathe');
    expect(running, 'the blooms stopped drifting').toContain('orbit-a');
    expect(running, 'the hero text glow still runs').not.toContain('turn-glow');
  });
});

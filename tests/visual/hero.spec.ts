import { expect, test, type Page } from '@playwright/test';
import { freeze, settleAt, shootReduced, SHOT, VIEWPORTS } from './support';
import { waitForScrubbedMotion } from '../motion-ready';

/**
 * The mechanism that freezes an approved design (`review-gates.md` §3.5): once the owner
 * has passed Gate C on the hero, a diff against these snapshots fails CI. "It looks better
 * now" is not a reason to update them - a new gate is.
 *
 * **Rewritten for the 2026-09-03 restructure.** The previous matrix froze four states of
 * a device growing and a feed paging, both of which now live in `Feed.astro` - see
 * `feed.spec.ts`, which inherited them. What is left in the hero is copy and one signal:
 * `--blackout`, a single eased ramp across the `lights` spacer, followed by a `hold`
 * spacer that drives nothing while the promise stands alone on black (`hero.ts`).
 *
 * The states below are that curve's own shape, derived from the hero's two spacers rather
 * than from fractions written down here, so changing the scroll budget in the CSS moves
 * the snapshots with it.
 */

/** The scroll each of the hero's two budgets is given, in pixels, at this viewport. */
async function budget(page: Page): Promise<{ lights: number; hold: number }> {
  return page.evaluate(() => ({
    lights: (document.querySelector('[data-hero-lights]') as HTMLElement).offsetHeight,
    hold: (document.querySelector('[data-hero-hold]') as HTMLElement).offsetHeight,
  }));
}

/**
 * The frames worth freezing, named by what the visitor is looking at.
 *
 * `mid-lights` is not decoration: both endpoints can look right while everything between
 * them travels wrongly, and in the `recede` text variant the copy's scale and drift ride
 * this exact signal, so the middle of the ramp is the only frame that proves it.
 */
const STATES = [
  { name: 'rest', at: () => 0 },
  { name: 'mid-lights', at: (lights: number) => lights * 0.5 },
  { name: 'lights-out', at: (lights: number) => lights },
  { name: 'hold', at: (lights: number, hold: number) => lights + hold },
] as const;

/** Everything in the hero whose rendered state a scroll can still be moving. */
const PROBES = ['.hero .copy', '.hero .blackout', '.hero .atmosphere'] as const;

for (const viewport of VIEWPORTS) {
  test(`hero at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    /*
     * **Below `md` the hero has no scroll states** (8.14c): nothing sets `--blackout`, both
     * budgets are 0svh, and `.atmosphere` breathes on an endless keyframe, so waiting for the
     * one or for the other to go still timed out on every run. The phone build is its own
     * signal (`--hero-mobile-orb-scale`) and one frame - the rest - shot after `freeze()` has
     * seeked the breathing to a fixed point.
     */
    const phone = viewport.width < 768;
    await waitForScrubbedMotion(
      page,
      '[data-hero-stage]',
      phone ? '--hero-mobile-orb-scale' : '--blackout',
    );

    const { lights, hold } = await budget(page);

    for (const state of phone ? STATES.slice(0, 1) : STATES) {
      await settleAt(page, state.at(lights, hold), phone ? ['.hero .copy'] : PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(`hero-${viewport.name}-default-${state.name}.png`, SHOT);
    }

    await context.close();
  });

  test(`hero at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The lights stay on and nothing travels (`hero.ts`'s `reduced` branch), so there is
    // one frame rather than four.
    await shootReduced(page, `hero-${viewport.name}-reduced.png`);

    await context.close();
  });
}

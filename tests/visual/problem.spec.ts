import { expect, test, type Page } from '@playwright/test';
import { freeze, settleAt, shootReduced, SHOT, VIEWPORTS } from './support';
import { waitForPinnedMotion } from '../motion-ready';

/**
 * Act one - phases.md 8.3, approved at Gate C rev 18 (`gate-log.md`) and unprotected by
 * anything until now. `review-gates.md` §3.5 makes an approved section's appearance
 * frozen and `acceptance-criteria.md` §5 names this suite as what enforces it; act one
 * having passed its gate with no snapshot behind it was the gap.
 *
 * **Act one measures itself differently from the other two sections**, and this is the
 * whole reason it needs its own file rather than another entry in a shared matrix. The
 * hero and act two pin with `position: sticky` and expose their scroll budgets as their
 * own spacer elements, which a test can simply read. Act one is the site's one genuine
 * ScrollTrigger pin (`problem.ts`), so its budget is not in the markup at all - GSAP
 * creates a `.pin-spacer` wrapper at runtime and puts it there. That wrapper is what
 * `budget` below reads, which keeps `PIN_DISTANCE` a single source of truth in
 * `problem.ts` instead of a number duplicated into this file.
 *
 * The pin also runs `scrub: SCRUB` (`tokens.ts`, currently 1) - a full second of
 * smoothing - so every frame here is genuinely *settled at* rather than scrolled to.
 * `settleAt` handles that by sampling until the page stops changing.
 */

/** Where act one's pin starts and how much scroll it is given, read from GSAP's own wrapper. */
async function budget(page: Page): Promise<{ start: number; distance: number }> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-problem-stage]') as HTMLElement;
    const spacer = stage.parentElement;
    if (!spacer?.classList.contains('pin-spacer')) {
      throw new Error('act one is not pinned: ScrollTrigger created no pin-spacer');
    }
    // The spacer is the pinned element's own height plus the distance it is held for.
    return { start: spacer.offsetTop, distance: spacer.offsetHeight - stage.offsetHeight };
  });
}

/**
 * The choreography's four landmarks. Act one is a long single pin in which several
 * things happen in sequence - the atmosphere arrives, the headline reveals word by word,
 * the artist chips drift and resolve, then the whole thing leaves - so a first and last
 * frame would prove almost nothing about the middle, which is where the section actually
 * lives.
 */
const STATES = [
  { name: 'entering', at: () => 0 },
  { name: 'headline', at: (distance: number) => distance * 0.3 },
  { name: 'chips', at: (distance: number) => distance * 0.6 },
  { name: 'outro', at: (distance: number) => distance * 0.95 },
] as const;

/** Everything act one scrubs: the copy, the drifting field, and the bloom behind both. */
const PROBES = [
  '.problem [data-word]',
  '.problem [data-problem-sub]',
  '.problem [data-problem-actions]',
  '.problem [data-chip]',
  '.problem [data-particle]',
  '.problem [data-problem-atmosphere]',
] as const;

for (const viewport of VIEWPORTS) {
  // 8.14c: below `md` (767px and under) `problem.ts` drops the pin entirely and reveals
  // once instead - no `.pin-spacer`, so `budget()` and the four scrubbed landmarks below
  // don't apply. One settled frame, the same way `pricing.ts`'s non-pinned reveal is
  // proven - scroll the section into view and let the reveal play through.
  const isMobile = viewport.width < 768;

  test(`act one at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (isMobile) {
      const stageTop = await page
        .locator('[data-problem-stage]')
        .evaluate((el) => (el as HTMLElement).offsetTop);
      await settleAt(page, stageTop, PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(`problem-${viewport.name}-default-revealed.png`, SHOT);
      await context.close();
      return;
    }

    await waitForPinnedMotion(page);

    const { start, distance } = await budget(page);

    for (const state of STATES) {
      await settleAt(page, start + state.at(distance), PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(
        `problem-${viewport.name}-default-${state.name}.png`,
        SHOT,
      );
    }

    await context.close();
  });

  test(`act one at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // `problem.ts`'s reduced branch creates no ScrollTrigger and no pin at all - "not a
    // still pin, no pin" - so the section is simply in flow and has to be scrolled to.
    await page.locator('[data-problem-stage]').scrollIntoViewIfNeeded();
    await shootReduced(page, `problem-${viewport.name}-reduced.png`);

    await context.close();
  });
}

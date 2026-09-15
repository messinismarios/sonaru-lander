import { expect, test, type Page } from '@playwright/test';
import { freeze, settleAt, shootReduced, SHOT, VIEWPORTS } from './support';
import { waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * Act two - phases.md 8.4, approved at Gate C rev 7 (`gate-log.md`). This suite is the
 * hero matrix's real successor: the device growth and the paged feed it froze are the
 * same mechanism, moved here on 2026-09-03, so the states below are the old ones
 * re-derived against `Feed.astro`'s spacers.
 *
 * **Growth happens on the approach, not inside the pin** (`promise.ts`: `--feed-p` is
 * driven by `observeScrollProgress`'s `entry`, not its `progress`). That is why
 * `mid-growth` below is at a *negative* offset from the section's top - it is one of the
 * frames before the section has finished scrolling in, and reading it off the pin's own
 * budget the way the hero version did would place it a whole viewport too far down. The
 * comment is here because that exact mistake was made once already, in the spec this one
 * replaces.
 */

interface Budget {
  /** Document offset at which the section's top meets the viewport's top, and growth ends. */
  readonly top: number;
  /** The approach growth is spread across - one pin height (`scroll-progress.ts`). */
  readonly approach: number;
  /** Scroll allocated to one feed advance. */
  readonly advance: number;
  readonly advances: number;
  readonly feed: number;
  readonly rest: number;
  readonly settle: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-feed-stage]') as HTMLElement;
    const pin = document.querySelector('[data-feed-pin]') as HTMLElement;
    const feed = (document.querySelector('[data-feed-feed-travel]') as HTMLElement).offsetHeight;
    const rest = (document.querySelector('[data-feed-rest]') as HTMLElement).offsetHeight;
    const settle = (document.querySelector('[data-feed-settle]') as HTMLElement).offsetHeight;
    const advances = Number(getComputedStyle(stage).getPropertyValue('--advances'));
    return {
      top: stage.offsetTop,
      approach: pin.offsetHeight,
      advance: advances > 0 ? feed / advances : 0,
      advances,
      feed,
      rest,
      settle,
    };
  });
}

/**
 * The composition at each phase the section is built out of. Every offset is absolute,
 * because unlike the hero this section does not start at the top of the document.
 */
const STATES = [
  // Halfway through the approach: the phone is on screen and still growing.
  { name: 'mid-growth', at: (b: Budget) => b.top - b.approach * 0.5 },
  // The pin engages exactly as growth completes - the frame act one's CTA lands on.
  { name: 'grown', at: (b: Budget) => b.top },
  { name: 'advanced', at: (b: Budget) => b.top + b.advance },
  // The last release has arrived and the cyan atmosphere is fully lit.
  { name: 'feed-end', at: (b: Budget) => b.top + b.feed },
  // The outro: the device settled smaller with the section's copy beneath it.
  { name: 'settled', at: (b: Budget) => b.top + b.feed + b.rest + b.settle },
] as const;

/** The device, the margin stamps, and the copy that arrives with the outro. */
const PROBES = [
  '.feed [data-feed-track]',
  '.feed .device-slot',
  '.feed [data-stamp]',
  '.feed .copy',
  '.feed .atmosphere',
] as const;

for (const viewport of VIEWPORTS) {
  // 8.14c: below `md`, `promise.ts`'s `full` branch skips `observeScrollProgress` entirely
  // and sets the resting values once instead - no scrub to land on five landmarks for, and
  // act one's own pin is gone too (`problem.ts`, same breakpoint), so there is no 2100px
  // spacer to wait for either. One settled frame, same discipline as `problem.spec.ts`.
  const isMobile = viewport.width < 768;

  test(`act two at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (isMobile) {
      // 8.14c: this act pins below `md` too - the one of the five that does - but it
      // spends the pin on a different choreography: the phone moves aside, the feed pages
      // in the space beside the dates, then it comes back and the copy lands. Three
      // landmarks rather than desktop's five, read off the same spacers the timeline does.
      await waitForScrubbedMotion(page, '[data-feed-stage]', '--feed-aside');

      // The landmarks are the date column's own positions, because below `md` the column
      // is what the section is built around: it is laid out in CSS and never animated, and
      // the feed follows whichever date is level with the phone. Reading the stamps is
      // therefore reading the same thing `promise.ts` reads, rather than a spacer budget
      // that no longer exists at this width.
      const mobile = await page.evaluate(() => {
        const stage = document.querySelector('[data-feed-stage]') as HTMLElement;
        const documentTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
        const stamps = [...document.querySelectorAll('[data-stamp]')].map(documentTop);
        const pin = document.querySelector('[data-feed-pin]') as HTMLElement;
        const device = document.querySelector('.feed .device-slot') as HTMLElement;
        return {
          top: stage.offsetTop,
          stamps,
          copy: documentTop(document.querySelector('.feed .copy') as Element),
          half: window.innerHeight / 2,
          // Where the phone stops being held: the pin's own end, pulled up by the device's
          // bottom margin (which is what releases it before the copy - see `Feed.astro`).
          unpinsAt:
            documentTop(pin) +
            pin.offsetHeight -
            Number.parseFloat(getComputedStyle(device).marginBottom || '0') -
            device.offsetHeight,
        };
      });

      const states = [
        // Centred and full size, the moment it pins - before it moves aside.
        { name: 'pinned', at: mobile.top },
        // Aside, with the first date drawn level with it.
        { name: 'aside', at: (mobile.stamps[0] ?? 0) - mobile.half },
        // Further down the column: a later release, a later date, the phone unmoved.
        { name: 'calendar', at: (mobile.stamps[2] ?? 0) - mobile.half },
        // Flipped back to the middle, still held - the last thing the pin does.
        { name: 'centred', at: mobile.unpinsAt - 40 },
        // The copy, simply scrolled to - the phone has unpinned and left, still aside.
        { name: 'copy', at: mobile.copy - mobile.half },
      ] as const;

      for (const state of states) {
        await settleAt(page, state.at, PROBES);
        await freeze(page);
        await expect(page).toHaveScreenshot(
          `feed-${viewport.name}-default-${state.name}.png`,
          SHOT,
        );
      }

      await context.close();
      return;
    }

    // Act one's pin is 2100px of document above this section; `offsetTop` is wrong until
    // it exists (`motion-ready.ts`).
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-feed-stage]', '--feed-p');

    const measured = await budget(page);

    for (const state of STATES) {
      await settleAt(page, state.at(measured), PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(`feed-${viewport.name}-default-${state.name}.png`, SHOT);
    }

    await context.close();
  });

  test(`act two at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // `promise.ts`'s reduced branch composes one designed still: fully grown, fully lit,
    // settled, resting on the release after the first.
    await page.locator('[data-feed-stage]').scrollIntoViewIfNeeded();
    await shootReduced(page, `feed-${viewport.name}-reduced.png`);

    await context.close();
  });
}

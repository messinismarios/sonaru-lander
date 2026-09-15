import { expect, test, type Page } from '@playwright/test';
import { freeze, settleAt, shootReduced, SHOT, VIEWPORTS } from './support';
import { waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * The auto-add act - phases.md 8.6.
 *
 * Three frames, and the first two are the assertion this section most needs: `idle` and
 * `landed` differ by exactly one row and one piece of copy, which is the whole act. A
 * suite that only shot the finished composition would prove nothing about the thing the
 * owner approved at Gate A - that the list *was already there* and one thing happened to
 * it.
 *
 * The `closing` and `closed` frames went to `notify.spec.ts` with the CTA on 2026-09-04.
 * `resting` replaces them: this section now hands over to another one rather than ending
 * the page, and what it hands over is the frame worth holding onto.
 */

interface Budget {
  readonly top: number;
  readonly idle: number;
  readonly arrive: number;
  readonly travel: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
    return {
      top: stage.offsetTop,
      travel:
        stage.offsetHeight -
        (document.querySelector('[data-playlist-pin]') as HTMLElement).offsetHeight,
      idle: (document.querySelector('[data-playlist-idle]') as HTMLElement).offsetHeight,
      arrive: (document.querySelector('[data-playlist-arrive]') as HTMLElement).offsetHeight,
    };
  });
}

const STATES = [
  // The list as it was before the visitor got here: populated, unlabelled, doing nothing.
  { name: 'idle', at: (b: Budget) => b.top + b.idle * 0.5 },
  // The row has landed and the headline has landed with it, on the same frame.
  { name: 'landed', at: (b: Budget) => b.top + b.idle + b.arrive * 0.9 },
  // The frame the section hands to the notification act, held through the trailing rest.
  { name: 'resting', at: (b: Budget) => b.top + b.travel },
] as const;

/** The list, the arriving row, and the copy that rides it. */
const PROBES = [
  '.playlist [data-playlist-stack]',
  '.playlist [data-playlist-landing]',
  '.playlist [data-playlist-settled]',
  '.playlist [data-playlist-copy]',
] as const;

for (const viewport of VIEWPORTS) {
  test(`the auto-add act at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (viewport.width < 768) {
      // 8.14c: no pin below `md`, and no act-one pin above it to wait for. Two frames either
      // side of 12% of the way in, which is where the row lands at this width (round 3).
      await waitForScrubbedMotion(page, '[data-playlist-stage]', '--playlist-row');
      const mobile = await page.evaluate(() => {
        const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
        const top = stage.getBoundingClientRect().top + window.scrollY;
        return { top, height: stage.offsetHeight, half: window.innerHeight / 2 };
      });

      for (const state of [
        { name: 'idle', at: mobile.top + mobile.height * 0.02 - mobile.half },
        { name: 'landed', at: mobile.top + mobile.height * 0.4 - mobile.half },
      ]) {
        await settleAt(page, state.at, PROBES);
        await freeze(page);
        await expect(page).toHaveScreenshot(
          `playlist-${viewport.name}-default-${state.name}.png`,
          SHOT,
        );
      }

      await context.close();
      return;
    }

    // Act one's ScrollTrigger pin is 2100px of document above this section; `offsetTop` is
    // wrong until it exists (`motion-ready.ts`).
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-playlist-stage]', '--playlist-row');

    const measured = await budget(page);

    for (const state of STATES) {
      await settleAt(page, state.at(measured), PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(
        `playlist-${viewport.name}-default-${state.name}.png`,
        SHOT,
      );
    }

    await context.close();
  });

  test(`the auto-add act at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // `playlist.ts`'s reduced branch composes the section's conclusion - the row landed and
    // the copy present - rather than the idle list it opens on.
    await page.locator('[data-playlist-stage]').scrollIntoViewIfNeeded();
    await shootReduced(page, `playlist-${viewport.name}-reduced.png`);

    await context.close();
  });
}

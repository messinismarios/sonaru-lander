import { expect, test, type Page } from '@playwright/test';
import { scrollToAndSettle, waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * Act one's scroll contract - phases.md 8.3, approved at Gate C rev 18.
 *
 * The site's one genuine ScrollTrigger pin. Everything else on the route pins with
 * `position: sticky` and reports progress through `scroll-progress.ts`; act one is the
 * exception, so the things worth asserting about it are different in kind - that the pin
 * exists at all in full motion, that it does *not* exist under reduced motion
 * ("not a still pin, no pin" - `problem.ts`), and that the reveal it drives actually
 * completes rather than leaving the headline part-faded at the end of the section.
 *
 * It also owns the site's only "See how it works" call to action, moved here from the
 * hero on 2026-09-03 so that the offer to be shown the product lands after the problem
 * has been stated. Where that button *arrives* is act two's most load-bearing
 * frame - the phone at full size - and the assertion below is the old hero spec's, kept
 * because it caught a real off-by-a-viewport once already.
 */

/** Where act one's pin starts and how much scroll it is given, from GSAP's own wrapper. */
async function budget(page: Page): Promise<{ start: number; distance: number }> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-problem-stage]') as HTMLElement;
    const spacer = stage.parentElement;
    if (!spacer?.classList.contains('pin-spacer')) {
      throw new Error('act one is not pinned: ScrollTrigger created no pin-spacer');
    }
    return { start: spacer.offsetTop, distance: spacer.offsetHeight - stage.offsetHeight };
  });
}

/**
 * The pin's own box and the words its `scrub: 1` reveal fades. `scrollToAndSettle` waits
 * for both to stop moving, so the second of smoothing is waited out rather than guessed at.
 */
const PROBES = [
  { selector: '[data-problem-stage]', properties: ['rect.top'] },
  { selector: '[data-word]', properties: ['opacity'] },
] as const;

test.describe('act one - the problem', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForPinnedMotion(page);
  });

  test('the section pins, and holds still while its choreography plays', async ({ page }) => {
    const { start, distance } = await budget(page);

    // Pinned means the section's own box stops moving while the page keeps scrolling.
    const positions: number[] = [];
    for (const fraction of [0.1, 0.4, 0.7]) {
      await scrollToAndSettle(page, start + distance * fraction, PROBES);
      positions.push(
        await page.evaluate(
          () =>
            (document.querySelector('[data-problem-stage]') as HTMLElement).getBoundingClientRect()
              .top,
        ),
      );
    }

    for (const top of positions) {
      expect(
        Math.abs(top),
        `act one moved to ${top} while it should have been pinned`,
      ).toBeLessThan(2);
    }
  });

  test('the headline is fully revealed by the time the pin releases', async ({ page }) => {
    const { start, distance } = await budget(page);

    // Before the section arrives the words are not there yet. Measured from the top of
    // the page rather than from just above the pin, because the reveal deliberately does
    // *not* wait for the pin: it runs on its own separate, non-pinning ScrollTrigger
    // (`problem.ts`) that starts well up the run-up, so the headline is already most of
    // the way in by the time the pin engages. Asserting just above `start` would be
    // asserting the opposite of the designed behaviour.
    await scrollToAndSettle(page, 0, PROBES);
    const before = await page.evaluate(() =>
      Number(getComputedStyle(document.querySelector('[data-word]') as HTMLElement).opacity),
    );
    expect(before, 'the headline is already revealed at the top of the page').toBeLessThan(0.5);

    // ...and by the middle of the pin every one of them is, with none left part-faded.
    await scrollToAndSettle(page, start + distance * 0.45, PROBES);
    const opacities = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-word]')).map((word) =>
        Number(getComputedStyle(word).opacity),
      ),
    );

    expect(opacities.length, 'the headline was not split into words').toBeGreaterThan(5);
    opacities.forEach((opacity, index) => {
      expect(opacity, `word ${index} never finished arriving`).toBeGreaterThan(0.95);
    });
  });

  test('"See how it works" lands exactly where the phone reaches full size', async ({ page }) => {
    // This assertion reads act two's `--feed-p`, so act two's timeline has to be live as
    // well as act one's pin.
    await waitForScrubbedMotion(page, '[data-feed-stage]', '--feed-p');
    await page
      .locator('[data-problem-actions]')
      .getByRole('link', { name: 'See how it works' })
      .click();

    const target = await page.evaluate(
      () => (document.querySelector('[data-feed-stage]') as HTMLElement).offsetTop,
    );
    // The scroll is smooth, so it has to be allowed to arrive.
    await page.waitForFunction((to) => Math.abs(window.scrollY - to) < 2, target, {
      timeout: 5000,
    });
    // Already there, so this only waits for the growth to have caught up with the landing.
    await scrollToAndSettle(page, target, [
      { selector: '[data-feed-stage]', properties: ['--feed-p'] },
    ]);

    const grown = await page.evaluate(() =>
      Number(
        getComputedStyle(
          document.querySelector('[data-feed-stage]') as HTMLElement,
        ).getPropertyValue('--feed-p'),
      ),
    );

    // Act two's growth runs on the *approach*, so the anchor lands on a composed frame
    // rather than mid-tween - that is the entire reason `#feed` is the CTA's target and
    // not some offset into the section.
    expect(grown, 'the phone is not at full size where #feed lands').toBeCloseTo(1, 2);
  });

  test('the page never scrolls horizontally across the section', async ({ page }) => {
    const { start, distance } = await budget(page);

    // The particle field drifts across the full width and the chips are positioned in
    // percentages; either can push the document wider than the viewport without ever
    // being visible, which is the worst kind of layout bug on a phone.
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollToAndSettle(page, start + distance * fraction, PROBES);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        overflow.scrollWidth,
        `the document is ${overflow.scrollWidth - overflow.clientWidth}px too wide at ${fraction} of act one`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });

  test('under reduced motion there is no pin at all, and everything is simply present', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // "Reduced motion creates no ScrollTrigger and no pin at all - not a still pin, no
    // pin" (`problem.ts`). A still pin would still steal 2100px of scroll from someone
    // who asked for less movement, which is the opposite of the accommodation.
    const pinned = await page.evaluate(() => {
      const stage = document.querySelector('[data-problem-stage]') as HTMLElement;
      return stage.parentElement?.classList.contains('pin-spacer') ?? false;
    });
    expect(pinned, 'reduced motion still built a ScrollTrigger pin').toBe(false);

    await page.locator('[data-problem-stage]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    for (const selector of ['[data-word]', '[data-problem-sub]', '[data-problem-actions]']) {
      const opacity = await page.evaluate(
        (s) => Number(getComputedStyle(document.querySelector(s) as HTMLElement).opacity),
        selector,
      );
      expect(opacity, `${selector} is not fully present under reduced motion`).toBeCloseTo(1, 2);
    }

    await context.close();
  });
});

import { expect, test, type Page } from '@playwright/test';
import { waitForScrubbedMotion } from '../motion-ready';

/**
 * The hero's one remaining scrubbed signal, as behaviour rather than appearance.
 *
 * After the 2026-09-03 restructure the hero is copy only - the device and its feed are
 * act two's (`feed.spec.ts`). What is left is `--blackout`, the lights going out beneath
 * the sticky copy, and `--farewell`, the promise leaving after the pin has released.
 *
 * **This is a much simpler curve than the one the old spec guarded, and deliberately so.**
 * The two-stage shape - a slow ramp to 0.9, a hold, then a second ramp to full black -
 * existed to coordinate with the device's separate growth/feed/rest tracks. With one
 * single travel distance, `hero.ts` uses a single eased ramp across it, so the constants
 * this file used to mirror from that module are gone rather than updated. Nothing here
 * duplicates a timing value: every assertion is expressed against the hero's own spacers,
 * which is what makes it survive the next re-tune.
 *
 * The properties that do still matter, and are the owner's from 8.2's Gate C revs 16–20:
 *
 * 1. **Monotonic.** The lights only ever get darker going down the page. Rev 17 read
 *    "fade out completely" as reversing back to light; rev 18 corrected it, and this is
 *    the assertion that keeps it corrected.
 * 2. **Positional, not a one-way switch.** Going back up the page brings them back.
 * 3. **The hold drives nothing.** The spacer after the ramp exists purely as scroll the
 *    promise stands still through.
 * 4. **The farewell happens after the pin lets go** - it cannot be driven by `progress`,
 *    which is clamped at 1 from exactly that moment.
 */

interface Budget {
  readonly lights: number;
  readonly hold: number;
  /** The departure the farewell is measured against - one pin height. */
  readonly pin: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => ({
    lights: (document.querySelector('[data-hero-lights]') as HTMLElement).offsetHeight,
    hold: (document.querySelector('[data-hero-hold]') as HTMLElement).offsetHeight,
    pin: (document.querySelector('[data-hero-pin]') as HTMLElement).offsetHeight,
  }));
}

async function stateAt(page: Page, offset: number) {
  await page.evaluate((y) => window.scrollTo(0, y), offset);
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const stage = document.querySelector('[data-hero-stage]') as HTMLElement;
    return {
      blackout: Number(getComputedStyle(stage).getPropertyValue('--blackout')),
      farewell: Number(getComputedStyle(stage).getPropertyValue('--farewell')),
    };
  });
}

test.describe('hero - the lights going out', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForScrubbedMotion(page, '[data-hero-stage]', '--blackout');
  });

  test('the lights ramp across their own spacer and reach true full black', async ({ page }) => {
    const { lights } = await budget(page);

    expect((await stateAt(page, 0)).blackout, 'the lights are already down at the top').toBeCloseTo(
      0,
      2,
    );

    const midway = (await stateAt(page, lights * 0.5)).blackout;
    expect(midway, 'the lights did not start going down mid-ramp').toBeGreaterThan(0.15);
    expect(midway, 'the lights went out instantly rather than ramping').toBeLessThan(0.85);

    expect(
      (await stateAt(page, lights)).blackout,
      'the lights did not reach true full black by the end of their own spacer',
    ).toBeCloseTo(1, 2);
  });

  test('the lights only ever darken, and come back on when you scroll up', async ({ page }) => {
    const { lights } = await budget(page);

    let previous = -1;
    for (let step = 0; step <= 20; step += 1) {
      const { blackout } = await stateAt(page, (lights * step) / 20);
      expect(
        blackout,
        `the lights got brighter going down the page, at ${step}/20 of the ramp`,
      ).toBeGreaterThanOrEqual(previous - 0.001);
      previous = blackout;
    }

    expect((await stateAt(page, 0)).blackout, 'the lights did not come back on').toBeCloseTo(0, 2);
  });

  test('the hold drives nothing - the promise simply stands on black', async ({ page }) => {
    const { lights, hold } = await budget(page);

    // Both ends of the hold, and the middle: full black throughout, and the farewell has
    // not begun, because the pin has not released yet.
    for (const fraction of [0, 0.5, 1]) {
      const state = await stateAt(page, lights + hold * fraction);
      expect(
        state.blackout,
        `the blackout moved ${fraction} of the way through the hold`,
      ).toBeCloseTo(1, 2);
      expect(state.farewell, `the promise started leaving during the hold`).toBeCloseTo(0, 2);
    }
  });

  test('the promise fades only after the pin has let go, and is gone before it is clipped', async ({
    page,
  }) => {
    const { lights, hold, pin } = await budget(page);
    const released = lights + hold;

    // `hero.ts` runs the farewell on `overrun` - the departure - across the first ~0.42
    // of a pin height past release, so that the line is still fading while the released
    // pin carries it up the screen. Sampling either side of that window is what proves it
    // is not just another stretch of the pinned scroll.
    expect((await stateAt(page, released)).farewell).toBeCloseTo(0, 2);
    expect(
      (await stateAt(page, released + pin * 0.5)).farewell,
      'the promise had not finished leaving half a pin-height past release',
    ).toBeCloseTo(1, 2);

    // And it is genuinely gone from the screen rather than merely reported as faded.
    // The fade is on `.copy`, the whole block, and not on `.turn` itself: by this point
    // the `recede` variant has already taken everything except the promise to 0, so the
    // promise needs no opacity of its own and deliberately has none (`Hero.astro`).
    await expect(page.locator('.hero .copy')).toHaveCSS('opacity', '0');
  });

  test('under reduced motion the lights stay on and nothing travels', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForScrubbedMotion(page, '[data-hero-stage]', '--blackout');

    // `design-system.md` §5 requires blooms to remain under reduced motion, so the
    // reduced hero is the lit composition - not the dark one, and not a scrubbed one.
    const { lights } = await budget(page);
    for (const offset of [0, lights * 0.5, lights]) {
      const state = await stateAt(page, offset);
      expect(state.blackout, `the lights went down under reduced motion at ${offset}`).toBe(0);
      expect(state.farewell, `the promise faded under reduced motion at ${offset}`).toBe(0);
    }

    await context.close();
  });
});

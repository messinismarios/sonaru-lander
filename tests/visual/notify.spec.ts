import { expect, test, type Page } from '@playwright/test';
import { freeze, settleAt, shootReduced, SHOT, VIEWPORTS } from './support';
import { waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * The notification act - phases.md 8.5.
 *
 * The frames below are the beats the owner approved at Gate A plus the close that arrived
 * with the section swap on 2026-09-04, and they are the reason this section gets snapshots
 * at all: it is a section whose entire content is a transition, so a single resting frame
 * would prove almost nothing about it. Freezing the dark phone *and* the lit one is what
 * makes "the phone is asleep, and then it isn't" something CI can hold onto.
 *
 * `closed` is also the page's last frame, so it is the only snapshot on the site that
 * stands for how the whole thing ends.
 *
 * `held` is not a duplicate of `asleep`, even though the two look nearly identical - that
 * is exactly what it is there to prove. The held beat is scroll during which nothing may
 * change (owner, Gate A, keeping it explicitly), so two visually indistinguishable frames
 * taken hundreds of pixels apart is the assertion, not a redundancy to be tidied away.
 */

interface Budget {
  readonly top: number;
  readonly sleep: number;
  readonly wake: number;
  readonly read: number;
  readonly close: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-notify-stage]') as HTMLElement;
    return {
      top: stage.offsetTop,
      sleep: (document.querySelector('[data-notify-sleep]') as HTMLElement).offsetHeight,
      wake: (document.querySelector('[data-notify-wake-track]') as HTMLElement).offsetHeight,
      read: (document.querySelector('[data-notify-read]') as HTMLElement).offsetHeight,
      close: (document.querySelector('[data-notify-close-track]') as HTMLElement).offsetHeight,
    };
  });
}

const STATES = [
  // The phone at rest, screen off, before anything has been spent.
  { name: 'asleep', at: (b: Budget) => b.top },
  // The far end of the held beat. Must be indistinguishable from `asleep`.
  { name: 'held', at: (b: Budget) => b.top + b.sleep * 0.95 },
  // Mid-wake: the screen coming up, the room lighting, before the arrival settles.
  { name: 'waking', at: (b: Budget) => b.top + b.sleep + b.wake * 0.3 },
  // The composition the section builds to.
  { name: 'arrived', at: (b: Budget) => b.top + b.sleep + b.wake + b.read * 0.5 },
  // Mid-close: the phone receding, the amber room going out, the CTA on its way up.
  { name: 'closing', at: (b: Budget) => b.top + b.sleep + b.wake + b.read + b.close * 0.5 },
  // The page's last frame.
  { name: 'closed', at: (b: Budget) => b.top + b.sleep + b.wake + b.read + b.close * 1.2 },
] as const;

/**
 * The screen, the arriving banner, the cast light, the copy that rides the arrival, and the
 * CTA that rises out of them.
 */
const PROBES = [
  '.notify [data-notify-cast]',
  '.notify .device-slot',
  '.notify .banner',
  '.notify .clock',
  '.notify [data-notify-copy]',
  '.notify [data-notify-cta]',
] as const;

for (const viewport of VIEWPORTS) {
  test(`the notification act at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (viewport.width < 768) {
      // 8.14c round 3: below `md` the phone scrolls in and pins 70% on screen, the copy enters
      // before it is halfway in and rises over it, the notification lands as the copy reaches
      // its top, and the section cuts the phone at 60%. The ask is `Closing.astro`'s own
      // section. Act one has no pin to wait for at this width. Landmarks read off the phone,
      // the hold after it and the copy.
      await waitForScrubbedMotion(page, '[data-notify-stage]', '--notify-wake');
      const mobile = await page.evaluate(() => {
        const q = (selector: string) => document.querySelector(selector) as HTMLElement;
        const documentTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
        const device = q('.notify .device-slot');
        const copy = q('.notify [data-notify-copy]');
        const style = getComputedStyle(device);
        const stickyTop = Number.parseFloat(style.top);
        const margin = Number.parseFloat(style.marginBottom);
        const height = device.offsetHeight;
        const copyBottom = documentTop(copy) + copy.offsetHeight;
        return {
          // Where the phone pins: its natural top less its sticky offset.
          pinsAt: documentTop(q('[data-notify-hold]')) - height - margin - stickyTop,
          // Where the copy's bottom reaches the held phone's top.
          peakAt: copyBottom - stickyTop,
          // Where it lets go: the phone's margin box reaches the copy's bottom.
          releaseAt: copyBottom - (stickyTop + height + margin),
          closing: documentTop(q('.closing')),
        };
      });
      const span = mobile.peakAt - mobile.pinsAt;

      const states = [
        // The phone scrolling in, the copy just behind it.
        { name: 'approach', at: mobile.pinsAt - 100 },
        // Pinned and asleep, the copy low over it.
        { name: 'held', at: mobile.pinsAt + span * 0.1 },
        // Mid-wake: the screen coming up, the copy crossing.
        { name: 'waking', at: mobile.pinsAt + span * 0.6 },
        // The copy reaches the phone's top and the notification lands.
        { name: 'arrived', at: mobile.peakAt + 2 },
        // The copy crossing the held phone.
        { name: 'crossing', at: mobile.releaseAt - 300 },
        // The moment of release: copy clear above the phone.
        { name: 'released', at: mobile.releaseAt },
        // The closing section, which ends the page at this width.
        { name: 'closing', at: mobile.closing },
      ] as const;

      for (const state of states) {
        await settleAt(page, state.at, PROBES);
        await freeze(page);
        await expect(page).toHaveScreenshot(
          `notify-${viewport.name}-default-${state.name}.png`,
          SHOT,
        );
      }

      await context.close();
      return;
    }

    // Act one's ScrollTrigger pin is 2100px of document above this section; `offsetTop` is
    // wrong until it exists (`motion-ready.ts`).
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-notify-stage]', '--notify-wake');

    const measured = await budget(page);

    for (const state of STATES) {
      await settleAt(page, state.at(measured), PROBES);
      await freeze(page);
      await expect(page).toHaveScreenshot(
        `notify-${viewport.name}-default-${state.name}.png`,
        SHOT,
      );
    }

    await context.close();
  });

  test(`the notification act at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // `notify.ts`'s reduced branch composes the section's conclusion, not its setup: screen
    // up, notification present, CTA up - with the copy and the phone at full strength rather
    // than dimmed behind it, so this one frame carries both the argument and the ask.
    await page.locator('[data-notify-stage]').scrollIntoViewIfNeeded();
    await shootReduced(page, `notify-${viewport.name}-reduced.png`);

    await context.close();
  });
}

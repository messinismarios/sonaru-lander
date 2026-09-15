import { expect, test, type Page } from '@playwright/test';
import { scrollToAndSettle, waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * The notification act's scroll contract - phases.md 8.5.
 *
 * It is the **last** act on the page since 2026-09-04, so the final CTA and the scrubbed
 * close that raises it are asserted here rather than in `playlist.spec.ts`.
 *
 * The section has three moving parts driven in three deliberately different ways, which is
 * the thing most worth guarding here:
 *
 * 1. **The wake is scrubbed and continuous.** `--notify-wake` is a pure function of scroll
 *    offset across `.travel.wake`, and it drives both the screen coming up and the amber
 *    cast light - one signal, so the room cannot brighten out of step with the screen.
 * 2. **The arrival is not.** `--notify-banner` is written by a tween that runs to
 *    completion once a threshold is crossed. If it were scrubbed, a visitor could drag the
 *    notification half in and hold it there, which destroys the only thing the section
 *    exists to say: it arrived, or it did not.
 * 3. **The close is scrubbed.** `--notify-close` is a pure function of scroll offset. It
 *    is a change of composition rather than an event, and a composition change is exactly
 *    the thing a visitor should be able to hold halfway.
 * 4. **The held beat holds.** `.travel.sleep` drives nothing at all. It is the owner's
 *    (Gate A, kept explicitly against the recommendation to cut it for pace) and this is
 *    the assertion that stops it being quietly reclaimed by a later re-tune.
 *
 * **Its CI flakes were the test reading too early, not the section** (2026-09-15). The wrong
 * values were always exactly the previous offset's, because `stateAt` compared two readings
 * a frame apart and both could land before the section's scroll handler had written
 * anything. `scrollToAndSettle` (`tests/motion-ready.ts`) has the full account; every scroll
 * in this file goes through it.
 */

interface Budget {
  readonly top: number;
  readonly travel: number;
  readonly sleep: number;
  readonly wake: number;
  readonly read: number;
  readonly close: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-notify-stage]') as HTMLElement;
    const pin = document.querySelector('[data-notify-pin]') as HTMLElement;
    return {
      top: stage.offsetTop,
      travel: stage.offsetHeight - pin.offsetHeight,
      sleep: (document.querySelector('[data-notify-sleep]') as HTMLElement).offsetHeight,
      wake: (document.querySelector('[data-notify-wake-track]') as HTMLElement).offsetHeight,
      read: (document.querySelector('[data-notify-read]') as HTMLElement).offsetHeight,
      close: (document.querySelector('[data-notify-close-track]') as HTMLElement).offsetHeight,
    };
  });
}

/** The section's three signals, and the cast light the wake drives. */
const PROBES = [
  {
    selector: '[data-notify-stage]',
    properties: ['--notify-wake', '--notify-banner', '--notify-close'],
  },
  { selector: '[data-notify-cast]', properties: ['opacity'] },
] as const;

/** Scrolls to `offset`, waits for the section to finish answering it, and reads its signals. */
async function stateAt(page: Page, offset: number) {
  await scrollToAndSettle(page, offset, PROBES);
  return page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-notify-stage]') as HTMLElement);
    return {
      wake: Number(style.getPropertyValue('--notify-wake')),
      banner: Number(style.getPropertyValue('--notify-banner')),
      close: Number(style.getPropertyValue('--notify-close')),
    };
  });
}

test.describe('the notification act', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Act one's pin sits above this section and is 2100px tall, so `offsetTop` is wrong
    // until it exists; and this section's own timeline must have run at least once before
    // its properties mean anything (`motion-ready.ts`).
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-notify-stage]', '--notify-wake');
  });

  test('the phone stays asleep for the whole of the held beat', async ({ page }) => {
    const { top, sleep } = await budget(page);

    // Every sample across the held beat, not just its ends: this spacer's entire purpose
    // is that nothing happens across it, and a re-tune that let the wake bleed backwards
    // into it would still pass an endpoints-only check.
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.98]) {
      const state = await stateAt(page, top + sleep * fraction);
      expect(state.wake, `the screen started coming up ${fraction} into the held beat`).toBeCloseTo(
        0,
        2,
      );
      expect(state.banner, `the notification arrived during the held beat`).toBeCloseTo(0, 2);
      expect(state.close, `the close began ${fraction} into the held beat`).toBeCloseTo(0, 2);
    }
  });

  test('the screen comes up across the wake, and only across the wake', async ({ page }) => {
    const { top, sleep, wake } = await budget(page);

    expect((await stateAt(page, top + sleep)).wake).toBeCloseTo(0, 2);

    const midway = (await stateAt(page, top + sleep + wake * 0.5)).wake;
    expect(midway, 'the screen is not coming up mid-wake').toBeGreaterThan(0.3);
    expect(midway, 'the screen came up instantly rather than ramping').toBeLessThan(0.7);

    expect(
      (await stateAt(page, top + sleep + wake)).wake,
      'the screen is not fully up by the end of its own spacer',
    ).toBeCloseTo(1, 2);
  });

  test('the notification arrives whole, never part-way', async ({ page }) => {
    const { top, sleep, wake } = await budget(page);

    // Sample densely across the wake and let each sample settle. Every reading must be
    // fully absent or fully arrived - never parked between the two, which is exactly what
    // a scrubbed banner would produce and what this test exists to forbid.
    for (let step = 0; step <= 10; step += 1) {
      const state = await stateAt(page, top + sleep + (wake * step) / 10);
      const settled = state.banner < 0.02 || state.banner > 0.98;
      expect(
        settled,
        `the notification was resting part-way in at ${state.banner.toFixed(2)} - is it being scrubbed?`,
      ).toBe(true);
    }
  });

  test('the arrival is positional - scrolling back up takes it away again', async ({ page }) => {
    const { top, sleep, wake } = await budget(page);

    await stateAt(page, top + sleep + wake);
    expect((await stateAt(page, top + sleep + wake)).banner).toBeCloseTo(1, 1);

    // Back to the held beat: it must leave the way it came, not latch.
    const back = await stateAt(page, top + sleep * 0.5);
    expect(back.banner, 'the notification latched and never left').toBeCloseTo(0, 1);

    // And forward again, to prove the first arrival was not a one-shot.
    const again = await stateAt(page, top + sleep + wake);
    expect(again.banner, 'the notification only ever arrives once').toBeCloseTo(1, 1);
  });

  test('the cast light and the screen are one signal', async ({ page }) => {
    const { top, sleep, wake } = await budget(page);

    // The section's whole idea is that the bloom is light thrown by the phone, so the two
    // must never be readable as separate events. Asserted as a ratio rather than a value:
    // the cast's own peak is a design number and may be re-tuned, but its *proportionality*
    // to the wake is the concept and may not.
    const read = async (offset: number) => {
      await scrollToAndSettle(page, offset, PROBES);
      return page.evaluate(() => {
        const stage = document.querySelector('[data-notify-stage]') as HTMLElement;
        const cast = document.querySelector('[data-notify-cast]') as HTMLElement;
        return {
          wake: Number(getComputedStyle(stage).getPropertyValue('--notify-wake')),
          cast: Number(getComputedStyle(cast).opacity),
        };
      });
    };

    const dark = await read(top + sleep * 0.5);
    expect(dark.cast, 'the room is already lit while the phone is asleep').toBeCloseTo(0, 2);

    const half = await read(top + sleep + wake * 0.5);
    const full = await read(top + sleep + wake);

    expect(full.cast, 'the room never lights up').toBeGreaterThan(0.1);
    // Linear in the wake: half the wake, half the light.
    expect(
      half.cast / full.cast,
      'the cast light is not proportional to the screen coming up',
    ).toBeCloseTo(half.wake / full.wake, 1);
  });

  test('the section holds its composition through the trailing read', async ({ page }) => {
    const { top, sleep, wake, read } = await budget(page);

    for (const fraction of [0, 0.5, 1]) {
      const state = await stateAt(page, top + sleep + wake + read * fraction);
      expect(state.wake, `the screen dimmed ${fraction} through the read`).toBeCloseTo(1, 2);
      expect(state.banner, `the notification left ${fraction} through the read`).toBeCloseTo(1, 1);
      expect(state.close, `the close ran ${fraction} through the read`).toBeCloseTo(0, 2);
    }
  });

  test('the close is scrubbed, and only across its own track', async ({ page }) => {
    const { top, sleep, wake, read, close } = await budget(page);

    expect((await stateAt(page, top + sleep + wake + read)).close).toBeCloseTo(0, 2);

    // Unlike the banner, this one *must* be holdable part-way: it is the assertion that the
    // event and the composition change have not been quietly unified.
    const midway = (await stateAt(page, top + sleep + wake + read + close * 0.5)).close;
    expect(midway, 'the close is not running mid-track').toBeGreaterThan(0.3);
    expect(midway, 'the close snapped rather than scrubbing').toBeLessThan(0.7);

    expect(
      (await stateAt(page, top + sleep + wake + read + close)).close,
      'the close is not finished by the end of its own spacer',
    ).toBeCloseTo(1, 2);
  });

  test('the section holds its last frame through the trailing rest', async ({ page }) => {
    const { top, travel } = await budget(page);

    // The page ends here, so this is the frame a visitor is left sitting on.
    const state = await stateAt(page, top + travel);
    expect(state.banner, 'the notification left before the page ended').toBeCloseTo(1, 1);
    expect(state.close, 'the CTA never fully arrived').toBeCloseTo(1, 2);
  });

  test('the CTA is inert until the close has begun, and interactive after it', async ({ page }) => {
    const { top, sleep, wake, read, close } = await budget(page);
    const inert = () =>
      page.evaluate(() => document.querySelector('[data-notify-cta]')?.hasAttribute('inert'));

    // An <a> at opacity 0 is still clickable and still in the tab order.
    await stateAt(page, top + sleep * 0.5);
    expect(await inert(), 'the invisible CTA is already clickable').toBe(true);

    // Past `CTA_LIVE_AT`, which sits just past the point the ask starts rising at all.
    await stateAt(page, top + sleep + wake + read + close * 0.75);
    expect(await inert(), 'the CTA is on screen but cannot be used').toBe(false);

    // Positional, exactly as the banner is.
    await stateAt(page, top + sleep * 0.5);
    expect(await inert(), 'the CTA stayed live after scrolling back to the held beat').toBe(true);
  });

  test('the CTA stays clear of the phone on every frame it is visible', async ({ page }) => {
    const { top, sleep, wake, read, close } = await budget(page);

    // Not a matter of taste: a lit phone has no feather, so CTA type sitting on top of one is
    // unreadable in a way act three's feathered list never was. The two must not overlap.
    //
    // **The invariant is the other way round since Gate C rev 2.** The phone used to recede
    // out of the ask's way; the owner rejected the resize, so the phone is now a fixed object
    // in the lower half of the frame and it is the *ask* that has to stay off it. Reading it
    // as `ctaBottom <= deviceTop` rather than flipping the operands matters - the failure this
    // guards is type crossing the device's top edge, which is a different edge from the one
    // the old build watched.
    //
    // **Across the close, not only at its end.** An earlier revision checked the last frame
    // alone and passed while the headline sat straight across the lit phone for the middle
    // third of the track. Sampling starts at 0.5 because the ask is at opacity 0 below 0.45
    // and there is nothing to overlap.
    for (const fraction of [0.5, 0.7, 0.85, 1]) {
      await stateAt(page, top + sleep + wake + read + close * fraction);
      const boxes = await page.evaluate(() => {
        const device = document.querySelector('.notify .device-slot')?.getBoundingClientRect();
        const cta = document.querySelector('.notify [data-notify-cta]')?.getBoundingClientRect();
        return device && cta ? { deviceTop: device.top, ctaBottom: cta.bottom } : null;
      });

      expect(boxes, 'the closing frame has no device or no CTA in it').not.toBeNull();
      expect(
        boxes?.ctaBottom,
        `the CTA overlaps the phone ${fraction} of the way through the close`,
      ).toBeLessThanOrEqual(boxes?.deviceTop ?? 0);
    }
  });

  test('the phone never changes size, anywhere in the section', async ({ page }) => {
    const { top, sleep, wake, read, close, travel } = await budget(page);

    // The owner's instruction at Gate C rev 2, and the reason the composition was rebuilt
    // around the device rather than the device around the composition: "it shouldn't change
    // size at all". A phone that shrinks is a picture of a phone, and its rendered size is
    // the only thing still tying this device to the one act two grew.
    //
    // Sampled across the whole section and not only the close, because a growth phase
    // reintroduced anywhere - an entrance, a settle, a parallax - breaks it just as surely.
    const heights: number[] = [];
    const measure = () =>
      page.evaluate(
        () => document.querySelector('.notify .device-slot')?.getBoundingClientRect().height ?? 0,
      );

    await stateAt(page, top);
    const first = await measure();

    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      await stateAt(page, top + travel * fraction);
      heights.push(await measure());
    }
    // And once more at the exact end of the close, which is where the old recession bottomed
    // out at 0.44 of the phone's height.
    await stateAt(page, top + sleep + wake + read + close);
    heights.push(await measure());

    expect(first, 'the phone has no rendered height at all').toBeGreaterThan(0);
    for (const height of heights) {
      expect(
        height,
        `the phone is rendered at ${height}px somewhere and ${first}px elsewhere`,
      ).toBeCloseTo(first, 1);
    }
  });

  test('the page never scrolls horizontally across the section', async ({ page }) => {
    const { top, travel } = await budget(page);

    // The cast light is 170vw wide by design. `overflow-x: clip` on the section is what
    // keeps that from becoming a horizontal scrollbar, and `clip` rather than `hidden`
    // because `hidden` would establish a scroll container and silently break the pin.
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollToAndSettle(page, top + travel * fraction, PROBES);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        overflow.scrollWidth,
        `the document is ${overflow.scrollWidth - overflow.clientWidth}px too wide at ${fraction} of the notification act`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });

  test('the notification announces a release act two also shows in its feed', async ({ page }) => {
    // Both read the showcase manifest, and the section's narrative depends on them naming
    // the same record: this act is the story of how one of act two's rows got there. If the
    // two ever drift, the page quietly tells two different stories.
    //
    // **In the feed, not at the top of it** (owner, 2026-09-11). It was the top row for as
    // long as the manifest's dates were staged and the announced release was simply set to
    // be the newest. Real release dates separated the two: act two is ordered strictly by
    // date and the announced release is named by a flag, so it sits wherever its own date
    // puts it. `getFeedReleases` in `src/components/device/showcase.ts` is what still
    // guarantees it is on the phone at all, and that guarantee is what this asserts.
    const announced = await page.evaluate(
      () => document.querySelector('.notify .banner .title')?.textContent?.trim() ?? '',
    );
    // `ReleaseCard.astro` renders the artist in its `.chip`, which is the only place the
    // card carries the artist alone - the title beside it is the release title by itself.
    const feedArtists = await page.evaluate(() =>
      [...document.querySelectorAll('.feed [data-feed-track] .card')].map(
        (card) => card.querySelector('.chip')?.textContent?.trim() ?? '',
      ),
    );

    expect(announced, 'the lock screen names no artist').not.toBe('');
    expect(feedArtists, 'act two renders no release card').not.toHaveLength(0);
    expect(feedArtists).toContain(announced);
  });

  test.describe('below md', () => {
    // 8.14c Gate C round 3 (owner): the phone scrolls in and the copy enters behind it before
    // the phone is halfway in view; the phone pins once 70% of it is on screen and the copy
    // rises over it. The notification lands as the copy reaches the phone's top, the phone
    // lets go once the copy clears it, and the section cuts the phone 60% of the way down.
    // Only the phone is ever pinned, and the ask is its own static section after the act.
    // Reloads at 390, where act one has no pin to wait for.
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await waitForScrubbedMotion(page, '[data-notify-stage]', '--notify-wake');
    });

    /** Scroll offsets read off the phone, the hold that follows it and the copy. */
    async function mobileBudget(page: Page) {
      return page.evaluate(() => {
        const q = (selector: string) => document.querySelector(selector) as HTMLElement;
        const documentTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
        const device = q('.notify .device-slot');
        const copy = q('.notify [data-notify-copy]');
        const style = getComputedStyle(device);
        const stickyTop = Number.parseFloat(style.top);
        const margin = Number.parseFloat(style.marginBottom);
        const height = device.offsetHeight;
        // Where the phone pins: its natural top (the hold's, less its margin box) less its
        // sticky offset.
        const pinsAt = documentTop(q('[data-notify-hold]')) - height - margin - stickyTop;
        const copyBottom = documentTop(copy) + copy.offsetHeight;
        return {
          stickyTop,
          height,
          pinsAt,
          // Where the copy's bottom reaches the held phone's top: the wake's peak.
          peakAt: copyBottom - stickyTop,
          // Where it lets go: the copy is the end of its block, so the phone's margin box -
          // `stickyTop + height + margin` in the viewport - reaches the copy's bottom there.
          releaseAt: copyBottom - (stickyTop + height + margin),
          closing: documentTop(q('.closing')),
        };
      });
    }

    const rects = (page: Page) =>
      page.evaluate(() => {
        const device = (
          document.querySelector('.notify .device-slot') as HTMLElement
        ).getBoundingClientRect();
        const copy = document.querySelector('.notify [data-notify-copy]') as HTMLElement;
        const box = copy.getBoundingClientRect();
        const hit = document.elementFromPoint(window.innerWidth / 2, box.top + box.height / 4);
        return {
          deviceTop: device.top,
          deviceBottom: device.bottom,
          copyTop: box.top,
          copyBottom: box.bottom,
          copyOpacity: Number(getComputedStyle(copy).opacity),
          copyOnTop: !!hit && copy.contains(hit),
          sectionBottom: (
            document.querySelector('[data-notify-stage]') as HTMLElement
          ).getBoundingClientRect().bottom,
        };
      });

    test('only the phone is pinned', async ({ page }) => {
      const positions = await page.evaluate(() => ({
        pin: getComputedStyle(document.querySelector('[data-notify-pin]') as HTMLElement).position,
        device: getComputedStyle(document.querySelector('.notify .device-slot') as HTMLElement)
          .position,
        copy: getComputedStyle(document.querySelector('.notify [data-notify-copy]') as HTMLElement)
          .position,
      }));
      expect(positions.pin, 'the whole frame is still pinned').not.toBe('sticky');
      expect(positions.device, 'the phone is not pinned').toBe('sticky');
      expect(positions.copy, 'the copy is pinned').not.toBe('sticky');
    });

    test('the phone comes first, the copy follows before it is halfway in, and it pins at 70%', async ({
      page,
    }) => {
      const { pinsAt, stickyTop, height } = await mobileBudget(page);

      // Phone 30% in view: the copy is not on screen yet.
      await stateAt(page, pinsAt - 0.4 * height);
      expect((await rects(page)).copyTop, 'the copy is on screen before the phone').toBeGreaterThan(
        844,
      );

      // Phone 50% in view: the copy already is.
      await stateAt(page, pinsAt - 0.2 * height);
      const half = await rects(page);
      expect((844 - half.deviceTop) / height).toBeCloseTo(0.5, 2);
      expect(half.copyTop, 'the copy waits for the phone to be halfway in').toBeLessThan(844);

      await stateAt(page, pinsAt + 120);
      const held = await rects(page);
      expect(held.deviceTop, 'the phone is not held at its pin').toBeCloseTo(stickyTop, 0);
      expect((844 - stickyTop) / height, 'the phone is not 70% on screen').toBeCloseTo(0.7, 2);
    });

    test('the phone wakes while held and the banner lands whole as the copy reaches its top', async ({
      page,
    }) => {
      const { pinsAt, peakAt } = await mobileBudget(page);
      const span = peakAt - pinsAt;

      const asleep = await stateAt(page, pinsAt + span * 0.1);
      expect(asleep.wake, 'the screen woke during the held beat').toBeCloseTo(0, 2);
      expect(asleep.banner, 'the notification arrived during the held beat').toBeCloseTo(0, 1);

      const midway = (await stateAt(page, pinsAt + span * 0.6)).wake;
      expect(midway, 'the wake is not scrubbed').toBeGreaterThan(0.3);
      expect(midway).toBeLessThan(0.7);

      // Approached from below: once it has landed, the hysteresis band rightly holds it here.
      expect((await stateAt(page, peakAt - 40)).banner, 'landed early').toBeCloseTo(0, 1);

      for (let step = 0; step <= 10; step += 1) {
        const state = await stateAt(page, pinsAt + (span * step) / 10);
        expect(
          state.banner < 0.02 || state.banner > 0.98,
          `the notification was resting part-way in at ${state.banner.toFixed(2)}`,
        ).toBe(true);
      }

      const peak = await stateAt(page, peakAt + 2);
      expect(peak.wake).toBe(1);
      expect(peak.banner, 'the notification did not land at the peak').toBeCloseTo(1, 1);
      const atPeak = await rects(page);
      expect(atPeak.copyBottom - atPeak.deviceTop).toBeLessThanOrEqual(0);
      expect((await stateAt(page, pinsAt + span * 0.1)).banner).toBeCloseTo(0, 1);
    });

    test('the copy rises over the held phone and releases it once clear of it', async ({
      page,
    }) => {
      const { releaseAt, stickyTop } = await mobileBudget(page);

      // Crossing: the copy overlaps the phone, above it in z, at full strength.
      await stateAt(page, releaseAt - 300);
      const crossing = await rects(page);
      expect(crossing.deviceTop, 'the phone let go before the copy crossed it').toBeCloseTo(
        stickyTop,
        0,
      );
      expect(crossing.copyBottom, 'the copy is not over the phone').toBeGreaterThan(
        crossing.deviceTop,
      );
      expect(crossing.copyOnTop, 'the phone is painted over the copy').toBe(true);
      expect(crossing.copyOpacity).toBe(1);

      // Still held just before release, with the copy nearly clear.
      await stateAt(page, releaseAt - 20);
      expect((await rects(page)).deviceTop).toBeCloseTo(stickyTop, 0);

      // Released: the copy sits above the phone's top edge and the two leave together.
      await stateAt(page, releaseAt + 120);
      const gone = await rects(page);
      expect(gone.deviceTop, 'the phone never let go').toBeLessThan(stickyTop - 100);
      expect(gone.copyBottom, 'the copy is still over the phone').toBeLessThan(gone.deviceTop);
      expect(gone.copyOpacity).toBe(1);
    });

    test('the section ends 60% down the phone and cuts it there', async ({ page }) => {
      const { releaseAt, height } = await mobileBudget(page);
      await stateAt(page, releaseAt + 120);
      const state = await rects(page);
      const overflow = await page.evaluate(
        () => getComputedStyle(document.querySelector('[data-notify-stage]') as Element).overflowY,
      );
      expect((state.sectionBottom - state.deviceTop) / height).toBeCloseTo(0.6, 2);
      expect(overflow, 'the phone hangs out of the section').toBe('clip');
    });

    test('the ask is its own static section, not part of the act', async ({ page }) => {
      const state = await page.evaluate(() => {
        const closing = document.querySelector('.closing') as HTMLElement;
        const notify = document.querySelector('[data-notify-stage]') as HTMLElement;
        return {
          pinnedCta: getComputedStyle(document.querySelector('[data-notify-cta]') as Element)
            .display,
          closing: getComputedStyle(closing).display,
          closingPosition: getComputedStyle(closing).position,
          after: notify.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING,
          href: closing.querySelector('a')?.getAttribute('href'),
        };
      });

      expect(state.pinnedCta, 'the pinned ask is still in the act').toBe('none');
      expect(state.closing, 'the closing section is not shown').not.toBe('none');
      expect(state.closingPosition).not.toBe('sticky');
      expect(state.after, 'the closing section is not after the act').toBeTruthy();
      expect(state.href).toBe('/waitlist');
    });
  });

  test('the closing section is phones only', async ({ page }) => {
    // Desktop keeps its ask inside the act's scrubbed close, so the claim must not appear
    // twice - `display: none` also keeps it out of the accessibility tree.
    const display = await page.evaluate(
      () => getComputedStyle(document.querySelector('.closing') as Element).display,
    );
    expect(display).toBe('none');
  });

  test('under reduced motion the section rests on its conclusion', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForScrubbedMotion(page, '[data-notify-stage]', '--notify-wake');

    // Someone who asked for less motion should see what the section *says*, not its setup:
    // a lit screen with the notification on it, not a dark phone that never wakes.
    const state = await page.evaluate(() => {
      const stage = document.querySelector('[data-notify-stage]') as HTMLElement;
      const style = getComputedStyle(stage);
      const copy = document.querySelector('.notify [data-notify-copy]') as HTMLElement;
      return {
        wake: Number(style.getPropertyValue('--notify-wake')),
        banner: Number(style.getPropertyValue('--notify-banner')),
        close: Number(style.getPropertyValue('--notify-close')),
        // The one thing that must *not* carry over from the full build: at 0.35 the act's
        // argument would be something the visitor is asked to squint at.
        copyOpacity: Number(getComputedStyle(copy).opacity),
        ctaInert: document.querySelector('[data-notify-cta]')?.hasAttribute('inert'),
      };
    });

    expect(state.wake, 'the screen is asleep under reduced motion').toBe(1);
    expect(state.banner, 'the notification never arrives under reduced motion').toBe(1);
    expect(state.close, 'the CTA never arrives under reduced motion').toBe(1);
    expect(state.copyOpacity, 'the copy is dimmed out under reduced motion').toBeCloseTo(1, 2);
    expect(state.ctaInert, 'the CTA is unreachable under reduced motion').toBe(false);

    await context.close();
  });
});

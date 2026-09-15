import { expect, test, type Page } from '@playwright/test';
import { scrollToAndSettle, waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * Act two's scroll contract, as behaviour rather than as appearance - phases.md 8.4.
 *
 * This is `hero-feed.spec.ts` rewritten in place: the device mechanism it guarded moved
 * from the hero to `Feed.astro` on 2026-09-03 "essentially exactly as is", so the
 * properties are the ones the owner asked for at 8.2's Gate C, re-derived against act
 * two's own spacers and signals. Snapshots (`tests/visual/feed.spec.ts`) freeze what the
 * section *looks like*; they cannot show that a release holds still while you scroll - a
 * held frame and a moving one are the same picture - which is why these exist:
 *
 * 1. **Anchoring.** Scrolling a little must do nothing; crossing a release's midpoint
 *    must bring the next one.
 * 2. **Never skipping.** When the feed's position was scrubbed straight from scroll, one
 *    ordinary 120px wheel notch moved it most of a release and a normal scroll jumped
 *    clean over one. Advances are tweened to completion and queued, so the feed can only
 *    move one release at a time however hard the visitor scrolls.
 * 3. **The growth is unsmoothed.** A pure function of scroll offset - the same offset
 *    gives the same frame whether reached forwards or backwards. Only the feed is paged;
 *    the phone is dragged.
 * 4. **Growth belongs to the approach, not the pin** (`promise.ts`, owner 2026-09-03).
 *    `--feed-p` is driven by `observeScrollProgress`'s `entry`, so it is already 1 the
 *    instant the pin engages. Two earlier attempts to start growth "as the visitor scrolls
 *    into act two" missed precisely because they read `progress`, which is flat at 0 for
 *    the whole run-up; this is the assertion that pins the distinction.
 */

/**
 * Everything act two drives: its scrubbed signals, the paged track, and the date stamps.
 * `scrollToAndSettle` waits for all of them, so a queued advance is waited out to its last
 * release rather than for a guessed duration.
 */
const PROBES = [
  { selector: '[data-feed-stage]', properties: ['--feed-p', '--feed-atmosphere', '--feed-settle'] },
  { selector: '[data-feed-track]', properties: ['--feed-y'] },
  { selector: '[data-stamp]', properties: ['opacity'] },
] as const;

interface Budget {
  /** Document offset where the section's top meets the viewport's top. */
  readonly top: number;
  /** The run-up growth is spread across - one pin height (`scroll-progress.ts`). */
  readonly approach: number;
  readonly advance: number;
  readonly advances: number;
  readonly feed: number;
  readonly rest: number;
  readonly settle: number;
}

/** Act two's scroll budgets at the current viewport, read from its own spacers. */
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

/** Reads one of the stage's custom properties after scrolling to an absolute offset. */
async function propertyAt(page: Page, offset: number, name: string): Promise<number> {
  await scrollToAndSettle(page, offset, PROBES);
  return page.evaluate((property) => {
    const stage = document.querySelector('[data-feed-stage]') as HTMLElement;
    return Number(getComputedStyle(stage).getPropertyValue(property));
  }, name);
}

/** The feed's position in releases at a given absolute scroll offset. */
async function feedAt(page: Page, offset: number): Promise<number> {
  await scrollToAndSettle(page, offset, PROBES);
  return page.evaluate(() => {
    const track = document.querySelector('[data-feed-track]') as HTMLElement;
    return -Number.parseFloat(getComputedStyle(track).getPropertyValue('--feed-y')) / 100;
  });
}

test.describe('act two - the feed is anchored to scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Act one's pin sits above this section and is 2100px tall, so `offsetTop` below is
    // wrong until it exists; and act two's own timeline must have run at least once
    // before `--feed-p` means anything. See `motion-ready.ts`.
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-feed-stage]', '--feed-p');
  });

  test('the phone finishes growing exactly as the section finishes arriving', async ({ page }) => {
    const { top, approach } = await budget(page);

    // Well before the section is on screen at all.
    expect(await propertyAt(page, top - approach, '--feed-p')).toBeCloseTo(0, 2);
    // Halfway up the run-up: growing, not yet grown, and not still at zero.
    const midway = await propertyAt(page, top - approach * 0.5, '--feed-p');
    expect(midway, 'the phone is not growing across the approach').toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(0.7);
    // The instant the pin engages, growth is complete - the pin's scroll is the feed's.
    expect(
      await propertyAt(page, top, '--feed-p'),
      'growth is not finished where the pin engages - is it reading `progress` again?',
    ).toBeCloseTo(1, 2);
  });

  test('a release holds still, then the next one arrives and lands squarely', async ({ page }) => {
    const { top, advance } = await budget(page);

    // The growth has just finished. The first release is square on screen.
    expect(await feedAt(page, top)).toBeCloseTo(0, 2);

    // Scrolling a little must do nothing at all - this is the anchor.
    expect(
      await feedAt(page, top + advance * 0.3),
      'the feed moved before its threshold; the anchor is gone',
    ).toBeCloseTo(0, 2);

    // Past the midpoint it advances, and settles on a whole release rather than between two.
    expect(await feedAt(page, top + advance * 0.8)).toBeCloseTo(1, 2);
  });

  test('a fast scroll advances one release at a time and never skips', async ({ page }) => {
    const { top, feed, advances } = await budget(page);

    await feedAt(page, top);

    // Sample every frame while jumping straight to the end of the feed track - the
    // scroll a trackpad flick produces, and what the unqueued version skipped a whole
    // release on.
    await page.evaluate(() => {
      const track = document.querySelector('[data-feed-track]') as HTMLElement;
      const seen: { at: number; gap: number }[] = [];
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      let previous = performance.now();
      const tick = (now: number): void => {
        seen.push({
          at: -Number.parseFloat(getComputedStyle(track).getPropertyValue('--feed-y')) / 100,
          gap: now - previous,
        });
        previous = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // An instant jump, which is harsher than any flick, then every queued advance waited out.
    await scrollToAndSettle(page, top + feed, PROBES);

    const seen = await page.evaluate(
      () => (window as unknown as { __seen: { at: number; gap: number }[] }).__seen,
    );

    // No single frame may move the feed more than a fraction of a release.
    //
    // Frames that took longer than two frame budgets are excluded, and only those. The
    // tween is a function of elapsed time, so when the machine stalls - four Chromes on
    // one laptop, or a shared CI runner - a single 200ms frame legitimately covers a lot
    // of ground, and failing on it would be reporting the runner's load as a design
    // regression. What the exclusion cannot hide is the defect this test exists for: a
    // directly-scrubbed feed jumps on a *fast, healthy* frame, which is exactly the kind
    // still being measured.
    const HEALTHY_FRAME_MS = 34;
    let biggest = 0;
    for (let i = 1; i < seen.length; i += 1) {
      const frame = seen[i] as { at: number; gap: number };
      const previous = seen[i - 1] as { at: number; gap: number };
      if (frame.gap > HEALTHY_FRAME_MS) continue;
      biggest = Math.max(biggest, Math.abs(frame.at - previous.at));
    }
    expect(biggest, `a frame moved the feed ${biggest.toFixed(2)} releases`).toBeLessThan(0.2);

    // ...and every release in between must actually have been on screen. This half is
    // unconditional: a dropped frame is no excuse for never having shown a release.
    for (let index = 1; index < advances; index += 1) {
      const rested = seen.some((frame) => Math.abs(frame.at - index) < 0.02);
      expect(rested, `release ${index} was skipped over, never squarely shown`).toBe(true);
    }

    expect((seen[seen.length - 1] as { at: number }).at).toBeCloseTo(advances, 2);
  });

  test('the date in the margin never disagrees with the release on screen', async ({ page }) => {
    const { top, advance, advances } = await budget(page);

    // The stamps ride the same paged number as the feed (`promise.ts`'s `renderStamps`),
    // and that is the entire justification for them being `aria-hidden` - they restate a
    // date the device already shows. If they could drift out of step, the phone and its
    // own caption would be telling the visitor two different things.
    for (let index = 0; index <= advances; index += 1) {
      await feedAt(page, top + advance * index);

      const lit = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-stamp]')).map((stamp) =>
          Number(getComputedStyle(stamp).opacity),
        ),
      );

      expect(lit[index], `stamp ${index} is not the visible one at release ${index}`).toBeCloseTo(
        1,
        1,
      );
      lit.forEach((opacity, other) => {
        if (other !== index) {
          expect(opacity, `stamp ${other} is still lit at release ${index}`).toBeLessThan(0.1);
        }
      });
    }
  });

  test('the cyan atmosphere is lit by the time the last release has arrived', async ({ page }) => {
    const { top, feed } = await budget(page);

    // `design-system.md` §2 gives act two cyan for clarity/order, and the owner's call
    // (2026-09-03) was that it must not be there from the first frame - it arrives with
    // the feed rather than announcing itself before anything has happened.
    expect(await propertyAt(page, top, '--feed-atmosphere')).toBeCloseTo(0, 2);
    expect(await propertyAt(page, top + feed, '--feed-atmosphere')).toBeCloseTo(1, 2);
  });

  test('the outro waits for the trailing rest, then settles the device', async ({ page }) => {
    const { top, feed, rest, settle } = await budget(page);

    // The rest exists so the last release is seen standing rather than arriving and
    // immediately leaving; nothing may start shrinking during it.
    expect(
      await propertyAt(page, top + feed + rest * 0.5, '--feed-settle'),
      'the outro started during the feed’s trailing rest',
    ).toBeCloseTo(0, 2);
    expect(await propertyAt(page, top + feed + rest + settle, '--feed-settle')).toBeCloseTo(1, 2);
  });

  test('the last release is still held at the very bottom of the page', async ({ page }) => {
    const { top, feed, advances } = await budget(page);

    // The trailing spacers exist so the release the section builds to is not reached on
    // its final pixel. At the bottom of the page the feed must be settled, not arriving.
    // `feedAt` clamps to the scrollable range, so this is the page's last pixel.
    const atBottom = await feedAt(page, top + feed + 1e5);
    expect(atBottom).toBeCloseTo(advances, 2);
  });

  test('the page never scrolls horizontally, at any point in the section', async ({ page }) => {
    const { top, approach, feed } = await budget(page);

    // The atmosphere swells as it scrolls, and once that swell was wider than the
    // viewport: an invisible horizontal scrollbar appeared and grew as the visitor went
    // down the page. Nothing about the section should ever be reachable sideways.
    for (const offset of [top - approach, top - approach * 0.5, top, top + feed, 1e6]) {
      await scrollToAndSettle(page, offset, PROBES);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrolled: (() => {
          window.scrollTo(document.documentElement.scrollWidth, window.scrollY);
          return window.scrollX;
        })(),
      }));

      expect(
        overflow.scrollWidth,
        `the document is ${overflow.scrollWidth - overflow.clientWidth}px wider than the viewport at scrollY ${offset}`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
      expect(overflow.scrolled, `the page scrolled sideways at scrollY ${offset}`).toBe(0);
    }
  });

  test('the device growth gives the same frame at an offset, forwards or backwards', async ({
    page,
  }) => {
    const { top, approach } = await budget(page);
    const probe = Math.round(top - approach * 0.4);

    const forwards = await propertyAt(page, probe, '--feed-p');
    await propertyAt(page, top + approach, '--feed-p');
    const backwards = await propertyAt(page, probe, '--feed-p');

    // A smoothed scrub cannot do this: it would still be travelling towards the target
    // and would report a different value depending on the direction of approach. This is
    // what keeps the phone locked to the copy scrolling beside it.
    expect(
      backwards,
      'the growth depends on how the offset was reached - has smoothing come back?',
    ).toBeCloseTo(forwards, 4);
  });
});

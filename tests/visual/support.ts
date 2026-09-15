import { expect, type Page } from '@playwright/test';
import { scrollToAndSettle } from '../motion-ready';

/**
 * What the three section snapshot suites share.
 *
 * `hero.spec.ts` owned all of this while the hero was the only scrubbed section on the
 * route. The 2026-09-03 restructure split one section into three - the hero kept the
 * lights, act one (`Problem.astro`) got its own ScrollTrigger pin, act two
 * (`Feed.astro`) took the device - and each needs the identical determinism discipline.
 * Copying it three times is how three suites drift into freezing three different things.
 *
 * **On determinism.** Nothing here is a test hook in production code: a component that
 * behaves differently under test is a component the snapshot no longer proves anything
 * about. Instead every moving thing is either driven to a known offset and allowed to
 * settle, or - for the bloom field's own CSS drift - seeked to one fixed frame.
 */

/** The frame of the bloom's drift loop every snapshot is taken on, in seconds. */
export const BLOOM_FRAME = 4;

/**
 * The showcase artwork is a photograph and AVIF encoding is not bit-identical across
 * sharp versions. A re-encode must not read as a design change.
 */
export const SHOT = { maxDiffPixelRatio: 0.02 } as const;

/** `acceptance-criteria.md` §5: every section at each of these, in both motion modes. */
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
] as const;

/**
 * Hides the dev toolbar and holds every CSS animation on one identical frame.
 *
 * **It seeks with the Web Animations API, and the reason is a bug this function used to
 * have.** The first version set `animation-delay: -4s` and `animation-play-state: paused`
 * on every animated element, which reads like "seek to 4 seconds" and is not: a negative
 * delay *offsets* the timeline, so the animation lands four seconds ahead of wherever it
 * already was - and where it already was depends on how long the page took to load. Every
 * run froze the blooms on a slightly different frame.
 *
 * That is the whole of the "act one's default-motion baselines are not reproducible"
 * finding recorded on 2026-09-07, and of act two's `mid-growth` frames alongside it.
 * Measured: three loads of `/`, identical code, produced orb transforms differing in the
 * third decimal place, which is thousands of pixels once a 1200px blurred gradient is
 * rotated by it. `animation.currentTime` sets an absolute position, so the frame is the
 * same frame every time.
 *
 * Scroll-driven animations are skipped rather than seeked: their position is a pure
 * function of scroll offset, they are already deterministic, and `currentTime` on one is
 * a progress value rather than a time. Pausing the header's scrim here would freeze it at
 * whatever this function guessed instead of at what the page's scroll position says.
 */
export async function freeze(page: Page): Promise<void> {
  await page.evaluate((frame) => {
    // The dev toolbar is not part of the design and is absent from a production build.
    const style = document.createElement('style');
    style.textContent = [
      'astro-dev-toolbar{display:none!important}',
      /*
       * **Why a compositing hint is dropped before every screenshot.**
       *
       * `Problem.astro` and `Feed.astro` carry a permanent `will-change: transform,
       * opacity` on their scrubbed copy, which keeps those elements on their own
       * compositing layer for the life of the page. Chrome does not rasterise text on a
       * composited layer identically between page loads, and that - not the scrub, not the
       * blooms, not the fonts - is the whole of the "act one's default-motion baselines are
       * not reproducible" finding recorded on 2026-09-07.
       *
       * It was isolated by elimination, and every other candidate was ruled out by
       * measurement: the settled scroll offset, the probes' transforms, the copy's
       * bounding rectangles to four decimal places, `opacity`, `will-change` itself as a
       * computed value, and the loaded font faces are all identical across runs, and a
       * pixel diff shows the differences confined to glyph edges with the bloom behind them
       * untouched. **With the hint cleared, two runs are pixel-identical: 0 differing
       * pixels against 10,882.**
       *
       * This is a stylesheet added at screenshot time rather than a change to the sections,
       * which are frozen behind their own Gate C. It is the same kind of measure as pausing
       * the animations above - the page is held still so a snapshot can mean something. The
       * production hint is worth revisiting on its own merits (permanently promoting text
       * costs memory and degrades its rendering), and that is the owner's call, not a side
       * effect of a test helper.
       */
      '*{will-change:auto!important}',
    ].join('');
    document.head.append(style);

    for (const animation of document.getAnimations()) {
      // Scroll-driven animations are a pure function of scroll offset - already
      // deterministic, and `currentTime` on one is a progress value rather than a time.
      // Pausing the header's scrim here would freeze it at whatever this guessed.
      if (animation.timeline !== document.timeline) continue;
      animation.currentTime = frame * 1000;
      animation.pause();
    }
  }, BLOOM_FRAME);

  // One frame for the seeked bloom position and the dropped layers to paint.
  await page.waitForTimeout(150);
}

/**
 * Scrolls to an absolute offset and waits until nothing on the page is still moving.
 *
 * Deliberately generic rather than per-section. The three sections settle by three
 * different mechanisms - the hero's blackout is an unsmoothed function of offset, act
 * one's ScrollTrigger runs `scrub: 1` (a full second of smoothing), and act two's feed
 * advance is a tween that always runs to completion - and a snapshot suite that knew
 * which was which would have to be corrected every time one of them changed. Sampling the
 * page's own rendered state until it stops changing is true of all three, and stays true.
 *
 * @param page the page to scroll.
 * @param offset absolute scroll position to settle at.
 * @param probes the elements whose rendered state must go quiet, as CSS selectors.
 */
export async function settleAt(page: Page, offset: number, probes: readonly string[]) {
  // Landed, and the scroll's own handlers run, before the stillness below can count - the
  // stale-read race `scrollToAndSettle` documents.
  await scrollToAndSettle(
    page,
    offset,
    probes.map((selector) => ({ selector, properties: ['opacity', 'transform'] })),
  );

  await page.waitForFunction(
    ([selectors, needed]) => {
      const signature = (selectors as string[])
        .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
        .map((element) => {
          const style = getComputedStyle(element);
          // Opacity and transform between them cover every scrubbed property in play:
          // fades, rises, drifts, the device's growth, and the feed track's paging.
          return `${style.opacity}|${style.transform}`;
        })
        .join(';');

      const store = window as unknown as { __sig?: string; __same?: number };
      store.__same = store.__sig === signature ? (store.__same ?? 0) + 1 : 0;
      store.__sig = signature;
      return (store.__same ?? 0) >= (needed as number);
    },
    // Ten consecutive identical polls at 50ms: half a second of stillness, which is
    // longer than `scrub: 1`'s tail once it is within a rounded pixel of its target.
    [probes, 10] as const,
    { timeout: 15_000, polling: 50 },
  );
}

/**
 * The one snapshot a reduced-motion build gets: there is no travel to scroll through, so
 * the whole section is a single designed still frame (`design-system.md` §5).
 */
export async function shootReduced(page: Page, name: string): Promise<void> {
  await freeze(page);
  await expect(page).toHaveScreenshot(name, SHOT);
}

/**
 * Loads and decodes every image on the page, so a `fullPage` capture cannot race one.
 *
 * **Found at 8.9e by diffing baselines rather than by a failing test**, which is the
 * discipline `scripts/diff-baselines.mjs` was written for at 8.9b and the second time it
 * has caught something the suite's own tolerance hid. Two consecutive regenerations of
 * `/blog` at 1440 under reduced motion, against identical code, differed by ~1,700 pixels
 * - and the differing rows landed **entirely inside the second and third post covers**,
 * measured at 1130-1480 and 1771-2121.
 *
 * The cause is the interaction of two things that are each correct on their own. The index
 * loads the first cover eagerly as the LCP element and the other two with `loading="lazy"`
 * (`tests/e2e/blog.spec.ts` asserts exactly that), and a `fullPage` screenshot scrolls the
 * page to stitch it - which is what brings those two into view and starts their fetch, at
 * the moment the shot is being taken. So the baseline recorded whatever had decoded by
 * then, and `SHOT`'s 2% tolerance is ~26,000 pixels at 1440x900, wide enough that the
 * suite stayed green either way.
 *
 * This does not weaken what the snapshot proves. It is the same kind of measure as
 * `freeze()` seeking the animations: the page is brought to its settled state first, and
 * `loading="lazy"` is still asserted as an attribute by the e2e suite, where it belongs.
 */
export async function settleImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Bring every lazy image into view the way the capture will, then put the page back -
    // scrolling is what triggers the load, and leaving it scrolled would move the shot.
    const start = window.scrollY;
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) window.scrollTo(0, y);
    window.scrollTo(0, start);

    await Promise.all(
      [...document.querySelectorAll('img')].map((image) =>
        // `decode()` resolves once the frame is ready to paint, which `complete` does not
        // promise. A failure here is a broken image, which is the visual suite's business
        // to capture rather than to throw on.
        image.decode().catch(() => undefined),
      ),
    );
  });
}

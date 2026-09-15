import type { Page } from '@playwright/test';

/**
 * Waiting for the page's motion to actually be running before measuring anything.
 *
 * `waitForLoadState('networkidle')` is not that guarantee, and the difference is not
 * theoretical: it produced a genuinely misleading failure. Under `npm run verify` the
 * suite runs immediately after `npm run build`, which rewrites `.astro/` and can have the
 * dev server serving a page whose module graph is still being rebuilt. The tests then
 * measured a route where no timeline had run yet - and because every scrubbed signal is
 * registered with `@property … initial-value: 0`, `getComputedStyle` cheerfully returned
 * `0` for all of them instead of failing to resolve. A dead page and a page scrolled to
 * the top are indistinguishable that way, so the suite reported "the phone is not growing
 * across the approach" when the truth was "nothing on this page is running at all".
 *
 * Both helpers below wait on evidence that JavaScript has run, not on a proxy for it.
 */

/**
 * Waits until a scrubbed section's timeline has written its signal at least once.
 *
 * The inline style is the discriminator. `@property`'s initial value lives in *computed*
 * style and is there from the first frame; `stage.style` carries a value only once
 * `setProperty` has been called, which only a running timeline does.
 *
 * @param page the page under test.
 * @param stage selector for the section's stage element.
 * @param property the custom property that section's timeline drives.
 */
export async function waitForScrubbedMotion(
  page: Page,
  stage: string,
  property: string,
): Promise<void> {
  await page.waitForFunction(
    ([selector, name]) => {
      const element = document.querySelector(selector as string) as HTMLElement | null;
      return !!element && element.style.getPropertyValue(name as string) !== '';
    },
    [stage, property] as const,
    { timeout: 15_000, polling: 50 },
  );
}

/**
 * Waits until act one's ScrollTrigger pin exists.
 *
 * Act one is the route's only genuine ScrollTrigger pin, and the `.pin-spacer` wrapper
 * GSAP creates for it is 2100px tall. Every offset below it on the page - act two's
 * `offsetTop` above all - is wrong by that much until it exists, so this is a
 * precondition for measuring *any* section, not just act one's.
 *
 * Full-motion only: `problem.ts`'s reduced branch deliberately creates no pin at all.
 */
export async function waitForPinnedMotion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const stage = document.querySelector('[data-problem-stage]');
      return stage?.parentElement?.classList.contains('pin-spacer') ?? false;
    },
    undefined,
    { timeout: 15_000, polling: 50 },
  );
}

/** What `scrollToAndSettle` watches: computed values on every element a selector matches. */
export interface Probe {
  readonly selector: string;
  /**
   * `--name` reads a custom property, `rect.top` the element's viewport top, and anything
   * else the computed style property of that name (`opacity`, `transform`).
   */
  readonly properties: readonly string[];
}

/** Consecutive identical frames that count as settled - about 130ms at 60fps. */
const STABLE_FRAMES = 8;

/**
 * Scrolls to an absolute offset and returns only once the page has finished answering it.
 *
 * **Every scroll-driven assertion on the home route goes through this, because the fixed
 * waits and two-sample checks it replaced were where the suite's flakes lived** - on CI the
 * failing readings were exactly the values of the *previous* offset (`0.000403`,
 * `0.500403`, `0.998722`) rather than jitter. The cause was the order of
 * work in a frame, not load. The sections write their signals from a `requestAnimationFrame`
 * callback that the scroll event schedules, and a test's own frame callback, registered
 * before that event fired, runs first in the same frame - so it read the old value, read it
 * again a frame later before anything had changed, and called two stale readings settled.
 * Reproduced on Linux at 43 stale readings in 45 by scrolling instantly; a fixed pause only
 * made it rarer.
 *
 * So settling is three conditions, in order, each on evidence rather than time:
 *
 * 1. **The scroll landed.** Instant rather than smooth (`Base.astro` sets
 *    `scroll-behavior: smooth`), clamped to the document, and its `scroll` event observed.
 * 2. **The page's handlers ran.** Two more frames: a callback requested after the event is
 *    queued behind everything the event scheduled.
 * 3. **Nothing is still moving.** Every probed value unchanged for `STABLE_FRAMES`
 *    consecutive frames, so a scrub catching up or a switch's tween running to completion is
 *    waited out, and a section that simply does not change settles at once.
 *
 * It throws rather than returning a stale state when any condition is not met in time.
 *
 * @param page the page under test.
 * @param offset the absolute scroll offset; clamped to the scrollable range.
 * @param probes the values that must stop changing.
 * @param timeout how long all three conditions may take together, in ms.
 */
export async function scrollToAndSettle(
  page: Page,
  offset: number,
  probes: readonly Probe[] = [],
  timeout = 10_000,
): Promise<void> {
  await page.evaluate(
    async ([requested, watched, frames, timeoutMs]) => {
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const started = performance.now();
      const check = (what: string) => {
        if (performance.now() - started > timeoutMs) {
          throw new Error(`scrollToAndSettle(${requested}): ${what} within ${timeoutMs}ms`);
        }
      };

      const root = document.scrollingElement ?? document.documentElement;
      const max = Math.max(0, root.scrollHeight - window.innerHeight);
      const target = Math.round(Math.min(max, Math.max(0, requested)));

      // Within a pixel counts as landed: Lenis rounds, and while an anchor's scroll is still
      // in flight it holds the page a pixel off whatever was asked for.
      const landed = () => Math.abs(window.scrollY - target) <= 1;
      let dispatched = landed();
      const onScroll = () => {
        dispatched = true;
      };
      addEventListener('scroll', onScroll, { passive: true });
      window.scrollTo({ top: target, behavior: 'instant' });
      while (!dispatched || !landed()) {
        check('the scroll did not land');
        await nextFrame();
      }
      removeEventListener('scroll', onScroll);

      await nextFrame();
      await nextFrame();

      const signature = () =>
        watched
          .flatMap(({ selector, properties }) =>
            [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
              const style = getComputedStyle(element);
              return properties
                .map((name) =>
                  name === 'rect.top'
                    ? String(element.getBoundingClientRect().top)
                    : style.getPropertyValue(name),
                )
                .join('|');
            }),
          )
          .join(';');

      let previous = signature();
      let same = 0;
      while (same < frames) {
        check('the page did not stop moving');
        await nextFrame();
        const current = signature();
        same = current === previous ? same + 1 : 0;
        previous = current;
      }
    },
    [offset, probes, STABLE_FRAMES, timeout] as const,
  );
}

/**
 * Waits until nothing on the page is still changing opacity.
 *
 * **Written for `tests/e2e/axe.spec.ts`, and for one defect it kept hitting.** axe reads
 * rendered colour, so an element caught part-way through a fade is measured at its *blended*
 * value: `/pricing`'s call to action reports `#838283` on `#4c0b35` - 3.9:1 - where the
 * settled button is `#fafafa` on `#8d0b5e`. The guard then fails on some runs and not others,
 * which is the worst kind of guard, because the lesson it teaches is "re-run it".
 *
 * **It samples rather than waits on a signal, and that is deliberate.** GSAP is bundled as a
 * module and never reaches `window`, so no page can be asked whether its tweens have
 * finished; the two helpers above wait on one section's own inline signal, which is
 * per-section by construction. What generalises to seventeen routes is the observation
 * itself: read every element's opacity, wait, read again, and require the two to agree. It
 * makes no assumption about what the resting values should be - only that they have stopped
 * moving - so a section that legitimately rests at 0.3 settles as readily as one at 1.
 *
 * @param page the page under test.
 */
export async function waitForOpacityToSettle(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const read = () =>
        [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).opacity).join(',');

      const before = read();
      await new Promise((resolve) => setTimeout(resolve, 250));
      return read() === before;
    },
    undefined,
    { timeout: 15_000 },
  );
}

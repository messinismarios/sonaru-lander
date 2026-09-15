/**
 * Act two's choreography - phases.md 8.4, "the promise". The device growth/feed-advance
 * mechanism was ported from 8.2's `hero.ts` almost verbatim (owner, 2026-09-03: "move
 * that part of the hero to the promise section ... essentially exactly as is"). See that
 * file's git history for the original's full reasoning; only what changed for the move is
 * noted here.
 *
 * **The device growth is a pure function of scroll offset, unsmoothed** - locked to
 * whatever else is scrolling beside it, same as the hero's version.
 *
 * **The feed advances on scroll, never on a timer, one release at a time, and each
 * advance runs to completion** - anchored targets, not a direct scrub of position, for
 * the same reason the hero's did: a wheel delivers offset in lumps far larger than the
 * paging gesture it represents.
 *
 * **Growth runs on the approach, and there is no cover at all (owner, 2026-09-03).** Two
 * rounds of trying to make growth start "the instant the visitor scrolls into act two"
 * kept missing, because `progress` - `observeScrollProgress`'s original signal - is 0 for
 * the whole run-up and only starts moving once the section's top has *already* reached
 * the viewport's top. `travelled = 0` is therefore not the moment the phone appears; it
 * is the moment the section is fully in. Growth is now driven by `entry` instead, the
 * approach signal that runs 0 → 1 across exactly that run-up, so it begins as the phone
 * comes into view and is finished the instant the pin engages - which is where it used to
 * begin. The pin's own scroll now belongs entirely to the feed, its rest and the outro:
 * there is no growth track left.
 *
 * The `.blackout` cover is gone with it. It faded off over ~200px of the pin, which is
 * what the owner read as the phone fading in slowly; the device is on screen at full
 * opacity from its first frame, with nothing over it and no opacity of its own.
 *
 * **The cyan atmosphere waits for the whole feed to finish** (owner, 2026-09-03, revised
 * from "the first advance" - that read as too early): `--feed-atmosphere` stays 0 through
 * growth and every advance, and only ramps 0→1 once `feedProgress` itself reaches 1, i.e.
 * once the *last* release has fully arrived.
 *
 * **The outro** (owner, 2026-09-03): once the trailing rest ends, a `SETTLE` phase shrinks
 * the device in place (`--feed-settle` 0→1, consumed by `Feed.astro`'s own scale formula)
 * and fades the section's copy in beneath it. `--feed-settle` is deliberately a separate
 * property from `--feed-p`: growth and the outro are sequential multipliers on the same
 * transform, and neither phase has to know the other exists.
 *
 * **No ScrollTrigger** - `position: sticky` pins, `scroll-progress.ts` scrubs. The route
 * already loads ScrollTrigger for act one by this point, so nothing is saved by that
 * choice here, but the mechanism itself did not change in the move.
 */
import { gsap } from 'gsap';
import { DURATION, GSAP_EASE } from '../tokens';
import { defineTimeline, type MotionContext } from '../reduced-motion';
import { observeScrollProgress } from '../scroll-progress';

/** Which release the reduced-motion build rests on - the one after the first. */
const RESTING_INDEX = 1;

/**
 * The two branches' divide - `design-system.md` §4's own breakpoint, already in use
 * everywhere else on the site.
 *
 * **Both sides of it pin**, which makes this act the exception among the five: 8.14's Gate
 * A concept drops pin and scrub below `md`, and the owner asked for act two to keep them
 * (8.14c Gate C). `.pin` is `position: sticky` at every width. What differs is what the
 * pin's scroll is spent on - growth and a shrinking outro above the breakpoint, the phone
 * moving aside and back below it.
 */
const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * How far past a threshold the scroll must be before the feed accepts a new target.
 */
const HYSTERESIS = 0.06;

/**
 * Below `md`: how far through the phone's move aside the first advance begins, as a fraction
 * of that move (owner, 8.14). Every later advance is still read off the date column.
 */
const FIRST_ADVANCE_AT = 0.1;

/**
 * Below `md`: how much later than the date column the swipe to the third release starts, in
 * steps of that column (owner, 8.14: "later by 20%", so the second release is seen for longer).
 * The second release's time on screen ran from the first advance, at -0.21 steps, to the
 * second, at the 1.56-step threshold - 1.77 steps - and 20% of that is 0.35.
 */
const SECOND_ADVANCE_DELAY = 0.35;

interface FeedElements {
  readonly stage: HTMLElement;
  readonly pin: HTMLElement;
  /** The phone itself. Below `md` this - not `.pin` - is the sticky element. */
  readonly device: HTMLElement;
  /** The scroll the phone spends moving aside before any release advances - mobile only. */
  readonly shiftTrack: HTMLElement;
  readonly feedTrack: HTMLElement;
  readonly restTrack: HTMLElement;
  readonly settleTrack: HTMLElement;
  readonly track: HTMLElement;
  readonly tints: readonly HTMLElement[];
  /** The oversized date stamps beside the phone, one per release. */
  readonly stamps: readonly HTMLElement[];
}

function collect(root: ParentNode): FeedElements | null {
  const stage = root.querySelector<HTMLElement>('[data-feed-stage]');
  if (!stage) return null;

  const pin = root.querySelector<HTMLElement>('[data-feed-pin]');
  const device = root.querySelector<HTMLElement>('.device-slot');
  const shiftTrack = root.querySelector<HTMLElement>('[data-feed-shift]');
  const feedTrack = root.querySelector<HTMLElement>('[data-feed-feed-travel]');
  const restTrack = root.querySelector<HTMLElement>('[data-feed-rest]');
  const settleTrack = root.querySelector<HTMLElement>('[data-feed-settle]');
  const track = root.querySelector<HTMLElement>('[data-feed-track]');
  const tints = Array.from(root.querySelectorAll<HTMLElement>('[data-tint]'));
  const stamps = Array.from(root.querySelectorAll<HTMLElement>('[data-stamp]'));

  if (
    !pin ||
    !device ||
    !shiftTrack ||
    !feedTrack ||
    !restTrack ||
    !settleTrack ||
    !track ||
    tints.length < 2
  ) {
    throw new Error('promise: found a stage but not its pin, scroll tracks, feed or tints');
  }

  return {
    stage,
    pin,
    device,
    shiftTrack,
    feedTrack,
    restTrack,
    settleTrack,
    track,
    tints,
    stamps,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function crossfade(elements: readonly HTMLElement[], lower: number, fraction: number): void {
  elements.forEach((element, index) => {
    if (index === lower) element.style.opacity = String(1 - fraction);
    else if (index === lower + 1) element.style.opacity = String(fraction);
    else element.style.opacity = '0';
  });
}

/**
 * How far a date stamp travels as it swipes through, in px. Small: this is the margin's
 * quiet decoration, and a long throw on type this large reads as a separate animation
 * competing with the feed rather than as the same gesture happening beside it.
 */
const STAMP_DRIFT_PX = 40;

/**
 * The date stamps beside the phone - a crossfade like the tints', plus a vertical swipe
 * (owner, 2026-09-04): the outgoing date leaves towards the top and the incoming one
 * arrives from below, matching the direction the feed itself pages.
 *
 * **Every stamp is given a position, not just the two mid-swap.** A stamp already passed
 * rests *above* its home and one not yet reached rests *below* it, so whichever way the
 * visitor scrolls, the next stamp to appear is always already on the side it should enter
 * from. Leaving the others at a default would make a backwards scroll enter from the wrong
 * direction - the same "explicit baseline for every element" discipline `problem.ts`
 * documents at its Gate C rev 3.
 */
function renderStamps(stamps: readonly HTMLElement[], lower: number, fraction: number): void {
  stamps.forEach((stamp, index) => {
    let opacity = 0;
    let offset = STAMP_DRIFT_PX;

    if (index === lower) {
      opacity = 1 - fraction;
      offset = -fraction * STAMP_DRIFT_PX;
    } else if (index === lower + 1) {
      opacity = fraction;
      offset = (1 - fraction) * STAMP_DRIFT_PX;
    } else if (index < lower) {
      offset = -STAMP_DRIFT_PX;
    }

    stamp.style.opacity = String(opacity);
    stamp.style.transform = `translateY(${offset}px)`;
  });
}

/**
 * @param withStamps whether the date stamps are this function's to drive. False below
 *   `md`, where the dates are a static column laid out in CSS and the feed *follows* them
 *   rather than the other way round - see the mobile branch.
 */
function renderFeed(
  { track, tints, stamps }: FeedElements,
  position: number,
  withStamps = true,
): void {
  const lower = Math.min(tints.length - 2, Math.floor(position));
  const fraction = clamp01(position - lower);

  track.style.setProperty('--feed-y', `${(lower + fraction) * -100}%`);

  crossfade(tints, lower, fraction);
  if (!withStamps) return;
  // The date stamps beside the phone ride the *same* number as the feed itself, so the date
  // in the margin and the release on screen cannot disagree - see `Feed.astro` for why they
  // are not given a scroll mapping of their own. They swipe as well as fade, which is why
  // they do not share the tints' plain crossfade.
  renderStamps(stamps, lower, fraction);
}

/**
 * The designed still frame: device at full size, atmosphere lit, outro settled, resting on
 * the release after the first. The reduced-motion build's whole composition.
 */
function restAtFinishedState(elements: FeedElements): void {
  elements.stage.style.setProperty('--feed-p', '1');
  elements.stage.style.setProperty('--feed-atmosphere', '1');
  elements.stage.style.setProperty('--feed-settle', '1');
  renderFeed(elements, RESTING_INDEX);
}

/**
 * The feed's paging mechanism, extracted at 8.14c so both branches drive one implementation.
 *
 * **The property that must survive the extraction is that an advance runs to completion.**
 * A wheel notch - or a touch flick, which is worse - delivers offset in lumps far larger
 * than the gesture it represents, so a feed scrubbed straight from scroll skips whole
 * releases (8.2's Gate C, measured at 0.721 of a release per notch). Advances are therefore
 * threshold-triggered tweens that queue: `request` only ever moves the target by whole
 * releases, and `step` refuses to start a second tween while one is running.
 */
function createFeedPager(elements: FeedElements, withStamps = true) {
  const advances = elements.tints.length - 1;

  let settled = 0;
  let target = 0;
  let stepping: gsap.core.Tween | null = null;

  const step = (): void => {
    if (stepping !== null || settled === target) return;
    const next = settled + Math.sign(target - settled);
    const state = { at: settled };

    stepping = gsap.to(state, {
      at: next,
      duration: DURATION.section,
      ease: GSAP_EASE.inOut,
      onUpdate: () => renderFeed(elements, state.at, withStamps),
      onComplete: () => {
        settled = next;
        stepping = null;
        renderFeed(elements, settled, withStamps);
        step();
      },
    });
  };

  return {
    advances,

    /**
     * Asks for the release nearest `asked`, in releases. Ignored until the request is more
     * than half a release away from the current target, plus `HYSTERESIS` - which is what
     * makes a small scroll do nothing at all rather than nudging the feed.
     */
    request(asked: number): void {
      if (Math.abs(asked - target) > 0.5 + HYSTERESIS) {
        target = Math.min(advances, Math.max(0, Math.round(asked)));
        step();
      }
    },

    /**
     * The feed's resting state, established once before anything is driven. `renderFeed`
     * otherwise runs only from an advance, which leaves every stamp that has not had its
     * turn sitting at its home position rather than below it - so the first advance would
     * snap the incoming date down before rising with it. Invisible in practice, since its
     * opacity is 0 at that instant, but it is exactly the class of missing baseline
     * `problem.ts` documents at its Gate C rev 3.
     */
    prime(): void {
      renderFeed(elements, settled, withStamps);
    },

    kill(): void {
      stepping?.kill();
    },
  };
}

/**
 * Builds act two in both motion modes.
 *
 * @param root where to look for the section's markup. Defaults to the document.
 * @returns a teardown that reverts everything it created, or a no-op when there is no
 *   `feed` section on the page.
 */
export function createPromiseTimeline(root: ParentNode = document): () => void {
  const elements = collect(root);
  if (!elements) return () => {};

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        const mm = gsap.matchMedia();

        // Desktop and above: the sticky pin, unchanged.
        mm.add(DESKTOP_QUERY, () => {
          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);
          const pager = createFeedPager(elements);
          pager.prime();
          const bloom = elements.stage.querySelector<HTMLElement>('[data-bloom]');

          const stopScrub = observeScrollProgress({
            track: elements.stage,
            pin: elements.pin,
            onChange: (progress, entry) => {
              const total = elements.stage.offsetHeight - elements.pin.offsetHeight;
              const feed = elements.feedTrack.offsetHeight;
              const rest = elements.restTrack.offsetHeight;
              const settle = elements.settleTrack.offsetHeight;
              const travelled = progress * total;

              // Growth is the approach, not the pin - `entry`, not `progress`. It is already
              // 1 by the time `travelled` leaves 0, so the phone is full size at exactly the
              // moment the section finishes scrolling in. See the file doc comment.
              elements.stage.style.setProperty('--feed-p', String(entry));
              elements.stage.style.setProperty('--bloom-scroll', String(bloomEase(progress)));

              const feedProgress = feed === 0 ? 0 : clamp01(travelled / feed);
              pager.request(feedProgress * pager.advances);

              // Lit only once the whole feed has finished advancing - "at the time when the
              // feed scroll completed", not partway through it.
              elements.stage.style.setProperty('--feed-atmosphere', String(clamp01(feedProgress)));
              // At 0 the atmosphere's opacity is 0, but its blended orbs were still composited
              // on every frame of the approach and the growth (8.14, measured). Not drawing a
              // field nobody can see changes no pixel.
              bloom?.toggleAttribute('data-unlit', feedProgress === 0);

              // The outro: only begins once the trailing rest has fully played out.
              const settleProgress = settle === 0 ? 0 : clamp01((travelled - feed - rest) / settle);
              elements.stage.style.setProperty('--feed-settle', String(settleProgress));
            },
          });

          return () => {
            stopScrub();
            pager.kill();
            bloom?.removeAttribute('data-unlit');
          };
        });

        // Below `md`: **only the phone is pinned** (8.14c Gate C round 2, owner), which
        // is a smaller claim than it sounds and a different mechanism from the desktop
        // branch above. There, `.pin` is the sticky element and everything inside it -
        // phone, dates, copy - is held together. Here `.pin` is an ordinary tall block and
        // `.device-slot` itself is `position: sticky`, so the dates and the copy are plain
        // flow content that scrolls past a held phone, with no JavaScript touching them at
        // all: "not animated, as if there's no js to them ... like a calendar".
        //
        // **The date column is therefore the source of truth, and the feed follows it.**
        // Rather than timing the dates to the feed, this reads which date is level with the
        // phone and asks for that release - so the two cannot disagree even though only one
        // of them is driven. That is the same property desktop buys by giving both the
        // *same* paged number, arrived at from the opposite direction.
        //
        // The advance mechanism itself is desktop's, unchanged: `createFeedPager`,
        // threshold-triggered and queued. It matters more here than anywhere, because a
        // touch flick delivers far more offset per gesture than a wheel notch does.
        //
        // Nothing returns to the middle at the end (owner, same round): the phone unpins
        // still aside, the dates stay where they are, and the copy is simply the next thing
        // down the page.
        mm.add('(max-width: 767px)', () => {
          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);

          // Growth, the shrinking outro and the stamp crossfade all belong to a scrub this
          // branch does not run. `--feed-aside` is the only driven signal left.
          elements.stage.style.setProperty('--feed-p', '1');
          elements.stage.style.setProperty('--feed-settle', '0');
          elements.stage.style.setProperty('--feed-atmosphere', '1');

          // `false`: the dates are laid out by CSS and must not be touched. Switching
          // branches at a resize would otherwise leave the desktop crossfade's inline
          // opacities on a column that is meant to be fully visible.
          const pager = createFeedPager(elements, false);
          pager.prime();
          elements.stamps.forEach((stamp) => {
            stamp.style.removeProperty('opacity');
            stamp.style.removeProperty('transform');
          });

          let frame = 0;

          const emit = (): void => {
            frame = 0;

            const phone = elements.device.getBoundingClientRect();
            const first = elements.stamps[0];
            const second = elements.stamps[1];
            if (!first || !second) return;

            // How far the phone has been held past the point it pinned at. Its natural
            // position is the top of `.pin`, so the distance stuck is how far that top has
            // travelled past the sticky offset - which is the phone's own current top,
            // since that is what "stuck" means.
            const stuck = Math.max(0, phone.top - elements.pin.getBoundingClientRect().top);

            // The aside move's length is not restated here: the first date's centre is
            // authored to sit one advance threshold (`0.5 + HYSTERESIS` of a step) short of the
            // phone's centre as the move completes - where the first swipe landed until 8.14,
            // when it moved to `FIRST_ADVANCE_AT` of the move (below) and the position kept
            // only this job. The phone's centre is `stuck` plus half its height down the
            // pin, so the span is read back from the date's position. One number in
            // `Feed.astro`, read rather than mirrored.
            const step = second.offsetTop - first.offsetTop;
            const asideSpan = Math.max(
              1,
              first.offsetTop +
                first.offsetHeight / 2 -
                elements.device.offsetHeight / 2 +
                (0.5 + HYSTERESIS) * step,
            );

            // **The phone flips back to the middle before its pin ends** (owner, round 4).
            // How long it stays stuck is not a number anyone wrote down: it is the pin's
            // height less the phone's own bottom margin - which is what releases it early,
            // so the copy has the frame to itself - less the phone's own height. The flip
            // back takes exactly as much scroll as the move out did, so the two read as one
            // gesture and its reverse rather than as two separately tuned ones.
            const held =
              elements.pin.offsetHeight -
              Number.parseFloat(getComputedStyle(elements.device).marginBottom || '0') -
              elements.device.offsetHeight;
            const back = clamp01((stuck - (held - asideSpan)) / asideSpan);

            const aside = clamp01(stuck / asideSpan);
            elements.stage.style.setProperty('--feed-aside', String(aside - back));

            // Which release is level with the phone, in releases - continuous, so the
            // pager's own hysteresis decides when it has been asked for properly.
            //
            // **Except the first advance, which the move itself asks for** (owner, 8.14): the
            // second release starts arriving once the phone is `FIRST_ADVANCE_AT` of the way
            // out, rather than as it lands on the right, so it is on screen for longer. The
            // swipe to the third release still follows the date column, `SECOND_ADVANCE_DELAY`
            // later, for the same reason. Scrolling back reverses both through the same
            // hysteresis.
            const centre = phone.top + phone.height / 2;
            const firstCentre = first.getBoundingClientRect().top + first.offsetHeight / 2;
            if (step > 0) {
              const level = (centre - firstCentre) / step;
              pager.request(
                aside >= FIRST_ADVANCE_AT ? Math.max(level - SECOND_ADVANCE_DELAY, 1) : level,
              );
            }

            const section = elements.stage.getBoundingClientRect();
            const transit = section.height + window.innerHeight;
            elements.stage.style.setProperty(
              '--bloom-scroll',
              String(bloomEase(clamp01((window.innerHeight - section.top) / transit))),
            );
          };

          const schedule = (): void => {
            if (frame === 0) frame = requestAnimationFrame(emit);
          };

          emit();
          addEventListener('scroll', schedule, { passive: true });
          addEventListener('resize', schedule, { passive: true });

          return () => {
            if (frame !== 0) cancelAnimationFrame(frame);
            removeEventListener('scroll', schedule);
            removeEventListener('resize', schedule);
            pager.kill();
          };
        });

        return () => mm.revert();
      });
    },

    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        restAtFinishedState(elements);
      });
    },
  });
}

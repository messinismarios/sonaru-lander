/**
 * The notification act's choreography - phases.md 8.5. Gate B approved 2026-09-04, and
 * extended on 2026-09-04 when the owner made this the last act on the page and the final
 * CTA came with it.
 *
 * The section has three moving parts, driven in three deliberately different ways. Getting
 * that split right is the whole file.
 *
 * **The wake is scrubbed.** `--notify-wake` runs 0 → 1 across `.travel.wake` as a pure
 * function of scroll offset, unsmoothed, the way every other continuous signal on this
 * route works. It brings the screen up (an overlay's opacity in `LockScreen.astro` - never
 * a `filter`, which the repo bans in anything scrubbed) and swells the amber bloom on the
 * same number, which is what makes the bloom read as light cast by the phone rather than as
 * atmosphere behind it.
 *
 * **The arrival is not scrubbed.** `--notify-banner` is written by a tween that always runs
 * to completion once a scroll threshold is crossed - the same mechanism act two's feed
 * advance uses (`promise.ts`), for the same reason. A notification is a discrete event: if
 * its position were scrubbed, the visitor could drag the banner half in and hold it there,
 * or scrub it in and out, which destroys the one thing the section exists to convey. It
 * arrived, or it has not.
 *
 * It is still **positional, not a one-way switch**: scrolling back up crosses the threshold
 * the other way and the banner leaves the same way it came. A `HYSTERESIS` band around the
 * threshold stops it flickering when a scroll settles exactly on the line.
 *
 * **The close is scrubbed, like the wake and unlike the arrival.** `--notify-close` runs
 * 0 → 1 across `.travel.close`: the copy and the phone recede, the amber room cross-fades
 * into the magenta CTA field, and the ask rises. It is a change of composition rather than
 * an event, and a composition change is exactly the thing a visitor *should* be able to
 * hold halfway. It came here with the CTA from act four, where it was `--playlist-close`.
 *
 * **The CTA's `inert` is cleared here, not in CSS.** An `<a>` at opacity 0 is still
 * clickable and still in the tab order; `pointer-events` would fix the first and not the
 * second, and `visibility` cannot be driven from a number. See `Notify.astro`.
 *
 * **`.travel.sleep` is never read here, and that is the point.** The held beat is scroll
 * the visitor spends on a phone that does not move (owner, Gate A, keeping it explicitly
 * against the recommendation to cut it for pace). Nothing is driven across it, so there is
 * nothing in this file to tune - which is exactly what stops it being quietly shortened.
 *
 * **Below `md` only the phone is pinned, and there is no close** (owner, 8.14c Gate C
 * rounds 1 and 2). Everything above describes desktop. At phone width the phone scrolls in
 * and pins, the copy is ordinary flow content that rises over it and releases it, and the
 * wake and the arrival are driven by how far the phone has been held. The final ask
 * is not in this section at all there: `Closing.astro` is its own static section after it.
 * The held beat survives, as the first of the phone's three beats.
 *
 * **No ScrollTrigger.** `position: sticky` pins and `scroll-progress.ts` scrubs, as in the
 * hero and act two. Act one already loads ScrollTrigger on this route so nothing is saved
 * by that choice here, but the mechanism is the one the other sticky acts use and there is
 * no reason for this section to be the odd one out.
 */
import { gsap } from 'gsap';
import { DURATION, GSAP_EASE } from '../tokens';
import { defineTimeline, type MotionContext } from '../reduced-motion';
import { observeScrollProgress } from '../scroll-progress';
import { createSwitch } from '../switch';

/**
 * How far past the threshold the scroll must be before the banner accepts a new state.
 * Matches `promise.ts`'s band: the same problem, the same answer.
 */
const HYSTERESIS = 0.06;

/**
 * Where in the wake the notification actually lands, as a fraction of `.travel.wake`.
 *
 * Not 0: the screen has to be visibly coming up *before* the banner arrives, or the two
 * read as one event and the phone appears to be woken *by* the banner rather than the
 * banner landing on a waking phone. Not 1 either - the arrival needs the rest of the track
 * to settle into, and the copy rides its completion.
 */
const ARRIVAL_AT = 0.42;

/**
 * How far into the close the CTA becomes interactive. The link should be reachable as soon
 * as it is meaningfully on screen rather than only once the close has played out, because a
 * visitor who stops scrolling mid-close should still be able to click what they can see -
 * but the ask does not *start* rising until 45% of the close (`Notify.astro`'s
 * `--close-cta`, which holds it back until the phone is out of its way). This is that 45%
 * plus a little, so it never goes live while it is still invisible.
 */
const CTA_LIVE_AT = 0.52;

/**
 * Below `md`, the share of the phone's held scroll it stays asleep for before the wake
 * begins - the held beat (Gate A), measured against the scroll from the pin to the copy
 * reaching the phone's top edge.
 */
const MOBILE_SLEEP = 0.2;

/**
 * Below `md`, the notification lands at the wake's peak - the moment the copy's bottom
 * reaches the phone's top edge (owner, 8.14c Gate C round 3). Past this plus `HYSTERESIS`
 * is 0.99, so it commits as the wake reaches 1.
 */
const MOBILE_ARRIVAL_AT = 0.93;

/** `design-system.md` §4's breakpoint, the divide every other act's mobile branch uses. */
const DESKTOP_QUERY = '(min-width: 768px)';
const MOBILE_QUERY = '(max-width: 767px)';

interface NotifyElements {
  /** The tall section progress is measured against. Carries all three custom properties. */
  readonly stage: HTMLElement;
  /** The sticky viewport-height element holding the device, the copy and the CTA. */
  readonly pin: HTMLElement;
  /** The held beat. Read only for its height, never driven across. */
  readonly sleepTrack: HTMLElement;
  /** The wake. Read for its height and driven across. */
  readonly wakeTrack: HTMLElement;
  /** The beat between the two driven phases. Read only for its height. */
  readonly readTrack: HTMLElement;
  /** The close. Read for its height and driven across. */
  readonly closeTrack: HTMLElement;
  /** The final CTA, which ships `inert` and is woken by the close. */
  readonly cta: HTMLElement;
  /** The phone. Below `md` this - not `.pin` - is the sticky element. */
  readonly device: HTMLElement;
  /** The claim. Below `md` its position over the phone drives the wake. */
  readonly copy: HTMLElement;
  /** Below `md`: the spacer that follows the phone in flow, read to find its natural top. */
  readonly hold: HTMLElement;
}

/**
 * Finds the section's elements, or returns null when it is not on this page.
 */
function collect(root: ParentNode): NotifyElements | null {
  const stage = root.querySelector<HTMLElement>('[data-notify-stage]');
  if (!stage) return null;

  const pin = root.querySelector<HTMLElement>('[data-notify-pin]');
  const sleepTrack = root.querySelector<HTMLElement>('[data-notify-sleep]');
  const wakeTrack = root.querySelector<HTMLElement>('[data-notify-wake-track]');
  const readTrack = root.querySelector<HTMLElement>('[data-notify-read]');
  const closeTrack = root.querySelector<HTMLElement>('[data-notify-close-track]');
  const cta = root.querySelector<HTMLElement>('[data-notify-cta]');
  const device = root.querySelector<HTMLElement>('.notify .device-slot');
  const copy = root.querySelector<HTMLElement>('[data-notify-copy]');
  const hold = root.querySelector<HTMLElement>('[data-notify-hold]');

  if (
    !pin ||
    !sleepTrack ||
    !wakeTrack ||
    !readTrack ||
    !closeTrack ||
    !cta ||
    !device ||
    !copy ||
    !hold
  ) {
    throw new Error('notify: found a stage but not its pin, scroll tracks, phone, copy or CTA');
  }

  return {
    stage,
    pin,
    sleepTrack,
    wakeTrack,
    readTrack,
    closeTrack,
    cta,
    device,
    copy,
    hold,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Builds act three in both motion modes.
 *
 * @param root where to look for the section's markup. Defaults to the document.
 * @returns a teardown that reverts everything it created, or a no-op when there is no
 *   `notify` section on the page.
 */
export function createNotifyTimeline(root: ParentNode = document): () => void {
  const elements = collect(root);
  if (!elements) return () => {};

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        const mm = gsap.matchMedia();

        // Desktop and above: the approved act, unchanged.
        mm.add(DESKTOP_QUERY, () => {
          const banner = createSwitch(
            elements.stage,
            '--notify-banner',
            DURATION.section,
            GSAP_EASE.out,
          );

          // The resting state, established once. Without it the section's first painted
          // frame depends on `@property`'s initial value rather than on anything this file
          // did, which is the class of missing baseline `problem.ts` documents at its Gate C
          // rev 3.
          elements.stage.style.setProperty('--notify-banner', '0');
          elements.stage.style.setProperty('--notify-wake', '0');
          elements.stage.style.setProperty('--notify-close', '0');

          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);
          const room = elements.stage
            .querySelector('.room')
            ?.querySelector<HTMLElement>('[data-bloom]');

          const stopScrub = observeScrollProgress({
            track: elements.stage,
            pin: elements.pin,
            onChange: (progress) => {
              const total = elements.stage.offsetHeight - elements.pin.offsetHeight;
              const sleep = elements.sleepTrack.offsetHeight;
              const wake = elements.wakeTrack.offsetHeight;
              const read = elements.readTrack.offsetHeight;
              const close = elements.closeTrack.offsetHeight;
              const travelled = progress * total;

              // The wake against its own spacer, measured from the end of the held beat.
              // Never against the total: that is what keeps the phase exactly as long as it
              // was approved while other phases come and go around it.
              const wakeProgress = wake === 0 ? 0 : clamp01((travelled - sleep) / wake);
              elements.stage.style.setProperty('--notify-wake', String(wakeProgress));

              // The discrete half. `wakeProgress` is continuous, but the banner only ever
              // reads which side of `ARRIVAL_AT` it is on - and only once it is clear of the
              // hysteresis band, so a scroll resting on the line cannot flicker it.
              const past = wakeProgress - ARRIVAL_AT;
              if (Math.abs(past) > HYSTERESIS) {
                banner.commit(past > 0 ? 1 : 0);
              }

              // The close, against its own spacer and measured from the end of the read
              // beat - never against the total, for the same reason the wake is not.
              const closeProgress =
                close === 0 ? 0 : clamp01((travelled - sleep - wake - read) / close);
              elements.stage.style.setProperty('--notify-close', String(closeProgress));
              elements.stage.style.setProperty('--bloom-scroll', String(bloomEase(progress)));

              // The amber room's opacity is `0.1 * (1 - close)`, so once the close is over it
              // is invisible - and still the most expensive thing in the frame: hiding it
              // halved this section's frame time with the GPU off (8.14). Not drawn once it
              // cannot be seen; no pixel changes.
              room?.toggleAttribute('data-unlit', closeProgress === 1);

              // Reachable as soon as it is meaningfully on screen, and inert again on the way
              // back up - the CTA is positional in exactly the way the banner is.
              elements.cta.toggleAttribute('inert', closeProgress < CTA_LIVE_AT);
            },
          });

          return () => {
            stopScrub();
            banner.kill();
            room?.removeAttribute('data-unlit');
          };
        });

        // Below `md`: **only the phone is pinned** (owner, 8.14c Gate C rounds 1 and 2).
        // `.pin` is an ordinary tall column and `.device-slot` is sticky across the beats laid
        // out after it; the copy follows the beats, rises over the held phone and releases it,
        // all in CSS (`Notify.astro`) with no JavaScript touching the copy. The pinned CTA is not shown at
        // this width - `Closing.astro` asks instead - so `--notify-close` stays at 0 and the
        // CTA stays `inert`.
        mm.add(MOBILE_QUERY, () => {
          const banner = createSwitch(
            elements.stage,
            '--notify-banner',
            DURATION.section,
            GSAP_EASE.out,
          );

          elements.stage.style.setProperty('--notify-banner', '0');
          elements.stage.style.setProperty('--notify-wake', '0');
          elements.stage.style.setProperty('--notify-close', '0');
          // Explicit: switching from the desktop branch at a resize can leave it cleared.
          elements.cta.setAttribute('inert', '');

          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);
          let frame = 0;

          const emit = (): void => {
            frame = 0;

            // How far the phone has been held. In flow the hold follows the phone's margin
            // box, so the phone's natural position is the hold's top less the phone's height
            // and (negative) bottom margin; the distance it has been held is how far it now
            // sits below that - zero until it pins, growing while the copy scrolls up over it.
            // Read off the layout rather than restating its lengths.
            const phone = elements.device.getBoundingClientRect();
            const margin = Number.parseFloat(getComputedStyle(elements.device).marginBottom) || 0;
            const natural =
              elements.hold.getBoundingClientRect().top - elements.device.offsetHeight - margin;
            const held = Math.max(0, phone.top - natural);

            // The wake peaks when the copy's bottom reaches the phone's top (round 3). That gap
            // shrinks one-for-one with `held`, so gap plus held is the held distance at the peak.
            const peak = elements.copy.getBoundingClientRect().bottom - phone.top + held;
            const sleep = peak * MOBILE_SLEEP;
            const wakeProgress = peak <= sleep ? 0 : clamp01((held - sleep) / (peak - sleep));
            elements.stage.style.setProperty('--notify-wake', String(wakeProgress));

            const past = wakeProgress - MOBILE_ARRIVAL_AT;
            if (Math.abs(past) > HYSTERESIS) {
              banner.commit(past > 0 ? 1 : 0);
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
            banner.kill();
          };
        });

        return () => mm.revert();
      });
    },

    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        // The designed still frame: the screen is up, the notification is there, the bloom
        // is lit, the copy is present and the CTA is up. Not the asleep state - a visitor
        // who asked for less motion should see the section's *conclusion*, not its setup,
        // and `design-system.md` §5 requires the blooms to remain either way.
        // `Notify.astro`'s reduced-motion rule is what keeps the copy and the phone at full
        // strength underneath rather than dimmed, so this one frame carries both the
        // argument and the ask.
        elements.stage.style.setProperty('--notify-wake', '1');
        elements.stage.style.setProperty('--notify-banner', '1');
        elements.stage.style.setProperty('--notify-close', '1');
        elements.cta.removeAttribute('inert');
      });
    },
  });
}

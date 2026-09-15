/**
 * The auto-add act's choreography - phases.md 8.6. Gate B approved 2026-09-04, and cut back
 * on 2026-09-04 when the owner swapped this act with the notification act and the final CTA
 * went with the swap.
 *
 * The section has one moving part left: the row landing in the list.
 *
 * **The arrival is not scrubbed.** `--playlist-row` is written by a tween that always runs
 * to completion once a scroll threshold is crossed - act three's `--notify-banner` and act
 * two's feed advance, for the same reason. A release either landed in the playlist or it
 * did not; a scrubbed row lets a visitor drag it half into the list and hold it there, or
 * scrub it in and out, which is precisely the claim the section exists to make and would
 * be making a liar of. It is still **positional, not a one-way switch**: scrolling back up
 * crosses the threshold the other way and the row leaves the way it came, with a
 * `HYSTERESIS` band so a scroll resting exactly on the line cannot flicker it.
 *
 * **There is no close any more.** `--playlist-close` scrubbed the playlist's lift and dim
 * under a rising CTA; both the CTA and the 62svh it was raised across now belong to
 * `notify.ts`, which drives the same composition change under the name `--notify-close`.
 * Nothing here replaced it - a section with one idea does not need a second signal.
 *
 * **`.travel.idle` is never read here, and that is the point.** It is the scroll a visitor
 * spends on a list that was already there and is not doing anything, which is what makes
 * the arrival read as something happening to an existing playlist rather than as the
 * section assembling itself. Nothing is driven across it, so there is nothing in this file
 * to tune - which is exactly what stops it being quietly shortened.
 *
 * **Below `md` there is no pin** (owner, 8.14c). The section is one screen that scrolls past
 * normally, and the row lands once the middle of the viewport is a quarter of the way into
 * the section - still a tween that runs to completion, still positional, just triggered by where
 * the section is on screen rather than by a pin's travel. Everything above about spacers
 * describes desktop.
 *
 * **No ScrollTrigger.** `position: sticky` does the pinning and `scroll-progress.ts` does
 * the scrubbing. Act one already loads ScrollTrigger on this route so nothing is saved by
 * the choice here, but it is the mechanism the other sticky acts use and there is no reason
 * for this one to be the odd one out.
 */
import { gsap } from 'gsap';
import { DURATION, GSAP_EASE } from '../tokens';
import { defineTimeline, type MotionContext } from '../reduced-motion';
import { observeScrollProgress } from '../scroll-progress';
import { createSwitch } from '../switch';

/**
 * How far past the threshold the scroll must be before the row accepts a new state.
 * Matches `promise.ts` and `notify.ts`: same problem, same answer.
 */
const HYSTERESIS = 0.06;

/**
 * Where in the arrive track the row actually lands, as a fraction of `.travel.arrive`.
 *
 * Not 0, because the visitor needs a beat of the idle list *inside* this spacer too - the
 * threshold sitting on the spacer's first pixel would make the row land the instant the
 * held beat ends, which reads as the two spacers being one. Not 1 either: the arrival needs
 * track left to settle into, and the copy rides its completion.
 */
const ARRIVAL_AT = 0.45;

/**
 * Below `md`, where the row lands, as how far the viewport's middle is through the section.
 * 0.5 at Gate C round 1 (the owner's "scrolled past half of the section"); round 2 asked for
 * it quicker, "make it 25%"; round 3, "a bit earlier" still.
 */
const MOBILE_ARRIVAL_AT = 0.12;

/** `design-system.md` §4's breakpoint, the divide every other act's mobile branch uses. */
const DESKTOP_QUERY = '(min-width: 768px)';
const MOBILE_QUERY = '(max-width: 767px)';

interface PlaylistElements {
  /** The tall section progress is measured against. Carries the arrival's property. */
  readonly stage: HTMLElement;
  /** The sticky viewport-height element holding the copy and the list. */
  readonly pin: HTMLElement;
  /** The idle beat. Read only for its height, never driven across. */
  readonly idleTrack: HTMLElement;
  /** The track the arrival threshold sits in. */
  readonly arriveTrack: HTMLElement;
}

/** Finds the section's elements, or returns null when it is not on this page. */
function collect(root: ParentNode): PlaylistElements | null {
  const stage = root.querySelector<HTMLElement>('[data-playlist-stage]');
  if (!stage) return null;

  const pin = root.querySelector<HTMLElement>('[data-playlist-pin]');
  const idleTrack = root.querySelector<HTMLElement>('[data-playlist-idle]');
  const arriveTrack = root.querySelector<HTMLElement>('[data-playlist-arrive]');

  if (!pin || !idleTrack || !arriveTrack) {
    throw new Error('playlist: found a stage but not its pin or scroll tracks');
  }

  return { stage, pin, idleTrack, arriveTrack };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Builds the section in both motion modes.
 *
 * @param root where to look for the section's markup. Defaults to the document.
 * @returns a teardown that reverts everything it created, or a no-op when there is no
 *   `playlist` section on the page.
 */
export function createPlaylistTimeline(root: ParentNode = document): () => void {
  const elements = collect(root);
  if (!elements) return () => {};

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        const mm = gsap.matchMedia();

        // Desktop and above: the approved act, unchanged.
        mm.add(DESKTOP_QUERY, () => {
          const row = createSwitch(
            elements.stage,
            '--playlist-row',
            DURATION.section,
            GSAP_EASE.out,
          );

          // The resting state, established once. Without it the section's first painted
          // frame depends on `@property`'s initial value rather than on anything this file
          // did, which is the class of missing baseline `problem.ts` documents at its Gate C
          // rev 3.
          elements.stage.style.setProperty('--playlist-row', '0');

          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);

          const stopScrub = observeScrollProgress({
            track: elements.stage,
            pin: elements.pin,
            onChange: (progress) => {
              const total = elements.stage.offsetHeight - elements.pin.offsetHeight;
              const idle = elements.idleTrack.offsetHeight;
              const arrive = elements.arriveTrack.offsetHeight;
              const travelled = progress * total;

              // The discrete half. `arriveProgress` is continuous, but the row only ever
              // reads which side of `ARRIVAL_AT` it is on - and only once it is clear of the
              // hysteresis band, so a scroll resting on the line cannot flicker it.
              const arriveProgress = arrive === 0 ? 0 : clamp01((travelled - idle) / arrive);
              const past = arriveProgress - ARRIVAL_AT;
              if (Math.abs(past) > HYSTERESIS) row.commit(past > 0 ? 1 : 0);

              // The atmosphere answers the whole section's progress, as it does in act two.
              elements.stage.style.setProperty('--bloom-scroll', String(bloomEase(progress)));
            },
          });

          return () => {
            stopScrub();
            row.kill();
          };
        });

        // Below `md`: no pin. How far the viewport's middle is through the section, 0 at
        // its top edge and 1 at its bottom - the row lands past `MOBILE_ARRIVAL_AT` and
        // leaves again on the way back up, with the same hysteresis band as desktop.
        mm.add(MOBILE_QUERY, () => {
          const row = createSwitch(
            elements.stage,
            '--playlist-row',
            DURATION.section,
            GSAP_EASE.out,
          );
          elements.stage.style.setProperty('--playlist-row', '0');

          const bloomEase = gsap.parseEase(GSAP_EASE.inOut);
          let frame = 0;

          const emit = (): void => {
            frame = 0;
            const section = elements.stage.getBoundingClientRect();
            if (section.height === 0) return;

            const through = (window.innerHeight / 2 - section.top) / section.height;
            const past = through - MOBILE_ARRIVAL_AT;
            if (Math.abs(past) > HYSTERESIS) row.commit(past > 0 ? 1 : 0);

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
            row.kill();
          };
        });

        return () => mm.revert();
      });
    },

    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        // The designed still frame: the row landed and the copy present. Not the idle
        // list - a visitor who asked for less motion should see the section's *conclusion*,
        // not its setup.
        elements.stage.style.setProperty('--playlist-row', '1');
      });
    },
  });
}

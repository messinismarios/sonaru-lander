/**
 * The hero's choreography - the site's first act, restructured 2026-09-03 to drop the
 * device (moved to `promise.ts`, `Feed.astro` - phases.md 8.4).
 *
 * **The headline does not animate** (Gate A, unchanged). It is present, complete and
 * unanimated in the first painted frame - `acceptance-criteria.md` §3,
 * `docs/adr-0003-hero-lcp.md`. Nothing here touches it directly; the `recede`/`bloom` text
 * variants (`Hero.astro`) are pure CSS reading `--blackout`, set below.
 *
 * **The copy is sticky and the lights go out beneath it, then it releases into normal
 * flow** - the one thing left to scrub, now that the device is gone. `position: sticky`
 * pins it in CSS; this file's only job is reporting scroll progress through `.travel` and
 * turning that into `--blackout`, exactly as `scroll-progress.ts` was built for
 * (8.2 Gate B: no ScrollTrigger here, 18 KB stays off this route).
 *
 * The blackout curve itself is simplified from the pre-restructure version: that shape
 * (a slow ramp to 0.9, a hold, then a second ramp to full black) existed to coordinate
 * with the device's separate growth/feed/rest tracks, which no longer exist. With one
 * single travel distance, a single eased ramp across it is the natural shape. First pass,
 * flagged for the owner to confirm at Gate C alongside the text-motion variant.
 *
 * **The hold, and a farewell that runs after the pin lets go (owner, 2026-09-03, revised
 * twice).** After the blackout's own spacer the section carries one more, `hold`, which
 * drives nothing at all - the promise simply sits on black through it. The fade itself no
 * longer has a spacer, because it no longer happens while the section is pinned: it runs
 * on `observeScrollProgress`'s `overrun`, the departure signal, so the line is still
 * fading *as the released pin carries it up the screen* and is gone at the moment it would
 * otherwise be clipped by the top of the viewport. That is what the owner asked for
 * ("right when the user has half-way scrolled past the section … right before the text
 * gets cut off"), and `progress` cannot express it - it is clamped at 1 from the moment
 * the pin releases, which is precisely where this phase begins.
 *
 * **Nothing repositions the promise.** An earlier pass translated the headline down so the
 * line landed at the pin's exact centre once the copy around it had gone. The owner's call
 * (2026-09-03) is that the other two blocks should simply fade and the promise should not
 * move at all, so that translate - and the `--turn-rise` measurement behind it - is gone.
 */
import { gsap } from 'gsap';
import { GSAP_EASE } from '../tokens';
import { defineTimeline, type MotionContext } from '../reduced-motion';
import { observeScrollProgress } from '../scroll-progress';

/**
 * Below this, `.pin` is no longer `position: sticky` (`Hero.astro`'s own `max-width:
 * 767px` block) - 8.14c, `phases.md` §8.14a's Gate B. `design-system.md` §4's own
 * breakpoint.
 */
const DESKTOP_QUERY = '(min-width: 768px)';

interface HeroElements {
  /** The tall section progress is measured against. Carries `--blackout`. */
  readonly stage: HTMLElement;
  /** The sticky viewport-height element holding the copy. */
  readonly pin: HTMLElement;
  /** The scroll the blackout is spent across. */
  readonly lightsTrack: HTMLElement;
  /** The scroll the promise simply holds through before it starts to go. */
  readonly holdTrack: HTMLElement;
}

/**
 * Finds the hero's animated elements, or returns null when the hero is not on this page.
 */
function collect(root: ParentNode): HeroElements | null {
  const stage = root.querySelector<HTMLElement>('[data-hero-stage]');
  if (!stage) return null;

  const pin = root.querySelector<HTMLElement>('[data-hero-pin]');
  const lightsTrack = root.querySelector<HTMLElement>('[data-hero-lights]');
  const holdTrack = root.querySelector<HTMLElement>('[data-hero-hold]');

  if (!pin || !lightsTrack || !holdTrack) {
    throw new Error('hero: found a stage but not its pin or scroll tracks');
  }

  return { stage, pin, lightsTrack, holdTrack };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Where the promise has finished fading, as a fraction of the pin's own height past the
 * moment the pin released. The line sits a little above the pin's centre, so it meets the
 * top of the viewport at ~0.44 of a pin-height of departure (measured, 1512×945); ending
 * at 0.42 puts the last of the fade just short of that - "right before the text gets cut
 * off" rather than at the clip itself.
 */
const FAREWELL_END = 0.42;

/** How much of that departure the fade itself occupies, leaving the rest as more hold. */
const FAREWELL_SPAN = 0.3;

/**
 * Builds the hero in both motion modes.
 *
 * @param root where to look for the hero's markup. Defaults to the document.
 * @returns a teardown that reverts everything it created, or a no-op when there is no
 *   hero on the page.
 */
export function createHeroTimeline(root: ParentNode = document): () => void {
  const elements = collect(root);
  if (!elements) return () => {};

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        const mm = gsap.matchMedia();

        // Desktop and above: the sticky pin, unchanged.
        mm.add(DESKTOP_QUERY, () => {
          const blackoutEase = gsap.parseEase(GSAP_EASE.inOut);

          const stopScrub = observeScrollProgress({
            track: elements.stage,
            pin: elements.pin,
            onChange: (progress, _entry, overrun) => {
              const total = elements.stage.offsetHeight - elements.pin.offsetHeight;
              const lights = elements.lightsTrack.offsetHeight;
              const travelled = progress * total;

              // The blackout against its own spacer, never against the total: that is what
              // keeps its real length exactly where it was approved while other phases come
              // and go around it. `hold` is not read here at all - nothing is driven across
              // it; it exists purely as the scroll the promise stands still through.
              const lit = lights === 0 ? 1 : clamp01(travelled / lights);
              elements.stage.style.setProperty('--blackout', String(clamp01(blackoutEase(lit))));

              // The farewell lives entirely after the pin has released - see the file doc
              // comment for why it cannot be driven by `progress`.
              elements.stage.style.setProperty(
                '--farewell',
                String(clamp01((overrun - (FAREWELL_END - FAREWELL_SPAN)) / FAREWELL_SPAN)),
              );
            },
          });

          return () => {
            stopScrub();
          };
        });

        // Below `md`: `--blackout`/`--farewell` still get no listener - `Hero.astro`'s
        // own mobile block unpins `.pin` and holds them at their `@property` initial
        // value of 0. But the bloom's orbs get one of their own (owner, 8.14c Gate C):
        // big while the hero rests at the top of the page, shrinking as it scrolls away
        // - inverted from desktop's `--bloom-scroll` (`promise.ts` et al.), which grows
        // as its section scrolls *in*. A plain rAF-coalesced scroll listener, the same
        // idiom `scroll-progress.ts` uses - not that function itself, which measures
        // progress against a pin's own travel budget that no longer exists once `.pin`
        // is no longer sticky on this section.
        mm.add('(max-width: 767px)', () => {
          const MAX_SCALE = 2.2;
          const MIN_SCALE = 1;
          let frame = 0;

          const emit = () => {
            frame = 0;
            const top = elements.stage.getBoundingClientRect().top;
            const progress = clamp01(-top / elements.stage.offsetHeight);
            const scale = MAX_SCALE - (MAX_SCALE - MIN_SCALE) * progress;
            elements.stage.style.setProperty('--hero-mobile-orb-scale', String(scale));
          };

          const schedule = () => {
            if (frame === 0) frame = requestAnimationFrame(emit);
          };

          emit();
          addEventListener('scroll', schedule, { passive: true });

          return () => {
            if (frame !== 0) cancelAnimationFrame(frame);
            removeEventListener('scroll', schedule);
          };
        });

        return () => mm.revert();
      });
    },

    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        // The designed still frame: no travel, no listener, the lights stay on
        // (`design-system.md` §5 requires blooms to remain under reduced motion).
        elements.stage.style.setProperty('--blackout', '0');
        elements.stage.style.setProperty('--farewell', '0');
      });
    },
  });
}

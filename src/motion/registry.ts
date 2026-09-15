/**
 * The one place GSAP is configured.
 *
 * Plugins are registered here and nowhere else, the custom easings are defined here, and
 * Lenis is driven from GSAP's ticker so the two share a single rAF loop. Two loops is
 * the classic source of scroll jitter - Lenis updates on its own frame, ScrollTrigger
 * reads positions on another, and the timeline lags the scrollbar by a frame that never
 * settles.
 *
 * **The runtime is split in two, and the split is a performance decision.** A page whose
 * acts are time-based - the hero is exactly that, after Gate A removed the scroll-linked
 * headline - needs GSAP core and nothing else. ScrollTrigger and Lenis together are
 * roughly 20 KB gzipped plus a permanent rAF loop, which is real money on the route the
 * site is judged hardest on. So `initMotion` loads the core synchronously and
 * `initScrollMotion` pulls in the scroll machinery on demand, from the first act that
 * genuinely scrubs.
 *
 * Both are idempotent and both return a teardown. Nothing else in the codebase calls
 * `gsap.registerPlugin`.
 */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import type LenisType from 'lenis';
import { EASE, SCRUB, TRIGGER_START } from './tokens';
import { prefersReducedMotion } from './reduced-motion';

/** ScrollTrigger's type, without pulling its code into the entry chunk. */
type ScrollTriggerModule = Awaited<typeof import('gsap/ScrollTrigger')>['ScrollTrigger'];

interface MotionRuntime {
  /** Undoes everything `initMotion` set up. Safe to call more than once. */
  readonly destroy: () => void;
}

interface ScrollMotionRuntime {
  /** The Lenis instance, or null under reduced motion, where native scrolling is used. */
  readonly lenis: LenisType | null;
  /** Undoes everything `initScrollMotion` set up. Safe to call more than once. */
  readonly destroy: () => void;
}

let runtime: MotionRuntime | null = null;
let scrollRuntime: ScrollMotionRuntime | null = null;

/**
 * Registers the eases every timeline depends on. Call once, from the site's entry point.
 *
 * `CustomEase` is not optional even for a page with no custom curves: `gsap.parseEase()`
 * returns `undefined` for the control-point strings in `GSAP_EASE` unless it is
 * registered, and a tween handed an unparseable ease silently falls back to the default
 * one. The animation still runs; it just stops being the curve the design system
 * specifies.
 */
export function initMotion(): MotionRuntime {
  if (runtime) return runtime;

  // Imported eagerly and deliberately: it is ~2 KB and every timeline on every route
  // needs it, so deferring it would only add a round trip to the critical path.
  gsap.registerPlugin(CustomEase);

  // The one curve with overshoot. Registered by name so timelines reference EASE.spring
  // rather than restating the control points.
  CustomEase.create(EASE.spring, 'M0,0 C0.34,1.56 0.64,1 1,1');

  runtime = {
    destroy: () => {
      runtime = null;
    },
  };
  return runtime;
}

/**
 * Adds the scroll machinery: ScrollTrigger, its defaults, and - only when motion is
 * welcome - Lenis on GSAP's ticker.
 *
 * Called by the first act on a page that scrubs or pins. The hero does neither, so the
 * home route never reaches this and never downloads it.
 *
 * @returns the runtime once both modules have loaded.
 */
export async function initScrollMotion(): Promise<ScrollMotionRuntime> {
  if (scrollRuntime) return scrollRuntime;

  initMotion();

  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.defaults({ scrub: SCRUB, start: TRIGGER_START });

  if (prefersReducedMotion()) {
    // No Lenis at all, and it is never even fetched. design-system.md §5: reduced motion
    // gets native scrolling, not a smoothed scroll with the easing turned down.
    scrollRuntime = { lenis: null, destroy: teardown(ScrollTrigger, null, null) };
    return scrollRuntime;
  }

  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ autoRaf: false });

  // Lenis advances inside GSAP's tick, so ScrollTrigger always reads a scroll position
  // that has already been updated this frame.
  const tick = (time: number): void => lenis.raf(time * 1000);
  gsap.ticker.add(tick);

  // GSAP's ticker smooths its delta by default, which fights Lenis's own interpolation.
  gsap.ticker.lagSmoothing(0);

  lenis.on('scroll', ScrollTrigger.update);

  scrollRuntime = { lenis, destroy: teardown(ScrollTrigger, lenis, tick) };
  return scrollRuntime;
}

/** @returns the live core runtime, or null if `initMotion` has not run. */
export function getMotionRuntime(): MotionRuntime | null {
  return runtime;
}

/** @returns the live scroll runtime, or null if `initScrollMotion` has not run. */
export function getScrollMotionRuntime(): ScrollMotionRuntime | null {
  return scrollRuntime;
}

function teardown(
  scrollTrigger: ScrollTriggerModule,
  lenis: LenisType | null,
  tick: ((time: number) => void) | null,
): () => void {
  return () => {
    if (tick) {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
    }
    lenis?.destroy();
    for (const trigger of scrollTrigger.getAll()) trigger.kill();
    scrollRuntime = null;
  };
}

/**
 * The single `gsap.matchMedia()` context every timeline is defined inside.
 *
 * The point is structural, not stylistic. Because a timeline factory receives both
 * branches at once, the reduced-motion variant is written *next to* the full one and
 * cannot be forgotten - which is the failure mode `acceptance-criteria.md` §4 is
 * guarding against. There is no global "turn animation off" switch anywhere in this
 * codebase, and adding one would defeat the design.
 *
 * `design-system.md` §5 is emphatic that reduced motion is a **designed** experience:
 * scrubbed timelines are replaced by their final state so nothing becomes unreachable,
 * blooms stop drifting but remain, and entrances become opacity-only or nothing. The 8.0
 * study measured the alternative on gsap.com - under `prefers-reduced-motion` their
 * document is 3000px shorter because the pinned act is removed outright, taking its
 * content with it. We do not do that.
 */
import { gsap } from 'gsap';

/*
 * **Below `md` there is no reduced build** (owner, 8.14c round 8: the phone's reduced
 * version "doesn't look great"; re-introduce every effect and remove only the hero's text
 * glow, which is CSS in `Hero.astro`). So a phone with Reduce Motion on gets `full`, and
 * `reduced` is a desktop-and-up composition. Every section's reduced-motion CSS is scoped
 * to `min-width: 768px` to match. This is a stated departure from `design-system.md` §5 and
 * `acceptance-criteria.md` §4 at phone width, recorded in `phases.md`.
 */
const REDUCED = '(prefers-reduced-motion: reduce) and (min-width: 768px)';
const FULL = '(prefers-reduced-motion: no-preference), (max-width: 767px)';

/** True when the visitor has asked for less motion and this width honours it. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(REDUCED).matches;
}

/** What a timeline factory is handed. */
export interface MotionContext {
  /** GSAP's context-scoped selector, so cleanup is automatic. */
  readonly self: gsap.Context;
}

export interface TimelineDefinition {
  /** The full-motion build. */
  readonly full: (context: MotionContext) => void;
  /**
   * The reduced-motion build. Required - not optional - so that "we'll add it later"
   * is not expressible. Where the honest answer is "show the finished state", this
   * function sets that state directly.
   */
  readonly reduced: (context: MotionContext) => void;
}

/**
 * Defines a timeline in both motion modes at once.
 *
 * GSAP swaps between the two branches when the media query changes - a visitor toggling
 * the OS setting mid-session gets the other variant without a reload, and the branch
 * being left tears its own tweens down.
 *
 * @returns a teardown that reverts every tween and ScrollTrigger the definition created.
 */
export function defineTimeline(definition: TimelineDefinition): () => void {
  const media = gsap.matchMedia();

  media.add(FULL, (self) => {
    definition.full({ self });
  });

  media.add(REDUCED, (self) => {
    definition.reduced({ self });
  });

  return () => media.revert();
}

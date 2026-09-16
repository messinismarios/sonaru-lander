/**
 * Motion tokens - the numeric mirror of `design-system.md` §5.
 *
 * Every duration, easing and stagger the site uses is named here. No component and no
 * timeline contains a literal duration: if a number needs to change, it changes once,
 * and every act changes with it. This is the discipline the 8.0 study took from
 * gsap.com's *code* rather than its visuals - their sequences stay coherent because the
 * curves are a small fixed set, not a fresh choice per element.
 */

/**
 * Durations, in seconds, because that is the unit GSAP takes. The CSS custom properties
 * in `tokens.css` carry the same scale in milliseconds for transitions.
 */
export const DURATION = {
  /** Micro: hover, focus, toggle. */
  micro: 0.15,
  /** UI transitions and small reveals. */
  ui: 0.3,
  /** Section entrances. */
  section: 0.6,
  /** Hero-scale reveals. */
  hero: 1.0,
} as const;

/**
 * The control points behind the two standard curves, declared once.
 *
 * CSS and GSAP want the same curve spelled two different ways, and they must not be
 * written out separately: GSAP does not parse `cubic-bezier(...)` - `gsap.parseEase()`
 * returns `undefined` for it and the tween silently falls back to the default ease, which
 * is the worst kind of bug because the animation still runs and merely feels wrong. It
 * *does* parse the bare control points via `CustomEase`. Deriving both spellings from one
 * array is what stops the two from drifting.
 */
const CURVE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/**
 * Three curves, no more, as CSS `transition-timing-function` values. `design-system.md`
 * §5 is explicit that a wider vocabulary is where "fun" turns into "tacky" - and the 8.0
 * study measured nine-plus curve families on gsap.com, which is a library demonstrating
 * its range rather than a product exercising judgement.
 */
export const EASE = {
  /** Entrances, reveals, anything arriving. */
  out: `cubic-bezier(${CURVE.out.join(', ')})`,
  /** State changes between two settled positions. */
  inOut: `cubic-bezier(${CURVE.inOut.join(', ')})`,
  /**
   * Slight overshoot, registered as a GSAP `CustomEase` by the registry under this name.
   * Reserved for the play control and one or two moments of personality - overuse is
   * exactly what `design-system.md` §5 warns against.
   */
  spring: 'sonaru-spring',
} as const;

/**
 * The same three curves in the spelling GSAP understands. Timelines use these; stylesheets
 * use `EASE`. Never pass an `EASE` value to a tween.
 */
export const GSAP_EASE = {
  out: CURVE.out.join(','),
  inOut: CURVE.inOut.join(','),
  spring: EASE.spring,
} as const;

/**
 * Stagger intervals, in seconds. The tight end is what reads as a single rippling
 * gesture; anything at or above `sequence` reads as discrete items arriving one by one.
 * Both figures are the range measured across gsap.com's timelines in the 8.0 study.
 */
export const STAGGER = {
  /** Per-character headline reveals. */
  character: 0.075,
  /** Words, or small groups of elements. */
  word: 0.125,
  /** Cards, rows, list items - deliberately readable as separate arrivals. */
  sequence: 0.3,
} as const;

/**
 * Smoothed scrub, in seconds of catch-up. Never `true`: raw scrub ties the timeline to
 * the scroll position frame for frame and exposes every dropped frame. `scrub: 1` was
 * measured as the value gsap.com uses everywhere it scrubs.
 */
export const SCRUB = 1;

/**
 * Where an entrance fires, as a ScrollTrigger `start`. Measured on gsap.com, whose
 * reveals run between `top 90%` and `top 60%` - content resolves as it enters rather
 * than snapping once centred.
 */
export const TRIGGER_START = 'top 75%';

/**
 * How long the page must go without a scroll event before scrolling counts as over, in
 * seconds. `bloom-rest.ts` holds the bloom drift still until then. Short enough that the
 * field is moving again before a person has settled on what they scrolled to.
 */
export const SCROLL_IDLE = 0.15;

/**
 * How long after first contentful paint an entrance may still start and hide what it is about
 * to reveal, in seconds - SEO audit M1 (owner, Gate B, 2026-09-15). A timeline that begins
 * later than this is late: what is already on screen has been seen, and taking it away to
 * bring it back reads as the page glitching, not arriving. `pricing.ts` leaves those elements
 * alone. A quarter second is under the point where a painted card registers as "there".
 */
export const LATE_START = 0.25;

export type Duration = (typeof DURATION)[keyof typeof DURATION];
export type Ease = (typeof EASE)[keyof typeof EASE];

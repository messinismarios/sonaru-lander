/**
 * Act one's choreography - phases.md 8.3, Gate B (2026-09-02, gate-log.md), revised
 * across ten Gate C rounds (`gate-log.md` 8.3 C rev 1–10).
 *
 * The site's first genuine ScrollTrigger pin (`registry.ts`'s `initScrollMotion`, unused
 * by the hero on purpose - see `hero.ts`). One trigger, pinning at `'top top'`:
 *
 * **Rev 9 tried moving the pin's own `start` to `'top center'`, to make "act one halfway
 * on the viewport" - where the owner wanted text to start - the pin's own engagement
 * point, giving the reveal the entire `PIN_DISTANCE` budget instead of rev 8's squeezed
 * pre-pin sliver. Rev 10 reverted this: `ScrollTrigger`'s `pin: true` freezes the element
 * at whatever layout position it was in *when the trigger fired*, not at the top of the
 * viewport, so pinning from `'top center'` froze the section with its top glued to the
 * viewport's vertical middle for the whole pin - a permanently blank top half, a broken
 * pin, not a valid way to reach that goal.** The pin is back to `'top top'`, and "starts
 * at the viewport's halfway point" is no longer preserved - text now starts (almost)
 * immediately once the section is fully pinned, same as rev 7, just considerably slower
 * (rev 9 and rev 10 both asked for more of that, independently of the halfway question).
 * The section still transits into place in ordinary, unpinned flow before that - genuinely,
 * `design-system.md` §5's "never two pinned acts back to back" - showing nothing, since
 * every animated element's baseline is invisible (see below).
 *
 * A field of small violet points recedes past the copy throughout the pin, layered for
 * parallax, and eight of them - the hero's own showcase releases - glide through as
 * labelled chips. Reference: gsap.com's single-pin budget (`reference-study.md` §1) -
 * `PIN_DISTANCE` is well under their measured 3000px because this act is a hook, not the
 * page's centrepiece.
 *
 * **`PIN_SPAN` grew for rev 9's slower text, and the particle/chip timing constants were
 * scaled by the same factor.** They were explicitly confirmed good at rev 9 ("particles
 * and chips are good") - leaving their *absolute* values unchanged while `PIN_SPAN` grew
 * would have quietly sped them up (a smaller fraction of a bigger total is less real
 * scroll each), the same class of side effect flagged at rev 5 and rev 7. `REAL_PACE_SCALE`
 * exists so their real-pixel pacing survives *that* kind of growth exactly - a `PIN_SPAN`
 * change at a fixed `PIN_DISTANCE`. It does **not** protect them from a change to
 * `PIN_DISTANCE` itself, which is why rev 19 anchors every one of them, and the chip and
 * particle spreads, to `CHOREOGRAPHY_SPAN` instead. See that constant.
 *
 * **Every element that has a "before its turn" state is set there explicitly with
 * `gsap.set`, once, before any scrub tween is created.** Gate C rev 3 (owner): particles
 * and chips were sitting at full opacity long before their own window began. A `.to()`
 * tween - which is what the opacity/scale envelope below is, since it has no natural
 * "from" of its own - does not render its first keyframe until the scrubbed timeline's
 * playhead actually reaches it; until then the element shows whatever was last set on it,
 * which without an explicit baseline is nothing, i.e. plain CSS (opacity 1). The fix is
 * the same one line repeated for every animated group, not a per-tween patch.
 *
 * **Position and visibility are two separate tweens on the same element**, for both the
 * particles and the chips. A single `fromTo` carrying `y` (and, before Gate C rev 2,
 * `opacity`) makes the element's presence a side effect of how far it has travelled,
 * which is why the chip's fade used to look tied to its position. Splitting them lets the
 * glide run continuously - never pausing, never resetting - while opacity/scale follow
 * their own rise/hold/fall envelope via GSAP `keyframes`, independent of where the glide
 * currently is. This is the "passing through" fix.
 *
 * **A particle's timing and its position are deliberately generated from unrelated
 * numbers.** Gate C rev 8 (owner) reported the field reading as "only the right side,
 * then the left" instead of scattered - not an illusion: `begin` (below) and each
 * particle's `x` (`Problem.astro`) were both linear functions of the same per-layer index
 * `i`, just run through the same golden-ratio step. `begin` steps by `√2 − 1` instead of
 * the golden ratio `Problem.astro` uses for `x` and `y`, so the two are no longer the same
 * sequence in disguise.
 *
 * Every sub-tween runs `ease: 'none'`. `scrub: SCRUB` already supplies the smoothing; an
 * eased curve on top of a linear scroll mapping inside the same scrubbed timeline would
 * double the easing and desync the motion from the scrollbar, the same class of bug
 * `hero.ts` avoided by keeping the device growth a pure function of scroll offset. The
 * one exception is the atmosphere/headline/sub arrival, which is a one-time entrance
 * rather than a continuously-scrubbed position, so `GSAP_EASE.out` applies there exactly
 * as `design-system.md` §5 specifies for "entrances, reveals, anything arriving".
 *
 * **`PIN_SPAN`, not the literal number 1.** `scrub` maps the ScrollTrigger's own 0–1
 * scroll progress onto the `pin` timeline's `progress()` - a 0–1 fraction of whatever
 * that timeline's total duration turns out to be, not onto absolute seconds. Every
 * position/duration below is expressed against `CHOREOGRAPHY_SPAN` - everything approved
 * through rev 18 - or, for rev 19's background exit alone, against the tail between that
 * and `PIN_SPAN`. The timeline ends with a no-op anchor tween at exactly `PIN_SPAN`.
 *
 * Reduced motion creates no ScrollTrigger and no pin at all - not a still pin, no pin.
 * `design-system.md` §5 asks for the *final state*, and a pinned-but-motionless section is
 * still a scroll lock a visitor did not ask for. The reduced build renders the section as
 * ordinary static flow: bloom at rest, particles at their fully-receded positions, all
 * eight chips visible, headline and sub fully revealed.
 */
import { gsap } from 'gsap';
import { DURATION, GSAP_EASE, SCRUB, STAGGER, TRIGGER_START } from '../tokens';
import { defineTimeline, type MotionContext } from '../reduced-motion';
import { initScrollMotion } from '../registry';

/**
 * Below this, the pin is gone (8.14c: `phases.md` §8.14a's Gate B). `problem.ts` is the
 * one act among the five with a genuine `ScrollTrigger` pin - `hero.ts`, `promise.ts`,
 * `notify.ts` and `playlist.ts` pin with CSS `position: sticky` instead and are corrected
 * there, not here. `design-system.md` §4's own breakpoint, already in use everywhere else
 * on the site.
 */
const MOBILE_QUERY = '(max-width: 767px)';
const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * How much is added at the *end* of the pin for the background's own exit (rev 19, owner:
 * "after a bit of scrolling, the background should fade out … the total amount scrolled to
 * be raised by a bit (maybe 10%) … all other timings stay the same, the end is just
 * extended a little"). Everything approved before this round is expressed against
 * `CHOREOGRAPHY_SPAN` below and is therefore untouched by it, in units *and* in real
 * pixels.
 *
 * Doubled at rev 20 (owner: the exit "happens too quick and a bit too late … a lot slower,
 * like the others"). The tail alone was 175 real pixels, against the bloom's own ~400px
 * arrival and the hero's ~810px blackout - measurably the fastest thing on the page rather
 * than one of the slower ones.
 */
const OUTRO_FRACTION = 0.2;

/**
 * Scroll allocated to the pin itself, in pixels. Gate B: ~1.5–1.7 viewports (1400px).
 * Grown at rev 13 so the intro reveal - which now runs `'top center'` to well *into* the
 * pin, at a literal real-pixel length derived from the owner's own multipliers - has
 * somewhere to finish: at 1400px the reveal's own resolved end fell past the end of the
 * *page*, a hard clamp, not a design choice, and exactly why the sub-line stopped
 * appearing again after rev 12's fix to the previous bug. Rev 13 first landed this at
 * 2600px (4×/2× real length); the owner then read that much growth as "a bit too much."
 * Rev 14 cuts the reveal's own real length 30% (see the word/sub constants below) and
 * recomputes the *minimum* `PIN_DISTANCE` that still fits it without clamping - 1750px,
 * not an independently chosen number. Rev 19 extends that by `OUTRO_FRACTION` for the
 * background's exit and nothing else. Still comfortably under gsap.com's measured ~3000px
 * single-pin budget (`reference-study.md` §1, cited at Gate B).
 */
const PIN_DISTANCE = Math.round(1750 * (1 + OUTRO_FRACTION));

/**
 * The span every element approved through rev 18 plays across - the old `PIN_SPAN`, kept
 * under its own name so "extend the end" cannot silently rescale the middle.
 *
 * This distinction is load-bearing, and the old comment here was wrong about it. Growing
 * `PIN_SPAN` and `PIN_DISTANCE` in lockstep keeps px-per-unit constant (1400/4.8), so
 * `REAL_PACE_SCALE` - which is a ratio of `PIN_SPAN` - makes every particle/chip window
 * *longer in real pixels*, not equal. `REAL_PACE_SCALE` only cancels a `PIN_SPAN` change
 * made at a fixed `PIN_DISTANCE`, which is the case it was written for at rev 9. Anchoring
 * it to `CHOREOGRAPHY_SPAN` instead makes the constants below immune to this round's
 * growth outright, rather than relying on a compensation that does not apply here.
 */
const CHOREOGRAPHY_SPAN = 4.8 * (1750 / 1400);

/**
 * The pin timeline's own logical length - see the file doc comment for why this matters.
 * The choreography, plus the tail. Grown in exactly the same proportion as `PIN_DISTANCE`,
 * so one unit is the same number of scroll pixels it has been since rev 13.
 */
const PIN_SPAN = CHOREOGRAPHY_SPAN * (1 + OUTRO_FRACTION);

/** rev 7's `PIN_SPAN`, the last value particle/chip timing was tuned and confirmed against. */
const PARTICLE_CHIP_TUNED_SPAN = 2.05;
const REAL_PACE_SCALE = CHOREOGRAPHY_SPAN / PARTICLE_CHIP_TUNED_SPAN;

/**
 * The headline/sub reveal no longer lives inside the pin at all (rev 11). Gate C rev 10
 * had it starting once the section was fully pinned - the owner asked for it to start
 * earlier, while the section is still only **halfway** into the viewport, "just like the
 * bloom and particles start when it's fully in view" (i.e. earlier than that moment, not
 * at it). Rev 9 tried to reach "halfway" by moving the *pin's own* `start` to
 * `'top center'`, which broke the pin itself (rev 10's bug fix) - that trigger governs
 * where the section freezes, not merely where a tween begins, so it can't be repurposed
 * for this.
 *
 * Instead the reveal runs on its **own, separate, non-pinning `ScrollTrigger`** -
 * `elements.stage` from `'top center'` (the section's top has reached the viewport's
 * vertical middle, i.e. it is exactly half scrolled into view). "Halfway" is the *start*
 * the owner asked for, not the whole budget: rev 11 shipped it ending flush at `'top
 * top'`, which the owner then reported (rightly) as still too fast. **A `scrub` trigger's
 * children are driven by the timeline's own `progress()`, a 0–1 fraction of whatever the
 * timeline's total duration works out to be - so scaling every tween's duration by the
 * same factor while the real scroll range stays fixed is a no-op**, the same trap this
 * file's `REAL_PACE_SCALE` exists to avoid for the pin. Real slowness needs real scroll
 * room.
 *
 * **`introStartPx`/the trigger's `start`/`end` are plain numbers, computed once, not
 * strings or functions.** Two failure modes, both hit and fixed in turn: a string end
 * (`` `top top+=${N}` ``, rev 12) resolved to a real range of ~260px instead of the
 * intended ~1000 - `elements.stage` is the *same* element the `pin` trigger below pins,
 * and ScrollTrigger appears to mis-resolve a compound `<position>+=<offset>` string end
 * against an element that is also a pin target elsewhere on the page, so the reveal read
 * as "static" (it finished within a single wheel notch). Switching to a *function*
 * computing `window.scrollY + rect.top` fixed that, but broke the sub-line specifically:
 * once the visitor scrolls past where `pin` engages, `elements.stage`'s
 * `getBoundingClientRect().top` reads back `0` forever (the element is stuck), so a
 * function re-evaluated on the refresh a pin starting triggers for every other
 * `ScrollTrigger` on the page recomputed `end` as `window.scrollY + 0` - a value that
 * kept growing with real scroll, pushing the reveal's own end further away the deeper
 * the visitor scrolled, so `intro`'s `progress()` never reached 1 and the sub-line never
 * appeared. A plain number, captured once here before either trigger has done anything,
 * is immune to both: nothing re-evaluates it later.
 *
 * **Rev 13 changes what the word/sub constants below actually mean.** Through rev 12
 * they were abstract GSAP time units, summed into a timeline whose total duration was
 * then stretched to fit whatever real scroll range the trigger resolved to - which is
 * exactly why "make it slower" by scaling every constant by the same factor had *no
 * effect* (the file doc comment above explains the trap). Gate C rev 12 (owner): heading
 * 4× slower, sub-line 2× slower, and specifically slower *to complete* - not a bigger
 * ratio of an unrelated total. The only way to make that request literal is to stop
 * letting the total auto-normalize: **every constant below is now a real pixel length**,
 * and `INTRO_TOTAL_PX` (their sum) *is* the trigger's real scroll range, not a fraction
 * of it. One abstract unit is one scroll pixel, by construction, so "4× slower" and "set
 * `WORD_DURATION` to 4× its old real-pixel length" are the same edit.
 */

/**
 * How far into the pin the bloom starts fading in, and how long it takes. Still governed
 * by rev 4's "never fade in while moving" rule - starts the instant the pin engages.
 */
const ATMOSPHERE_START = 0;
const ATMOSPHERE_DURATION = 1.05 * 1.3;

/**
 * The bloom's own ceiling - not `1`. `BloomField`'s `ambient` intensity is already
 * `0.62` opacity, tuned for sitting *behind* copy elsewhere on the page; here `.atmosphere`
 * used to tween all the way to `1` and then simply hold there for the remaining ~77% of
 * the pin, which is what read as a charcoal wash rather than the dark ground the hero
 * itself reaches. Nothing in the hero does that - its own bloom is progressively covered
 * by `--blackout` as the visitor scrolls past it. Act one has no equivalent dimming
 * layer, so the fix is not to let the field reach full strength in the first place.
 */
const ATMOSPHERE_PEAK_OPACITY = 0.45;

/**
 * The background's exit (rev 19, retimed at rev 20). It holds at `ATMOSPHERE_PEAK_OPACITY`
 * through the choreography, then goes out, leaving act one's own dark ground to hand over
 * to act two. The copy is untouched: the owner asked for the background, not the text.
 *
 * Rev 19 started it exactly at `CHOREOGRAPHY_SPAN` and gave it only the added tail - 175
 * real pixels, which the owner read as both too fast and too late. `ATMOSPHERE_EXIT_LEAD`
 * is the answer to "too late": the exit now begins one full unit *before* the choreography
 * ends, so the last chip finishes its own fade against an already-dimming field rather than
 * against a field that only starts moving once everything else has stopped. Combined with
 * the doubled tail that gives it 2.2 units - about 640 real pixels, roughly 3.7× rev 19's
 * and sitting between the bloom's own arrival and the hero's blackout, which is what "like
 * the others" asks for.
 *
 * It cannot overlap the arrival (position 0, `ATMOSPHERE_DURATION` ≈ 1.37 units): the lead
 * would have to exceed 4.6 units before the two met.
 */
const ATMOSPHERE_EXIT_LEAD = 1;
const ATMOSPHERE_EXIT_START = CHOREOGRAPHY_SPAN - ATMOSPHERE_EXIT_LEAD;
const ATMOSPHERE_EXIT_DURATION = PIN_SPAN - ATMOSPHERE_EXIT_START;

const WORD_RISE_PX = 16;
const SUB_RISE_PX = 12;

/**
 * The headline's own reveal (stagger + each word's duration), the sub-line's reveal, and
 * the gap between them - all in real scroll pixels (rev 13; see the doc comment above).
 * Originally derived from the owner's Gate C rev 12 request against the previous round's
 * *real* lengths (heading ~543px, sub-line ~400px, multiplied 4× and 2×). Rev 14 (owner):
 * "30% faster - it went too slow" - every value here cut 30% (×0.7) in lockstep, since
 * they're real pixel lengths now: this is a genuine, uniform speed-up, not the no-op
 * scaling that plagued the abstract-unit version through rev 12. `PIN_DISTANCE` above is
 * then the *minimum* that still fits this shorter total without clamping, not tuned
 * independently.
 */
const WORDS_STAGGER_SPAN = 800;
const WORD_DURATION = 720;
const SUB_DURATION = 560;

/**
 * How far *before* the headline finishes the sub-line starts, in real scroll pixels (rev
 * 19, owner: "the subtitle should animate in a little earlier"). It replaces a 48px
 * *delay after* the headline: the sub-line now overlaps the tail of the last words'
 * arrival instead of waiting for it, which is the whole of the change - its own duration,
 * and every headline constant above, are untouched.
 */
const SUB_OVERLAP_PX = 300;

/** When the sub-line starts, in real scroll pixels from the reveal's own beginning. */
const SUB_START_PX = WORDS_STAGGER_SPAN + WORD_DURATION - SUB_OVERLAP_PX;

/** The reveal's total real scroll length - the sum defines the range, not the reverse. */
const INTRO_TOTAL_PX = SUB_START_PX + SUB_DURATION;

/**
 * How far each particle travels, in vh, before and after depth scaling.
 *
 * A particle starts below the fold and recedes above it; `depth` (read from the
 * element's own `data-depth`) scales both ends, so the near layer travels furthest and
 * reads as closer, exactly like `BloomField.astro`'s orbit radii do for the atmosphere.
 */
const PARTICLE_FROM_VH = 40;
const PARTICLE_TO_VH = -60;

/**
 * How long a particle's fade-in, hold and fade-out each last, summing to its window -
 * scaled by `REAL_PACE_SCALE` from the values confirmed good at rev 9 (0.1/0.3/0.1).
 */
const PARTICLE_FADE_IN = 0.1 * REAL_PACE_SCALE;
const PARTICLE_HOLD = 0.3 * REAL_PACE_SCALE;
const PARTICLE_FADE_OUT = 0.1 * REAL_PACE_SCALE;
const PARTICLE_WINDOW = PARTICLE_FADE_IN + PARTICLE_HOLD + PARTICLE_FADE_OUT;

/**
 * The step used to scatter each particle's *timing* across the pin. Deliberately not the
 * golden ratio `Problem.astro` uses for each particle's *position* - see the file doc
 * comment's note on Gate C rev 8's "only the right side, then the left" bug.
 */
const BEGIN_STEP = 0.4142135624;

/**
 * How far a chip rises while it is visible, in px - the full entry-to-exit range, not a
 * small bump. Vertical only (Gate C rev 3, owner: it was drifting sideways, and
 * shouldn't). Confirmed good at rev 9; unchanged.
 */
const CHIP_DRIFT_Y_PX = 120;

/**
 * The chip's scale range while resolving in and out. Confirmed good at rev 9; unchanged
 * since rev 6 (owner: something like 50→100→50, not a full 0→100→0).
 */
const CHIP_BASE_SCALE = 0.5;
const CHIP_PEAK_SCALE = 1;

/**
 * How long a chip's rise-in, hold and fade-out each last, as a fraction of `PIN_SPAN` -
 * scaled by `REAL_PACE_SCALE` from the values confirmed good at rev 9 (0.12/0.22/0.35).
 */
const CHIP_RESOLVE_IN = 0.12 * REAL_PACE_SCALE;
const CHIP_HOLD = 0.22 * REAL_PACE_SCALE;
const CHIP_FADE_OUT = 0.35 * REAL_PACE_SCALE;
const CHIP_WINDOW = CHIP_RESOLVE_IN + CHIP_HOLD + CHIP_FADE_OUT;

/**
 * How much of the desktop glide the mobile field keeps (8.14c Gate C, owner: the stars and
 * chips "should animate on scroll just like they do on desktop").
 *
 * **It is not 1, and that is what makes the two read alike rather than differ.** On desktop
 * the section is pinned, so a particle's own travel is its entire apparent motion - 100vh of
 * it, against a stationary frame. Below `md` there is no pin, so the section is itself
 * travelling up the screen underneath the field: the page supplies most of the movement and
 * the tween only has to supply the *difference* between the layers, which is what parallax
 * is. Replaying the full desktop travel on top of a moving section would run the near layer
 * at roughly four times scroll speed and read as streaking rather than drift.
 *
 * One number for both the particles and the chips, so "faster"/"slower" stays a single edit
 * - which is what round 3 was: **doubled from 0.35 on the owner's call** ("the position
 * effect - vertical movement - twice as big"), the field having read as too still once the
 * chips were halved. The streaking ceiling above is still the thing this number is bounded
 * by; at 0.7 the near layer runs at roughly twice scroll speed rather than four times.
 */
const MOBILE_GLIDE_SCALE = 0.7;

/**
 * The chips' own share of that glide, which is **less than the particles' and is forced
 * rather than chosen** (8.14c Gate C, the approval round). The owner doubled the glide at
 * 80svh and then took the section to 60svh, and at 506px those two do not both fit: the
 * copy block is 258px of it, leaving 124px above and below, and a chip needs its own 21px
 * plus the ~0.65 of its drift that it has already travelled by the time it is fully opaque.
 * Solving `1.65d + 21 ≤ 124` puts the ceiling at 62px, against the 84px a flat 0.7 gives -
 * so at 84px a chip sits on the lede at full opacity through a third of the transit, which
 * is the clutter this gate removed two rounds earlier.
 *
 * **The particles keep the full 0.7**, because the constraint is not about movement, it is
 * about what a 104×21px labelled pill does to type it lands on. A 4px dot crossing a
 * headline is the field doing its job.
 *
 * 0.52 is still ~1.5× the drift these chips had before the doubling, and the number to
 * raise if the section ever gets its height back.
 */
const MOBILE_CHIP_GLIDE_SCALE = 0.52;

/**
 * The chip's scale envelope below `md` (owner, same round: "make the scale effect 50%
 * smaller"). Desktop resolves a chip `CHIP_BASE_SCALE` → `CHIP_PEAK_SCALE`, a span of 0.5;
 * this keeps the same peak and halves the span, so a chip still resolves into place rather
 * than simply appearing, but it arrives most of the way there.
 *
 * Derived from the desktop pair rather than typed as 0.75, so it stays half of whatever
 * that span is if either end is ever re-tuned.
 */
const MOBILE_CHIP_BASE_SCALE = CHIP_PEAK_SCALE - (CHIP_PEAK_SCALE - CHIP_BASE_SCALE) / 2;

interface ProblemElements {
  /** The section the pin measures against. */
  readonly stage: HTMLElement;
  /** The bloom layer that arrives once pinned. */
  readonly atmosphere: HTMLElement;
  /** The headline, split into one element per word. */
  readonly words: readonly HTMLElement[];
  readonly sub: HTMLElement;
  /** The CTA, moved here from the hero - revealed on the sub-line's own window. */
  readonly actions: HTMLElement;
  readonly particles: readonly HTMLElement[];
  readonly chips: readonly HTMLElement[];
}

function collect(root: ParentNode): ProblemElements | null {
  const stage = root.querySelector<HTMLElement>('[data-problem-stage]');
  if (!stage) return null;

  const atmosphere = root.querySelector<HTMLElement>('[data-problem-atmosphere]');
  const words = Array.from(root.querySelectorAll<HTMLElement>('[data-word]'));
  const sub = root.querySelector<HTMLElement>('[data-problem-sub]');
  const actions = root.querySelector<HTMLElement>('[data-problem-actions]');
  const particles = Array.from(root.querySelectorAll<HTMLElement>('[data-particle]'));
  const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-chip]'));

  if (
    !atmosphere ||
    words.length === 0 ||
    !sub ||
    !actions ||
    particles.length === 0 ||
    chips.length === 0
  ) {
    throw new Error('problem: found a stage but not its atmosphere, copy, particles or chips');
  }

  return { stage, atmosphere, words, sub, actions, particles, chips };
}

/**
 * Builds act one in both motion modes.
 *
 * @param root where to look for the section's markup. Defaults to the document.
 * @returns a teardown that reverts everything it created, or a no-op when there is no
 *   `problem` section on the page.
 */
export async function createProblemTimeline(root: ParentNode = document): Promise<() => void> {
  const elements = collect(root);
  if (!elements) return () => {};

  await initScrollMotion();

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        const mm = gsap.matchMedia();

        // Desktop and above: the pin, unchanged since rev 20 - see the file doc comment.
        mm.add(DESKTOP_QUERY, () => {
          // Explicit baselines - see the file doc comment. Nothing below may rely on a
          // `.to()` tween's first keyframe to establish an element's resting state, and the
          // un-pinned transit into view must show nothing but the section's own dark ground.
          gsap.set(elements.atmosphere, { opacity: 0 });
          gsap.set(elements.words, { opacity: 0 });
          gsap.set(elements.sub, { opacity: 0 });
          gsap.set(elements.actions, { opacity: 0 });
          gsap.set(elements.particles, { opacity: 0 });
          gsap.set(elements.chips, { opacity: 0, scale: CHIP_BASE_SCALE });

          // The headline/sub reveal: its own trigger, its own timeline, driven by the
          // section's real scroll position rather than the pin's internal progress - see
          // the constants above for why. Not pinning: this is the ordinary transit into
          // place, scrubbed.
          //
          // `introStartPx` is computed **once, here, as a plain number** - not as a
          // ScrollTrigger start/end function re-evaluated on every refresh. It has to be:
          // `elements.stage` is also the `pin` trigger's target below, and once that pin
          // has engaged, `getBoundingClientRect().top` reads back `0` forever (the element
          // is stuck), so a function recomputing this later - on the refresh a pin
          // starting/stopping triggers for every other `ScrollTrigger` on the page - would
          // read `window.scrollY + 0`, a value that keeps growing with real scroll,
          // silently pushing `end` further away the deeper the visitor scrolls. That
          // desync is exactly why the sub-line never appeared: `intro`'s own `progress()`
          // kept reporting less than 1 long after the visitor had scrolled well past
          // where the reveal should have finished.
          const introStartPx =
            window.scrollY + elements.stage.getBoundingClientRect().top - window.innerHeight / 2;
          const intro = gsap.timeline({
            scrollTrigger: {
              trigger: elements.stage,
              start: introStartPx,
              end: introStartPx + INTRO_TOTAL_PX,
              scrub: SCRUB,
            },
          });
          intro.fromTo(
            elements.words,
            { opacity: 0, y: WORD_RISE_PX },
            {
              opacity: 1,
              y: 0,
              ease: GSAP_EASE.out,
              duration: WORD_DURATION,
              stagger: { amount: WORDS_STAGGER_SPAN, from: 'start' },
            },
            0,
          );
          intro.fromTo(
            elements.sub,
            { opacity: 0, y: SUB_RISE_PX },
            { opacity: 1, y: 0, ease: GSAP_EASE.out, duration: SUB_DURATION },
            SUB_START_PX,
          );
          // The CTA arrives on exactly the sub-line's window - same position, same duration.
          // Deliberate: giving it a window of its own would have moved `INTRO_TOTAL_PX`, and
          // with it every real-pixel timing the owner has approved across revs 13–20. This
          // way the section gains a CTA and nothing else changes at all.
          intro.fromTo(
            elements.actions,
            { opacity: 0, y: SUB_RISE_PX },
            { opacity: 1, y: 0, ease: GSAP_EASE.out, duration: SUB_DURATION },
            SUB_START_PX,
          );

          const pin = gsap.timeline({
            scrollTrigger: {
              trigger: elements.stage,
              start: 'top top',
              end: `+=${PIN_DISTANCE}`,
              scrub: SCRUB,
              pin: true,
            },
          });

          // The bloom's own arrival, only once pinned - a stationary crossfade, never a
          // moving one (rev 4's fix, still governing this element).
          pin.fromTo(
            elements.atmosphere,
            { opacity: 0 },
            {
              opacity: ATMOSPHERE_PEAK_OPACITY,
              ease: GSAP_EASE.out,
              duration: ATMOSPHERE_DURATION,
            },
            ATMOSPHERE_START,
          );

          // …and its exit (rev 19, retimed and re-eased at rev 20).
          //
          // **`'none'`, not `GSAP_EASE.out`.** Rev 19 copied the arrival's ease-out on the
          // reasoning that both are stationary crossfades. That was wrong, and measurably so:
          // ease-out is fast-then-slow, so across a 640px exit the field fell from 0.45 to
          // 0.10 in the first ~150px and then crawled - lengthening the tween did almost
          // nothing to how fast it *looked*, which is why rev 19 read as "too quick" even
          // after it was given more room. `design-system.md` §5 reserves ease-out for
          // "entrances, reveals, anything arriving"; this is a departure, and this file's own
          // rule - every scrubbed sub-tween runs `'none'`, the arrival being the sole
          // exception - applies to it as written.
          pin.to(
            elements.atmosphere,
            { opacity: 0, ease: 'none', duration: ATMOSPHERE_EXIT_DURATION },
            ATMOSPHERE_EXIT_START,
          );

          elements.particles.forEach((particle, index) => {
            const depth = Number(particle.dataset.depth ?? 1);
            // Deterministic scatter, not sequential - otherwise the field would recede in
            // strict left-to-right document order, which reads as a mechanism rather than
            // a drift. `BEGIN_STEP`, not the golden ratio `Problem.astro` scatters position
            // with - see the file doc comment.
            const begin = (index * BEGIN_STEP) % (CHOREOGRAPHY_SPAN - PARTICLE_WINDOW);

            // The glide: continuous position, unaware of visibility.
            pin.fromTo(
              particle,
              { y: `${PARTICLE_FROM_VH * depth}vh` },
              { y: `${PARTICLE_TO_VH * depth}vh`, ease: 'none', duration: PARTICLE_WINDOW },
              begin,
            );
            // The visibility envelope: invisible, fades in, holds, fades out - independent
            // of the glide, which never pauses.
            pin.to(
              particle,
              {
                keyframes: [
                  { opacity: 0, duration: 0 },
                  { opacity: 1, duration: PARTICLE_FADE_IN },
                  { opacity: 1, duration: PARTICLE_HOLD },
                  { opacity: 0, duration: PARTICLE_FADE_OUT },
                ],
                ease: 'none',
              },
              begin,
            );
          });

          // Spread evenly across [0, CHOREOGRAPHY_SPAN - CHIP_WINDOW], so the last chip's
          // fade-out ends at exactly CHOREOGRAPHY_SPAN - the point the background's own exit
          // then starts from. `CHOREOGRAPHY_SPAN`, not `PIN_SPAN`: spreading across the
          // extended total would have slowed every chip by the same 10% the tail added, which
          // is the timing the owner asked to keep unchanged.
          const chipSpacing =
            elements.chips.length > 1
              ? (CHOREOGRAPHY_SPAN - CHIP_WINDOW) / (elements.chips.length - 1)
              : 0;

          elements.chips.forEach((chip, index) => {
            const start = index * chipSpacing;

            // The glide: continuous the whole time the chip is visible, so it reads as
            // passing through rather than popping up and fading in place. Vertical only.
            pin.fromTo(
              chip,
              { y: CHIP_DRIFT_Y_PX },
              { y: -CHIP_DRIFT_Y_PX, ease: 'none', duration: CHIP_WINDOW },
              start,
            );
            // The visibility envelope, layered on top: rise in, hold at full presence,
            // fall away - independent of the glide, which never pauses.
            pin.to(
              chip,
              {
                keyframes: [
                  { opacity: 0, scale: CHIP_BASE_SCALE, duration: 0 },
                  { opacity: 1, scale: CHIP_PEAK_SCALE, duration: CHIP_RESOLVE_IN },
                  { opacity: 1, scale: CHIP_PEAK_SCALE, duration: CHIP_HOLD },
                  { opacity: 0, scale: CHIP_BASE_SCALE, duration: CHIP_FADE_OUT },
                ],
                ease: 'none',
              },
              start,
            );
          });

          // A no-op anchor: guarantees the timeline's total duration is exactly PIN_SPAN
          // even if a future tweak leaves every visible tween ending slightly earlier.
          pin.to({}, { duration: 0 }, PIN_SPAN);

          return () => {
            intro.scrollTrigger?.kill();
            intro.kill();
            pin.scrollTrigger?.kill();
            pin.kill();
          };
        });

        // Below `md`: no pin (8.14c; `phases.md` §8.14a's Gate B), and two separately
        // driven halves rather than one (8.14c Gate C, owner: the text and background
        // "shouldn't be pinned like they are on desktop, but the stars and chips should
        // animate on scroll just like they do on desktop").
        //
        // So the copy keeps the one-shot reveal - it is the half that must not depend on
        // scroll position - and the field goes back on the scrollbar, scrubbed across the
        // section's own unpinned transit instead of across a pin's budget. The bloom is
        // absent here entirely: `Problem.astro` takes `.atmosphere` out at this width
        // (owner, same gate: "the glow balls are not working here, just remove them"), so
        // nothing below animates it.
        mm.add(MOBILE_QUERY, () => {
          gsap.set(elements.words, { opacity: 0, y: WORD_RISE_PX });
          gsap.set(elements.sub, { opacity: 0, y: SUB_RISE_PX });
          gsap.set(elements.actions, { opacity: 0, y: SUB_RISE_PX });
          gsap.set(elements.particles, { opacity: 0 });
          gsap.set(elements.chips, { opacity: 0, scale: MOBILE_CHIP_BASE_SCALE });

          // `scrub: false` is explicit, not the default - `registry.ts`'s
          // `initScrollMotion` sets `ScrollTrigger.defaults({ scrub: SCRUB, ... })`
          // globally, and inheriting it here would tie this "one-shot" reveal to scroll
          // position instead of letting it play through on its own (`pricing.ts` names
          // this exact trap).
          const reveal = gsap.timeline({
            scrollTrigger: { trigger: elements.stage, start: TRIGGER_START, scrub: false },
          });
          reveal.to(
            elements.words,
            {
              opacity: 1,
              y: 0,
              ease: GSAP_EASE.out,
              duration: DURATION.section,
              stagger: STAGGER.word,
            },
            0,
          );
          reveal.to(
            elements.sub,
            { opacity: 1, y: 0, ease: GSAP_EASE.out, duration: DURATION.section },
            0,
          );
          reveal.to(
            elements.actions,
            { opacity: 1, y: 0, ease: GSAP_EASE.out, duration: DURATION.section },
            0,
          );

          // The field, scrubbed. The range is the section's whole transit through the
          // viewport - the only scroll this act owns now that it does not hold the page
          // still - and the choreography inside it is desktop's, unit for unit: the same
          // `CHOREOGRAPHY_SPAN` positions, the same scatter, the same rise/hold/fall
          // envelopes. A scrubbed timeline's units are normalised onto whatever real range
          // its trigger resolves to, so reusing them maps the approved pacing onto this
          // shorter run rather than restating it in new numbers. Only the *travel* is
          // scaled - see `MOBILE_GLIDE_SCALE` for why that is the part that cannot carry
          // over unchanged.
          const field = gsap.timeline({
            scrollTrigger: {
              trigger: elements.stage,
              start: 'top bottom',
              end: 'bottom top',
              scrub: SCRUB,
            },
          });

          elements.particles.forEach((particle, index) => {
            const depth = Number(particle.dataset.depth ?? 1) * MOBILE_GLIDE_SCALE;
            const begin = (index * BEGIN_STEP) % (CHOREOGRAPHY_SPAN - PARTICLE_WINDOW);

            field.fromTo(
              particle,
              { y: `${PARTICLE_FROM_VH * depth}vh` },
              { y: `${PARTICLE_TO_VH * depth}vh`, ease: 'none', duration: PARTICLE_WINDOW },
              begin,
            );
            field.to(
              particle,
              {
                keyframes: [
                  { opacity: 0, duration: 0 },
                  { opacity: 1, duration: PARTICLE_FADE_IN },
                  { opacity: 1, duration: PARTICLE_HOLD },
                  { opacity: 0, duration: PARTICLE_FADE_OUT },
                ],
                ease: 'none',
              },
              begin,
            );
          });

          const chipSpacing =
            elements.chips.length > 1
              ? (CHOREOGRAPHY_SPAN - CHIP_WINDOW) / (elements.chips.length - 1)
              : 0;

          elements.chips.forEach((chip, index) => {
            const start = index * chipSpacing;
            const drift = CHIP_DRIFT_Y_PX * MOBILE_CHIP_GLIDE_SCALE;

            field.fromTo(
              chip,
              { y: drift },
              { y: -drift, ease: 'none', duration: CHIP_WINDOW },
              start,
            );
            field.to(
              chip,
              {
                keyframes: [
                  { opacity: 0, scale: MOBILE_CHIP_BASE_SCALE, duration: 0 },
                  { opacity: 1, scale: CHIP_PEAK_SCALE, duration: CHIP_RESOLVE_IN },
                  { opacity: 1, scale: CHIP_PEAK_SCALE, duration: CHIP_HOLD },
                  { opacity: 0, scale: MOBILE_CHIP_BASE_SCALE, duration: CHIP_FADE_OUT },
                ],
                ease: 'none',
              },
              start,
            );
          });

          field.to({}, { duration: 0 }, CHOREOGRAPHY_SPAN);

          return () => {
            reveal.scrollTrigger?.kill();
            reveal.kill();
            field.scrollTrigger?.kill();
            field.kill();
          };
        });

        return () => mm.revert();
      });
    },

    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        gsap.set(elements.atmosphere, { opacity: ATMOSPHERE_PEAK_OPACITY });
        gsap.set(elements.words, { opacity: 1, y: 0 });
        gsap.set(elements.sub, { opacity: 1, y: 0 });
        gsap.set(elements.actions, { opacity: 1, y: 0 });
        elements.particles.forEach((particle) => {
          const depth = Number(particle.dataset.depth ?? 1);
          gsap.set(particle, { y: `${PARTICLE_TO_VH * depth}vh`, opacity: 0.15 });
        });
        gsap.set(elements.chips, {
          y: 0,
          scale: (CHIP_BASE_SCALE + CHIP_PEAK_SCALE) / 2,
          opacity: 1,
        });
      });
    },
  });
}

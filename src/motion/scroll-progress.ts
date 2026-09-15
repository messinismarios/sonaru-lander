/**
 * Scroll progress through an element, reported once per frame.
 *
 * **Why this exists instead of ScrollTrigger.** Measured at 8.2's Gate B:
 * `ScrollTrigger.min.js` is 17,982 bytes gzipped against a home route that ships ~31,000
 * bytes in total. It is +58% on the route the site is judged hardest on, and we would be
 * buying almost none of it - `position: sticky` does the pinning in CSS, so the only
 * thing left is "how far through this element have we scrolled". That is the function
 * below.
 *
 * **There is deliberately no smoothing.** An earlier version lerped towards the target
 * over ~0.5s, which is GSAP's `scrub: 1` feel and what gsap.com uses. The owner rejected
 * it at Gate C rev 3: the hero's copy scrolls natively at 1:1 with the wheel while a
 * smoothed device trails behind it, so the two visibly desynchronise and the phone reads
 * as lagging. Progress is therefore a pure function of scroll position - the device and
 * the text move as one object, because they are driven by the same number with nothing
 * between them.
 *
 * The rAF is not smoothing; it is coalescing. Several scroll events can fire between two
 * frames, and writing on each one would lay out the page more than once per frame for no
 * visible gain.
 *
 * This does **not** foreclose ScrollTrigger. 8.3's act genuinely pins with pin-spacing
 * and reordering, which is where the library earns its weight; `initScrollMotion()` is
 * still there to load it lazily when that act arrives.
 */

export interface ScrollProgressOptions {
  /**
   * The element whose traversal defines 0 → 1. Progress is read from its
   * `getBoundingClientRect().top`, never from `scrollY` or `innerHeight`: on iOS the
   * collapsing address bar changes `innerHeight` mid-scroll, and a progress computed
   * against it jitters exactly when the user is scrolling hardest.
   */
  readonly track: HTMLElement;
  /** The sticky element inside the track. Its height is the part of the track that is not travel. */
  readonly pin: HTMLElement;
  /**
   * Called with the progress, at most once per frame.
   *
   * `entry` is the *approach*: 0 while the track's top is still a pin-height below the
   * viewport's top, 1 the moment it reaches it - i.e. the run-up that happens entirely
   * before `progress` leaves 0. Measured against `pin.offsetHeight`, not `innerHeight`,
   * for the same reason `progress` is measured against `rect.top`: the pin is `100svh`,
   * a unit iOS's collapsing address bar does not move mid-scroll.
   *
   * `overrun` is the mirror image: the *departure*, 0 at the moment `progress` reaches 1
   * - which is exactly when a `top: 0` sticky pin releases - and 1 once the released pin
   * has travelled its own height up and off the screen. It is what lets a caller keep
   * driving something after the pin has let go, which `progress` cannot do because it is
   * clamped. Bounded rather than raw pixels on purpose: past the section it stops
   * changing, so the skip-if-unchanged guard below still holds and this does not turn
   * into a callback on every scroll frame of the whole page.
   */
  readonly onChange: (progress: number, entry: number, overrun: number) => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Reports the progress of `track` through the viewport on every frame it changes.
 *
 * @returns a teardown that removes the listener, the observer and any pending frame.
 */
export function observeScrollProgress({ track, pin, onChange }: ScrollProgressOptions): () => void {
  let travel = 1;
  let approach = 1;
  let last = -1;
  let lastEntry = -1;
  let lastOverrun = -1;
  let frame = 0;

  const measure = (): void => {
    travel = Math.max(1, track.offsetHeight - pin.offsetHeight);
    approach = Math.max(1, pin.offsetHeight);
  };

  const emit = (): void => {
    frame = 0;
    const top = track.getBoundingClientRect().top;
    const progress = clamp01(-top / travel);
    const entry = clamp01(1 - top / approach);
    const overrun = clamp01((-top - travel) / approach);
    // Nothing moved this frame - skip the write rather than dirtying style for nothing.
    // All three are checked: `entry` moves over the run-up and `overrun` over the
    // departure, both while `progress` sits pinned at a flat 0 or 1, and a caller driving
    // something from either needs those frames.
    if (progress === last && entry === lastEntry && overrun === lastOverrun) return;
    last = progress;
    lastEntry = entry;
    lastOverrun = overrun;
    onChange(progress, entry, overrun);
  };

  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(emit);
  };

  measure();
  emit();

  addEventListener('scroll', schedule, { passive: true });
  const resize = new ResizeObserver(() => {
    measure();
    schedule();
  });
  resize.observe(track);
  resize.observe(pin);

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    removeEventListener('scroll', schedule);
    resize.disconnect();
  };
}

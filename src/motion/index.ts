/**
 * The motion layer's public surface.
 *
 * Sections import from here. They never import `gsap` directly, never call
 * `registerPlugin`, and never author a tween inline - they ask a factory in
 * `./timelines/` for a composed, named timeline. See ../../CLAUDE.md.
 */
export { DURATION, EASE, GSAP_EASE, STAGGER, SCRUB, TRIGGER_START, SCROLL_IDLE } from './tokens';
export type { Duration, Ease } from './tokens';
export { initMotion, initScrollMotion, getMotionRuntime, getScrollMotionRuntime } from './registry';
export { defineTimeline, prefersReducedMotion } from './reduced-motion';
export type { MotionContext, TimelineDefinition } from './reduced-motion';
export { createHeroTimeline } from './timelines/hero';
export { createProblemTimeline } from './timelines/problem';
export { createPromiseTimeline } from './timelines/promise';
export { createNotifyTimeline } from './timelines/notify';
export { createPlaylistTimeline } from './timelines/playlist';
export { createPricingTimeline } from './timelines/pricing';
export { restBlooms } from './bloom-rest';

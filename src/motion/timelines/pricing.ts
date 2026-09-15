/**
 * The pricing page's choreography - phases.md 8.7, Gate B approved 2026-09-06.
 *
 * The lightest timeline on the site, and deliberately so. Pricing is a page you read and
 * compare on, not an act you scroll through: there is no pin, no scrub, and no device.
 * Three groups fade and rise once as they come into view, and that is the whole of it.
 *
 * **Nothing above the fold is touched.** `acceptance-criteria.md` line 43 forbids an
 * animation-dependent LCP element, and the giant "Pricing" word is this route's LCP
 * element - so `PricingHero` is not in this file at all, not even at `opacity: 1`. The
 * hero is painted by CSS and never handed to GSAP.
 *
 * **`scrub: false` is passed explicitly on every trigger.** `registry.ts`'s
 * `initScrollMotion` sets `ScrollTrigger.defaults({ scrub: SCRUB, ... })` for the home
 * route's scrubbed acts; inheriting that here would tie these entrances to the scroll
 * position and make them run backwards on the way up, which is not what a one-shot
 * reveal does.
 *
 * Baselines are set with `gsap.set` before any tween is created, the same discipline
 * `problem.ts` documents at length: a `fromTo` does not render its first keyframe until
 * its trigger fires, so without an explicit baseline every element sits at full opacity
 * until the moment it is supposed to arrive.
 */
import { gsap } from 'gsap';
import { DURATION, GSAP_EASE, STAGGER, TRIGGER_START } from '../tokens';
import { initScrollMotion } from '../registry';
import { defineTimeline, type MotionContext } from '../reduced-motion';

/** How far each group travels on its way in. Cards move further than rows. */
const CARD_RISE = 24;
const ROW_RISE = 16;

interface PricingElements {
  readonly cards: readonly HTMLElement[];
  readonly rows: readonly HTMLElement[];
  readonly faqItems: readonly HTMLElement[];
  readonly toggle: HTMLElement | null;
}

function collect(root: ParentNode): PricingElements | null {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-plan-card]')];
  if (cards.length === 0) return null;

  return {
    cards,
    rows: [...root.querySelectorAll<HTMLElement>('[data-compare-row]')],
    faqItems: [...root.querySelectorAll<HTMLElement>('[data-faq-item]')],
    toggle: root.querySelector<HTMLElement>('[data-plans-toggle]'),
  };
}

/**
 * One group's reveal: fade and rise, staggered, fired once when the group enters.
 *
 * `once: true` rather than a default toggle: this is a reading page and a visitor
 * scrolling back up to re-read a price should find it there, not watch it re-enter.
 */
function reveal(targets: readonly HTMLElement[], rise: number, stagger: number): void {
  if (targets.length === 0) return;

  gsap.set(targets, { opacity: 0, y: rise });

  gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: DURATION.section,
    ease: GSAP_EASE.out,
    stagger,
    scrollTrigger: {
      trigger: targets[0] as HTMLElement,
      start: TRIGGER_START,
      scrub: false,
      once: true,
    },
  });
}

/**
 * Builds the pricing route's entrances.
 *
 * @param root where to look for the page's elements; overridable for tests.
 * @returns a teardown reverting every tween and trigger this created.
 */
export async function createPricingTimeline(root: ParentNode = document): Promise<() => void> {
  const elements = collect(root);
  if (!elements) return () => {};

  await initScrollMotion();

  const groups: readonly (readonly [readonly HTMLElement[], number, number])[] = [
    [
      elements.toggle ? [elements.toggle, ...elements.cards] : elements.cards,
      CARD_RISE,
      STAGGER.sequence,
    ],
    [elements.rows, ROW_RISE, STAGGER.word],
    [elements.faqItems, ROW_RISE, STAGGER.word],
  ];

  return defineTimeline({
    full: ({ self }: MotionContext) => {
      self.add(() => {
        for (const [targets, rise, stagger] of groups) reveal(targets, rise, stagger);
      });
    },

    /*
     * Reduced motion gets the finished page, not a stripped one. `design-system.md` §5:
     * entrances become "opacity-only or nothing", and for a page whose content is prices
     * and prose, nothing is the honest answer - every element is already where it belongs
     * and the only thing the full build adds is the arriving.
     */
    reduced: ({ self }: MotionContext) => {
      self.add(() => {
        for (const [targets] of groups) {
          if (targets.length > 0) gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' });
        }
      });
    },
  });
}

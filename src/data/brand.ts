/**
 * `/brand` - the identity document's chapters, rules and worked examples.
 *
 * A data module for `press.ts`'s reason: the chapter list is something a test can walk,
 * and `tests/unit/brand-inventory.spec.ts` checks it against the headings the page
 * actually renders and against the table of contents, in both directions. A chapter that
 * exists in one and not the other is a document whose contents page lies.
 *
 * **What is *not* here is as deliberate as what is.** No hex value, no geometry number, no
 * duration, no contrast ratio - every one of those is read from the file that owns it at
 * render time (`tokens.css`, `mark-geometry.ts`, `src/motion/tokens.ts`,
 * `src/lib/contrast.ts`). This module holds only the sentences a human wrote. That split
 * is the whole design of the page: 8.10c's Gate A promised a document that **cannot print
 * a number the source disagrees with**, and the way to keep that promise is for the prose
 * never to have the number in the first place.
 *
 * **It takes no new brand decisions except two, which the brief forces.** `design-system.md`
 * §9.5 defines neither clear space nor a minimum size, and an identity document must state
 * both - see `CLEAR_SPACE` and `MINIMUM_SIZE` below, each carrying its reasoning so the
 * owner can overrule the number by looking at Gate C rather than by taking my word for it.
 * Everything else is a description of what already shipped. §9.5's dropped optical work is
 * **not** reopened here.
 */
import type { Catalogue } from '../i18n';

export interface Chapter {
  /** The key into `brand.chapters`, the `<h2>`'s id, and the contents rail's fragment. */
  readonly id: keyof Catalogue['brand']['chapters'];
}

/**
 * The seven chapters, in the order the page runs them.
 *
 * **The order is gsap `/brand`'s** - mark before colour - approved at Gate A. What follows
 * it is ours: the two chapters no reference has (construction, motion) sit where a reader
 * who came for a logo file will still scroll past them. The eighth, voice, was removed by
 * the owner at the 2026-09-14 copy pass.
 */
export const CHAPTERS: readonly Chapter[] = [
  { id: 'mark' },
  { id: 'construction' },
  { id: 'clear-space' },
  { id: 'colour' },
  { id: 'type' },
  { id: 'motion' },
  { id: 'artwork' },
];

/**
 * How the name is written.
 *
 * **Taken from linear.app/brand**, whose *Naming* and *Usage* sections are the only thing
 * on any reference brand page that is neither a file nor a swatch - and the two questions
 * someone writing about a product actually has. A clear-space diagram is for a designer
 * placing a logo; this is for everyone else.
 */
/**
 * The mark's clear space.
 *
 * **A new decision, and one of only two on this page** (Gate B, 2026-09-10). §9.5 never
 * defined one, and a document that documents everything except the rule people break most
 * is a document with a hole in it.
 *
 * **Expressed in the mark's own stroke rather than in pixels**, which is what makes it a
 * rule instead of a number: `PRESET.stroke` scales with the mark, so the same sentence
 * holds at 20px in a footer and at 2048px on a poster. A pixel value would be correct at
 * exactly one size and quietly wrong everywhere else - and the wrong sizes are the ones a
 * reader reaches for, because they are the ones the brand actually ships at.
 */
export const CLEAR_SPACE = { strokes: 1 } as const;

/**
 * The smallest the mark may be set.
 *
 * **The second and last new decision.** The number is not arrived at by convention: below
 * about 20px the sonar's stroke at `sonarOpacity` 0.34 stops resolving as a separate arc
 * and the mark reads as a plain S with a smudge. That is a property of *this* mark's own
 * numbers rather than a general rule about small logos, which is why the figure on the
 * page prints three sizes side by side and invites the owner to disagree with the middle
 * one by looking at it.
 *
 * `favicon.svg` is generated at 32 and the app icons at 180/192/512, so nothing we ship
 * today is near the floor. It exists for the places we do not control.
 */
export const MINIMUM_SIZE = { px: 20, figure: [16, 20, 24] } as const;

export interface Misuse {
  /** The key into `brand.misuse.items`, where the label and the reason live. */
  readonly id: keyof Catalogue['brand']['misuse']['items'];
}

/**
 * Six things not to do, each rendered as a **live mark with the misuse applied**.
 *
 * Not screenshots, which is the decision worth recording. A misuse panel shipped as an
 * image is a picture of a mark we used to have: it costs bytes, it churns the way 8.10b's
 * logo rasters churned, and the day `PRESET` changes it becomes a lie that no test can
 * see. Rendered live from the same component the real mark uses, all six update
 * themselves and cost nothing at build time.
 *
 * **Every one of these is a mistake this project actually made or nearly made**, which is
 * why there are six rather than a round ten. Inventing misuses to fill a grid is the
 * corporate-brand-book cliché the page is trying not to be.
 */
export const MISUSES: readonly Misuse[] = [
  { id: 'recolour' },
  { id: 'opacity' },
  { id: 'stretch' },
  { id: 'rotate' },
  { id: 'busy' },
  { id: 'reface' },
];

/**
 * The app and the site, and which one is the source of truth.
 *
 * The document closes here rather than opening here: it is the chapter that matters most
 * to us and least to a reader who came for a logo.
 */
export interface ColourGroup {
  /** The key into `brand.colour.groups`. */
  readonly id: keyof Catalogue['brand']['colour']['groups'];
  /** Token names without the `--color-` prefix, in ramp order. Identifiers, not copy. */
  readonly tokens: readonly string[];
}

/**
 * The palette in its four groups, as `design-system.md` §2 divides it.
 *
 * **Names only.** The values are read from `tokens.css` at render time through
 * `src/lib/tokens.ts`, so this file contains no hex - `CLAUDE.md`'s first non-negotiable -
 * and a token deleted from the stylesheet fails the build here rather than printing a
 * colour that no longer exists.
 *
 * `tests/unit/brand-inventory.spec.ts` checks these against the stylesheet in both
 * directions: a token listed here that the stylesheet does not declare, and - the one that
 * matters - a token the stylesheet declares that no group lists, which is how a colour
 * gets added to the site without ever being documented.
 */
export const COLOUR_GROUPS: readonly ColourGroup[] = [
  { id: 'ink', tokens: ['ink-950', 'ink-900', 'ink-800', 'ink-700'] },
  { id: 'text', tokens: ['white', 'mute-200', 'mute-400'] },
  {
    id: 'plum',
    tokens: [
      'plum-950',
      'plum-900',
      'plum-800',
      'plum-700',
      'plum-600',
      'plum-500',
      'plum-400',
      'plum-300',
    ],
  },
  {
    id: 'bloom',
    tokens: ['bloom-magenta', 'bloom-violet', 'bloom-cyan', 'bloom-amber', 'ground-mid'],
  },
];

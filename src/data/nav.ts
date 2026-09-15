/**
 * The site's navigation inventory - every destination the footer offers, as data.
 *
 * It is a file rather than markup for two reasons. 8.10 adds `/press` and `/brand` and
 * 8.11b may add a locale switcher, so the set is still growing and a growing set edited
 * inside a component is a set that drifts from the routes it names. And a list is
 * something a test can iterate: `tests/unit/nav-inventory.spec.ts` walks this against the
 * routes `src/pages` actually serves, in both directions.
 *
 * **The labels are not here - 8.11a moved them to `src/i18n/<locale>/ui.ts`.** What is
 * left is structure: which destinations exist, where they point, and whether they are
 * live. `id` is the join, and it is also what `Footer.astro` derives each group's DOM id
 * from. That last part is the reason `id` exists at all: the footer used to build
 * `aria-labelledby` out of the visible label, which makes the accessibility wiring a
 * function of the translation - the Spanish footer would have pointed at ids that were
 * never rendered.
 *
 * **On `live`.** 8.9a builds the footer before six of the eight routes it points at
 * exist - 8.9b brings the legal pages, 8.9c the blog, 8.9e the changelog, 8.10 press and
 * brand. The owner's choice at Gate B (2026-09-07) was that a pending entry **renders as
 * inert text rather than as a link**, so the footer's shape is complete and correct from
 * the first day and nothing ever 404s. Each later unit flips its own flag as part of its
 * own work.
 *
 * The flag is not trusted, which is the point of it. The guard asserts both directions:
 * a `live` entry whose route is missing fails, and - the one that actually matters - a
 * pending entry whose route now *exists* fails too. So building `/privacy` and forgetting
 * to turn it on is a red build rather than a link nobody notices is absent.
 */

import type { Catalogue } from '../i18n';

/**
 * The keys the catalogue actually carries labels for.
 *
 * Typed against the catalogue rather than as `string`, so **adding a destination here
 * without writing its label fails to compile** - which is the whole reason the labels
 * were allowed to leave this file.
 */
type ItemId = keyof Catalogue['ui']['footer']['items'];
type GroupId = keyof Catalogue['ui']['footer']['groups'];

/** A single footer destination. */
export interface NavItem {
  /** The key into `ui.footer.items`, and stable across locales. */
  readonly id: ItemId;
  /** Site-absolute path, no trailing slash. */
  readonly href: string;
  /**
   * Whether the route exists yet. `false` renders the label as text with no `href`.
   * Guarded in both directions - see the note above.
   */
  readonly live: boolean;
  /** The section that turns this on, for anyone reading the pending entries. */
  readonly arrives?: string;
}

/** A labelled column of destinations. */
export interface NavGroup {
  /** The key into `ui.footer.groups`, and the stem of the group's DOM id. */
  readonly id: GroupId;
  readonly items: readonly NavItem[];
}

/**
 * The footer's three groups.
 *
 * Uneven - 2/3/3 - since the owner dropped the Pricing link at Gate A. Left uneven
 * deliberately: padding a group with an invented destination to square the grid is how a
 * footer starts describing a site that does not exist.
 *
 * **`/pricing` is deliberately absent.** It was already orphaned before this section -
 * `src/pages/waitlist.astro` records it - so its omission here leaves the route
 * unreachable rather than making it so. Carried to 8.13's pre-launch sweep.
 */
export const FOOTER_GROUPS: readonly NavGroup[] = [
  {
    id: 'product',
    items: [
      { id: 'changelog', href: '/changelog', live: true },
      { id: 'waitlist', href: '/waitlist', live: true },
    ],
  },
  {
    id: 'company',
    items: [
      { id: 'blog', href: '/blog', live: true },
      { id: 'press', href: '/press', live: true },
      { id: 'brand', href: '/brand', live: true },
    ],
  },
  {
    id: 'legal',
    items: [
      { id: 'privacy', href: '/privacy', live: true },
      { id: 'terms', href: '/terms', live: true },
      { id: 'support', href: '/support', live: true },
    ],
  },
];

/**
 * Where a takedown request goes.
 *
 * `design-system.md` §7.4 requires a published takedown contact for the third-party album
 * artwork the site shows. The footer's baseline carries it on every page, which is where
 * a rights holder will look before they find `/support` - that is 8.9a's argued
 * divergence from every reference (none of the three has anything like it).
 *
 * It is the same `/support` entry as the Legal group's, and went live with it in 8.9b.
 */
export const TAKEDOWN: NavItem = { id: 'takedown', href: '/support', live: true };

/** Every item the footer renders, flattened, for the guards and for the renderer. */
export const ALL_NAV_ITEMS: readonly NavItem[] = [
  ...FOOTER_GROUPS.flatMap((group) => group.items),
  TAKEDOWN,
];

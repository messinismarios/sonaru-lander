import { expect, test } from '@playwright/test';
import { ALL_NAV_ITEMS, FOOTER_GROUPS, TAKEDOWN } from '../../src/data/nav';
import { catalogue } from '../../src/i18n';
import { ROUTES, isCameraStand, DEV_ONLY_ROUTES } from '../visual/routes';

/**
 * The footer's inventory against the routes the site actually serves - phases.md 8.9a.
 *
 * `src/data/nav.ts` carries a `live` flag per destination because 8.9a builds the footer
 * before six of its eight routes exist. A hand-maintained flag is a lie waiting to
 * happen, so it is asserted in both directions here rather than trusted.
 *
 * The second assertion is the one with teeth. Anyone can see a broken link; nobody
 * notices a link that never appeared. 8.9b, 8.9c, 8.9e and 8.10 each build a route this
 * file names, and each will only discover it forgot to switch the entry on if forgetting
 * turns the build red.
 */

/**
 * Routes that exist for development and are not part of the site's navigation.
 *
 * **The list itself moved to `src/data/routes.ts` at 8.11b** - `astro.config.mjs`'s sitemap
 * filter needed the same four names, and two copies of an inventory is how one of them goes
 * stale. `/logo` is gone from it: it folded into `/brand` at 8.10c. The lab stays, and 8.13
 * must not take it - a settled mark still needs the tool that settled it.
 */
const DEV_ONLY = [...DEV_ONLY_ROUTES, ...ROUTES.filter(isCameraStand)];

test('every live entry points at a route the site serves', () => {
  const broken = ALL_NAV_ITEMS.filter((item) => item.live && !ROUTES.includes(item.href));
  expect(broken.map((item) => item.href)).toEqual([]);
});

test('every pending entry names a route that does not exist yet', () => {
  // The direction that matters: a route built without its flag flipped is a destination
  // the footer silently declines to offer.
  const shippedButHidden = ALL_NAV_ITEMS.filter((item) => !item.live && ROUTES.includes(item.href));
  expect(
    shippedButHidden.map((item) => `${item.href} exists - set live: true in src/data/nav.ts`),
  ).toEqual([]);
});

test('every pending entry says which section turns it on', () => {
  // TAKEDOWN is the one exception: it is the Legal group's /support entry reused, and
  // that entry already carries the section.
  const groupItems = FOOTER_GROUPS.flatMap((group) => group.items);
  const unexplained = groupItems.filter((item) => !item.live && !item.arrives);
  expect(unexplained.map((item) => item.href)).toEqual([]);
});

test('no development-only route is offered in navigation', () => {
  const leaked = ALL_NAV_ITEMS.filter((item) => DEV_ONLY.includes(item.href));
  expect(leaked.map((item) => item.href)).toEqual([]);
});

test('hrefs are site-absolute and carry no trailing slash', () => {
  for (const item of ALL_NAV_ITEMS) {
    expect(item.href, `${item.id} should start with /`).toMatch(/^\//);
    expect(item.href, `${item.id} should not end with /`).not.toMatch(/.\/$/);
  }
});

test('the takedown contact points at the same page the Legal group does', () => {
  // design-system.md §7.4 wants one takedown destination, not two that can diverge.
  const support = FOOTER_GROUPS.flatMap((group) => group.items).find(
    (item) => item.id === 'support',
  );
  expect(TAKEDOWN.href).toBe(support?.href);
  expect(TAKEDOWN.live).toBe(support?.live);
});

test('the groups are the three approved at Gate A, and Pricing is in Product', () => {
  expect(FOOTER_GROUPS.map((group) => group.id)).toEqual(['product', 'company', 'legal']);
  /*
   * Dropped by the owner at 8.9a's Gate A (2026-09-07), which left /pricing orphaned; restored
   * by the owner on 2026-09-15, after SEO audit H2 found no page linked it. It sits in Product,
   * after the changelog, under the label "Pro".
   */
  const product = FOOTER_GROUPS.find((group) => group.id === 'product');
  expect(product?.items.map((item) => item.href)).toEqual(['/waitlist', '/changelog', '/pricing']);
});

/*
 * 8.11a moved the labels to `copy/en/ui.ts`, and this assertion moved with them
 * rather than being dropped. The approved words are Gate A's - the check that they are
 * still those words has to live wherever they do, or the extraction quietly deleted a
 * guard while making every test above pass on ids.
 */
test('the approved English labels survived the move to the catalogue', () => {
  const { groups, items } = catalogue('en').ui.footer;
  expect([groups.product, groups.company, groups.legal]).toEqual(['Product', 'Company', 'Legal']);
  expect(items.support).toBe('Support');
  expect(items.takedown).toBe('Request a takedown');
  // Every destination has a label, and every label belongs to a destination.
  expect(Object.keys(items).sort()).toEqual([...ALL_NAV_ITEMS.map((i) => i.id)].sort());
});

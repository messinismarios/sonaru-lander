/**
 * Which routes are the site and which are tools - phases.md 8.11b.
 *
 * **This list lived in `tests/` until 8.11b and had to move.** `astro.config.mjs`'s
 * sitemap filter needs it, and a config cannot import from a test directory; the
 * alternative was a second copy of the inventory inside the config, which is the exact
 * shape of the narrowing `tests/visual/routes.ts`'s header was written about - 8.13's task
 * even says so in as many words: *use the predicate rather than naming them*. So the
 * inventory is here, in `src/`, and the tests read it.
 *
 * Nothing in here may import anything only a bundler can resolve: `astro.config.mjs` loads
 * it before Astro exists, and the guards load it under plain Node.
 */

/**
 * Routes that exist for development and are not part of the site.
 *
 * They are absent from the footer, absent from the sitemap, and **absent from `/es/`** -
 * a tool 8.13 deletes does not get translated. `/logo/lab` is the one 8.13 keeps: a
 * settled mark still needs the tool that settled it.
 */
export const DEV_ONLY_ROUTES: readonly string[] = ['/kit', '/specimen', '/logo/lab', '/blog/lab'];

/**
 * Is this route a camera stand rather than a page?
 *
 * A camera stand renders one composition and **no `Base`** - no header, no footer, no skip
 * link - because whatever is in the document ends up in the photograph. So every guard
 * that asserts the site's chrome has to skip them, and `tests/e2e/reduced-motion.spec.ts`
 * most of all: it would be asserting a reduced-motion variant on a page that is never
 * navigated to.
 *
 * **This exists because four guards each tested `startsWith('/blog/og/')` separately.**
 * That was true while the only stands were the blog's. 8.10a added `/og/site`, and each of
 * those four would have quietly stopped covering what it was written to cover - the exact
 * failure one directory later. The predicate is the fix: a stand added anywhere is a stand
 * every guard already knows about.
 */
export function isCameraStand(route: string): boolean {
  return route.startsWith('/blog/og/') || route.startsWith('/og/');
}

/**
 * Does this route ship - is it part of the site a visitor is meant to reach?
 *
 * The single predicate behind three separate things that must agree: which routes get a
 * Spanish twin, which appear in a sitemap, and which the footer may point at. They agreed
 * by coincidence before this unit, each deriving its own answer.
 */
export function isShippingRoute(route: string): boolean {
  return !DEV_ONLY_ROUTES.includes(route) && !isCameraStand(route);
}

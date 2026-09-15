/**
 * Whether a post is live yet - the rule behind scheduled posts.
 *
 * A post with a future `publishedAt` is written and committed ahead of time and stays off the
 * built site until a build runs after that instant. `.github/workflows/scheduled-rebuild.yml`
 * is what runs that build, once a day, so nobody has to push on publishing day.
 *
 * **The dev server shows scheduled posts; the build does not.** Previewing a post before its
 * day is the reason to write it early, and `npm run og` reads the post list from the running
 * dev server - so a scheduled post gets its committed cover when it is written, not on the
 * day it goes live, when there would be nobody there to run the generator.
 *
 * Compared as instants rather than strings: `Date#toISOString` carries milliseconds, and
 * `…09:00:00.000Z` sorts before `…09:00:00Z` lexicographically, which would hold a post back
 * for the whole second it was due.
 *
 * Kept free of `astro:content` so `tests/unit/blog-inventory.spec.ts` can import it.
 */
export function isLive(publishedAt: string, now: Date, dev: boolean): boolean {
  return dev || Date.parse(publishedAt) <= now.getTime();
}

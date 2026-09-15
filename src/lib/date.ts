/**
 * The site's one date format.
 *
 * It lived in `lib/posts.ts` until 8.9e, which was fine while the blog was the only thing
 * that printed a date. The changelog prints one too, and a changelog importing its date
 * format from a module called `posts` is exactly the drift this codebase keeps writing
 * guards against - so the function moved out and both callers reach the same one.
 *
 * **`Document.astro` still formats its own `effective` date inline.** It emits a
 * byte-identical string, and that layout is frozen behind 8.9b's Gate C: there is no
 * user-visible gain in touching it, so it is left alone and named here instead.
 */

/**
 * `8 September 2026`.
 *
 * Takes a full instant and renders only the day. The time in a `publishedAt` orders the
 * blog index (8.9d's Gate A); showing it would be product chrome. UTC, so the day a
 * reader sees does not depend on where they are reading from.
 */
export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

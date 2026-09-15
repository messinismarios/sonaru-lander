/**
 * A release version as a URL fragment - phases.md 8.9e.
 *
 * Its own module for the reason `reading-time.ts` is one: `lib/releases.ts` imports
 * `astro:content`, which only resolves inside Astro's module graph, so a unit guard that
 * wanted this function through that module would have to boot Astro to check a string.
 */

/**
 * `1.0` → `v1-0`.
 *
 * A dot is legal in a fragment and is the class delimiter in a CSS selector, so `#v1.0`
 * would have to be escaped by every caller that ever queried it. The `v` prefix keeps the
 * id from starting with a digit, which older selector engines reject outright.
 */
export function versionAnchor(version: string): string {
  return `v${version.replace(/\./g, '-')}`;
}

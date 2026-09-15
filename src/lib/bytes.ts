/**
 * A file's size, the way a download should state it.
 *
 * Written at 8.10b for `/press` as a local function, and lifted here at 8.10d when
 * `/brand` became the second page to offer a file. Two copies of a rounding rule is two
 * pages that can start disagreeing about how big the same download is.
 *
 * The bytes always come from the manifest the generator wrote - never from a hand-typed
 * "~1 MB", which is right until the day it is not and fails nothing when it stops being
 * true.
 */
export function fileWeight(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  /* The mark's SVG is 385 bytes. Rounded to kilobytes it reads `0 KB`, which looks like a
   * broken download rather than a small one. */
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

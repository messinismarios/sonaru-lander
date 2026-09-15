/**
 * Reading time, derived from the post rather than authored beside it.
 *
 * gsap.com prints `3 min read` on every card and article; superlist.com prints none. The
 * owner took gsap's half of that at Gate A, and the one thing worth being careful about
 * is where the number comes from: a frontmatter field is a number someone types once and
 * never corrects, which is the same failure mode `--measure`'s `68ch` origin had.
 *
 * 200 words per minute is the conventional figure and is not a measurement of anyone.
 * It is stated here so nobody later reads the constant as research.
 */
const WORDS_PER_MINUTE = 200;

/**
 * Words in a post body, with the parts nobody reads aloud removed first.
 *
 * Code fences, inline code, image syntax, link URLs and HTML tags are stripped, because
 * counting them makes a post with three code blocks read as twice its length. What
 * remains is prose.
 */
export function countWords(markdown: string): number {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}[-*+#>]\s+/gm, ' ');
  const words = prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words === null ? 0 : words.length;
}

/** Whole minutes, rounded up, never zero - a one-word post still takes a moment. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(countWords(markdown) / WORDS_PER_MINUTE));
}

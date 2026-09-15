/**
 * The blog's tag inventory - every tag a post may carry, as data.
 *
 * A file rather than a free-text frontmatter field, for three reasons that all showed up
 * before a line of the blog was written.
 *
 * **A free-text tag is how you end up with `Engineering` and `engineering`** as two tags
 * that render as two chips and route to two pages. The collection schema builds its enum
 * from this list, so an unknown tag is a red build rather than a duplicate nobody notices.
 *
 * **The route guard needs it.** `tests/visual/routes.ts` discovers routes from `src/pages`
 * and expands the dynamic ones from the collection that fills them. `/blog/tags/[tag]` is
 * not filled by a collection - it is filled by the *values inside* one - and the
 * alternative was parsing frontmatter with a regex inside a test helper. Importing a real
 * module is not the same kind of thing.
 *
 * **The labels and blurbs are not here - 8.11a moved them to `src/i18n/<locale>/ui.ts`.**
 * What made that possible was moving the *schema* off them too: a post's frontmatter now
 * names its tags by `slug`, not by the English label it used to spell out. A label that
 * doubles as a key is a label that cannot be translated without invalidating every post
 * that used it, which is the shape of problem this whole unit exists to remove.
 *
 * **And each tag owns a palette.** Gate B, 2026-09-08: a post's generated cover wears its
 * tag's act colours, which is what keeps three generated covers from reading as three
 * prints of one template. The acts are the ones already in `tokens.css` - nothing new is
 * declared here, and nothing here is a colour.
 */

/** The bloom palettes `BloomField` already ships. Kept in sync by `Tag['act']` below. */
export type Act = 'hero' | 'problem' | 'feed' | 'notify' | 'cta';

import type { Catalogue } from '../i18n';

/**
 * The slugs the catalogue carries a label and a blurb for. Typed against it rather than
 * as `string`, so adding a tag without writing its words fails to compile.
 */
type TagSlug = keyof Catalogue['ui']['blog']['tags'];

export interface Tag {
  /** The URL segment, the frontmatter value, and the key into `ui.blog.tags`. */
  readonly slug: TagSlug;
  /** Which act's bloom the covers of this tag's posts wear. */
  readonly act: Act;
}

/**
 * Three tags, deliberately.
 *
 * The owner chose real tag routes at Gate A knowing that three tags across three posts
 * gives three pages holding one post each on launch day. What makes that defensible is
 * that the tags describe *this* blog's subjects rather than a taxonomy invented to look
 * populated - every one of them names something 8.9d is actually writing about.
 */
export const TAGS: readonly Tag[] = [
  { slug: 'product', act: 'feed' },
  { slug: 'engineering', act: 'notify' },
  { slug: 'craft', act: 'hero' },
];

/** The slugs, for the collection schema's enum. What a post's frontmatter must say. */
export const TAG_SLUGS = TAGS.map((tag) => tag.slug) as [string, ...string[]];

export function tagBySlug(slug: string): Tag | undefined {
  return TAGS.find((tag) => tag.slug === slug);
}

/**
 * As `tagBySlug`, but for callers the schema has already validated. Throws rather than
 * returning `undefined` so that a caller reaching this module by some other path fails
 * loudly instead of rendering a post with no tag.
 */
export function requireTag(slug: string): Tag {
  const found = tagBySlug(slug);
  if (found === undefined) {
    throw new Error(`Unknown tag "${slug}" - add it to src/data/tags.ts or fix the post.`);
  }
  return found;
}

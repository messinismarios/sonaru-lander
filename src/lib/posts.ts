/**
 * What the blog considers published, in one place.
 *
 * The index, the three tag pages and the RSS feed each need "the posts, newest first,
 * without the drafts", and three independent `getCollection` calls with three filters is
 * three chances for them to disagree - the way a draft ends up in a feed but not on the
 * page that links to it.
 *
 * It also computes reading time, so no consumer has to remember that the number comes
 * from the body rather than the frontmatter.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { isLive } from './published';
import { readingMinutes } from './reading-time';
import { requireTag, type Tag } from '../data/tags';

export interface Post {
  readonly entry: CollectionEntry<'blog'>;
  readonly slug: string;
  readonly href: string;
  readonly minutes: number;
  /** Resolved from `src/data/tags.ts`, so a consumer never re-looks-up a slug. */
  readonly tags: readonly Tag[];
  /** The first tag, which is the one whose palette the cover wears. */
  readonly primaryTag: Tag;
}

function toPost(entry: CollectionEntry<'blog'>): Post {
  const tags = entry.data.tags.map(requireTag);
  const primaryTag = tags[0];
  if (primaryTag === undefined) {
    // Unreachable: the schema requires at least one tag. Here so the type is honest
    // rather than asserted away.
    throw new Error(`Post "${entry.id}" has no tags, which the schema should have caught.`);
  }
  return {
    entry,
    slug: entry.id,
    href: `/blog/${entry.id}`,
    minutes: readingMinutes(entry.body ?? ''),
    tags,
    primaryTag,
  };
}

/**
 * Published posts, newest first.
 *
 * **Drafts are excluded everywhere, including from the router**, which is what makes
 * `draft: true` mean "does not exist on the site" rather than "is not linked from the
 * index". A draft with a guessable URL is a published post nobody proof-read.
 *
 * **A scheduled post is excluded the same way until its `publishedAt` has passed** - see
 * `isLive`, which also explains why the dev server shows it early.
 */
export async function publishedPosts(): Promise<readonly Post[]> {
  const now = new Date();
  const entries = await getCollection(
    'blog',
    ({ data }) => data.draft === false && isLive(data.publishedAt, now, import.meta.env.DEV),
  );
  return entries
    .map(toPost)
    .sort((a, b) => b.entry.data.publishedAt.localeCompare(a.entry.data.publishedAt));
}

/** The published posts carrying a given tag, newest first. */
export async function postsForTag(slug: string): Promise<readonly Post[]> {
  const posts = await publishedPosts();
  return posts.filter((post) => post.tags.some((tag) => tag.slug === slug));
}

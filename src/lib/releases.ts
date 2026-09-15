/**
 * What the changelog considers a release, in one place - phases.md 8.9e.
 *
 * The same shape as `lib/posts.ts`, for the same reason: the page that renders the notes
 * and anything that later consumes them (8.11's locales, a feed if one is ever wanted)
 * must agree on what is published and in what order, and two `getCollection` calls with
 * two sorts is two chances for them to disagree.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { versionAnchor } from './version';

export interface Release {
  readonly entry: CollectionEntry<'changelog'>;
  readonly version: string;
  /** The `id` its heading carries, and the fragment that links to it. */
  readonly anchor: string;
  /** `undefined` until the release actually ships - see the schema. */
  readonly releasedAt: string | undefined;
}

/**
 * The releases, newest first.
 *
 * **An undated entry sorts to the top**, because the only entry that can lack a date is
 * the one that has not shipped yet - which is the newest by definition. The unit guard
 * enforces that reading rather than leaving it as an assumption this sort quietly makes.
 */
export async function releases(): Promise<readonly Release[]> {
  const entries = await getCollection('changelog');
  return entries
    .map((entry) => ({
      entry,
      version: entry.data.version,
      anchor: versionAnchor(entry.data.version),
      releasedAt: entry.data.releasedAt,
    }))
    .sort((a, b) => {
      // Spelled out rather than done with a sentinel string: the obvious trick is to
      // substitute a high code point for the missing date and compare, and `localeCompare`
      // gives no guarantee about where an unassigned character sorts.
      if (a.releasedAt === undefined) return -1;
      if (b.releasedAt === undefined) return 1;
      return b.releasedAt.localeCompare(a.releasedAt);
    });
}

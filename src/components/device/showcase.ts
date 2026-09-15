import { getCollection } from 'astro:content';

/**
 * Which showcase releases each act shows, and the single place those choices are made.
 *
 * Four components read this and none of them calls `getCollection` itself, which is the
 * point: the number of releases on screen in act one, the scroll `Feed.astro` allocates to
 * them, the release act three announces and the row act four files were otherwise four
 * independent facts that happened to agree - and would stop agreeing the moment any one of
 * them changed. They did stop agreeing, on 2026-09-11, when real release dates replaced
 * staged ones and reordered three acts at once.
 */

/**
 * How many releases the phone's feed shows.
 *
 * **Three** (owner, 2026-09-03, raised from two - Gate C rev 6 originally). Raising it is a
 * scroll-budget change in `Feed.astro` as much as a manifest one, so it is a design
 * decision rather than a number to tune.
 */
const FEED_LIMIT = 3;

/** Newest first. The manifest's own order is insertion order and means nothing. */
function newestFirst<T extends { data: { releaseDate: string } }>(releases: T[]): T[] {
  return [...releases].sort((a, b) => b.data.releaseDate.localeCompare(a.data.releaseDate));
}

/**
 * Every showcase release, newest first.
 *
 * Sorted explicitly. `getCollection` returns entries keyed by id, not in the order the
 * manifest lists them - which had the feed running in alphabetical order by slug. On any
 * other site that would be a cosmetic bug. Here it contradicts the product: strict
 * reverse-chronological order, with nothing reordered and nothing hidden, is the one claim
 * Sonaru makes against every algorithmic release feed (`mission.md` §6.2). A mockup that
 * quietly sorts by something else is showing the thing we say we do not do.
 */
export async function getShowcaseReleases() {
  return newestFirst(await getCollection('showcase'));
}

/**
 * The release act three's notification announces and act four's playlist receives.
 *
 * **Named in the manifest, not derived from the dates** (owner, 2026-09-11). It used to be
 * `showcase[0]`, which was the same thing while the dates were staged: the release the back
 * half of the page is about was simply set to be the newest. Real release dates broke that
 * - the newest is now whichever of these albums happened to come out last - and the owner's
 * instruction was that only act one follows the dates while the notification and the
 * playlist keep the release they had. So the choice is a flag on the entry, and the dates
 * are free to be nothing but true.
 *
 * @throws if the manifest does not carry exactly one. Zod validates entries one at a time
 *   and cannot see across them, so this is where "exactly one" is a real constraint rather
 *   than a convention - and a second flag would silently hand the notification and the
 *   playlist whichever one `getCollection` returned first.
 */
export async function getAnnouncedRelease() {
  const announced = (await getCollection('showcase')).filter((release) => release.data.announced);

  if (announced.length !== 1 || announced[0] === undefined) {
    throw new Error(
      `showcase: exactly one release must be marked "announced"; found ${announced.length}`,
    );
  }

  return announced[0];
}

/**
 * The three releases act one's phone shows, newest first.
 *
 * **The announced release, plus the newest others, sorted by date** - which is the owner's
 * two instructions of 2026-09-11 held together rather than a clever rule. Act one is
 * ordered by release date; the notification and the playlist keep `ICYMI`, which is not the
 * newest. If the feed were the plain top three by date, the release the next two acts are
 * entirely about would never appear on the phone at all, and the page's spine - missed,
 * listed, announced, filed, one release end to end - would be broken in the one act that
 * shows the product working.
 *
 * So the announced release is always in frame, and the rest of the feed is the newest
 * releases there is room for. What a visitor sees is still strictly reverse-chronological,
 * because the sort is applied last: the selection decides *which* releases, never their
 * order, and no visitor can tell this from a plain chronological feed of three.
 */
export async function getFeedReleases() {
  const announced = await getAnnouncedRelease();
  const others = newestFirst(await getCollection('showcase')).filter(
    (release) => release.id !== announced.id,
  );

  return newestFirst([announced, ...others.slice(0, FEED_LIMIT - 1)]);
}

/**
 * Every artist the site names, ordered by id.
 *
 * **Sorted, and by id rather than by the order `artists.json` lists them in.** There is
 * nothing chronological here to sort by, and the temptation is to take the manifest's own
 * order - but `getCollection` does not preserve it, exactly as this module's release sort
 * has warned since 8.4. That is not theoretical: adding four artists to the manifest on
 * 2026-09-11 silently reshuffled act one's field, because `Problem.astro` maps this list
 * onto eight fixed positions and so the order *is* where each artist stands. The field's
 * arrangement is frozen behind act one's Gate C, and it moved without one line of that
 * section changing.
 *
 * Sorting by id gives a fixed arrangement that only changes when an artist is added or
 * renamed, and `artists.json` is written in the same order so the file still reads as the
 * layout. **Do not return this collection unsorted**, and do not sort it by name - a
 * display string is not an identity, and `NewJeans` sorting differently from `newjeans`
 * would move chips on a copy edit.
 *
 * Uncapped, and entries whose `photo` is `null` are included: `ReleaseCard.astro` looks its
 * own artist up regardless and shows a blank disc when there is no photograph yet.
 */
export async function getShowcaseArtists() {
  return (await getCollection('artists')).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The artists act one's field shows, in the order they take its fixed positions.
 *
 * **Membership is the `field` flag, not "everyone with a photograph"** - see the schema.
 * The order is still `getShowcaseArtists`'s, so which chip stands where is stable and
 * changes only when this set does.
 *
 * @param places how many positions the field has, from `Problem.astro`'s own layout.
 * @throws if the manifest marks a different number, or marks an artist with no photograph.
 *   Both are silent bugs otherwise: a short list leaves a hole in a composition nobody is
 *   looking at while they edit a manifest, and a chip is a face and a name.
 */
export async function getFieldArtists(places: number) {
  const field = (await getShowcaseArtists()).filter((artist) => artist.data.field);

  if (field.length !== places) {
    throw new Error(
      `showcase: act one has ${places} chip positions but ${field.length} artists are marked "field"`,
    );
  }

  const faceless = field.find((artist) => artist.data.photo === null);
  if (faceless) {
    throw new Error(`showcase: artist "${faceless.id}" is in act one's field but has no photo`);
  }

  return field;
}

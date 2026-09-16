/**
 * Content collections.
 *
 * `showcase` is the artwork manifest `design-system.md` §7 requires: every album cover the
 * site shows is named here and nowhere else, so the whole set - including a swap to
 * original art if a rights holder objects - is a change to one file. The Zod schema is
 * what makes that guarantee real: a malformed or half-filled entry fails the build rather
 * than rendering an empty device screen.
 *
 * See `src/content/showcase/README.md` for how to supply covers.
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';
import { TAG_SLUGS } from './data/tags';

const showcase = defineCollection({
  loader: file('src/content/showcase/releases.json'),
  schema: z.object({
    /** Display name of the artist. Rendered beside the cover - §7's attribution rule. */
    artist: z.string().min(1),
    /**
     * The `artists.json` entry this release's artist is, so the card's chip can show their
     * photograph instead of a blank disc. A name would have worked and is the wrong key:
     * `artist` is display text that a rename or a typo silently breaks, and a broken link
     * here is a blank avatar nobody notices. This one is checked at build.
     */
    artistId: z.string().min(1),
    /** Release title. Also rendered beside the cover. */
    title: z.string().min(1),
    /** Mirrors the app's `Release.Kind`, which drives the card's header label. */
    kind: z.enum(['single', 'ep', 'album']),
    releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
    /**
     * Seconds - the number the card's scrub bar counts up to and the playlist row prints.
     * A single's track length; a multi-track release's total runtime, since there is no
     * one track to name. See the collection's README.
     */
    duration: z.number().int().positive(),
    trackCount: z.number().int().positive(),
    /** Filename within `src/assets/showcase/releases/`. */
    artwork: z.string().min(1),
    /**
     * The ground colour this release tints the screen to, derived from the artwork by
     * `npm run showcase`. Generated, never hand-set - see the collection's README for why
     * this is the one hex literal allowed outside `tokens.css`.
     */
    tint: z.string().regex(/^#[0-9a-f]{6}$/, 'expected a lowercase 6-digit hex'),
    /**
     * Whether this is the release act three's notification announces and act four's
     * playlist receives. Exactly one entry carries it, enforced in `showcase.ts`.
     *
     * **A flag rather than "the newest one"** (owner, 2026-09-11). It was the newest for as
     * long as the manifest's dates were staged; with real release dates the newest is
     * whichever album happens to have come out last, and the release the page's back half
     * is *about* is a composition choice. Deriving it from the dates meant editing a date
     * to change the story, which is the one edit this manifest must not invite.
     */
    announced: z.boolean().default(false),
    /** Rights holder, where one should be named beyond the artist. */
    credit: z.string().nullable(),
  }),
});

/**
 * The artists act one's field shows - the people a visitor follows, whose releases go past
 * unseen.
 *
 * A second manifest rather than more fields on `showcase`, because an artist and a release
 * are not the same fact here: the chips name **eight artists**, the feed and the playlist
 * show **five releases**, and only one artist appears in both lists. Folding them together
 * would have made every chip need a release it does not have.
 *
 * The one-file guarantee `design-system.md` §7 requires holds the same way it does for the
 * covers: every artist photograph the site shows is named here and nowhere else, so
 * removing one on request is deleting an entry and its file.
 */
const artists = defineCollection({
  loader: file('src/content/showcase/artists.json'),
  schema: z.object({
    /** Display name. Rendered beside the photograph - §7's attribution rule. */
    name: z.string().min(1),
    /**
     * Filename within `src/assets/showcase/artists/`, or `null` for an artist the site
     * names but has no photograph for yet.
     *
     * Nullable because the two jobs this collection does have different needs: a release
     * card wants *its own* artist and falls back to a blank disc without one, while act
     * one's field wants eight photographs and simply skips an entry that has none. An
     * artist can therefore be added the moment a release needs them and get a face later,
     * which is better than a build that fails until someone finds a picture.
     */
    photo: z.string().min(1).nullable(),
    /**
     * Whether this artist is one of the eight in act one's field.
     *
     * **An explicit choice, not "whoever has a photograph"** (2026-09-11). The field was
     * briefly the first eight photographed artists in id order, and the day four release
     * artists gained photographs it silently swapped three of act one's chips for three
     * alphabetically earlier names - a composition frozen behind that section's Gate C,
     * changed by adding a file. Membership of a fixed eight-place layout has to be stated.
     *
     * An entry can be in the field, or on a release card, or both: `billie-eilish` is the
     * one that currently is. `showcase.ts` checks the count against the layout.
     */
    field: z.boolean().default(false),
    /** Rights holder, where one should be named beyond the artist. */
    credit: z.string().nullable(),
  }),
});

/**
 * The site's long-form documents - phases.md 8.9b.
 *
 * A collection rather than three `.astro` pages, decided at that section's Gate A: 8.9c
 * adds MDX rendering and 8.11 adds locales *on top of* this, where hand-authored pages
 * would each be a migration. `/support` is not a legal document and is in here anyway,
 * because what the collection actually holds is one *document type* - a title, a lede,
 * and prose in one column - and splitting it by subject would give the site two layouts
 * that have to be kept identical by hand.
 *
 * **These three are canonical as of 2026-09-07** (owner, Gate A option A). The privacy
 * policy and terms were previously served by the backend at `api.sonaru.app/api/legal/*`
 * and filed with App Store Connect from there; those routes now redirect here, and the
 * iOS app links here. There is one copy of each document and this is it.
 */
const legal = defineCollection({
  loader: glob({ base: 'src/content/legal', pattern: '**/*.md' }),
  schema: z.object({
    /** The page's `h1`, and the `<title>` it is built from. */
    title: z.string().min(1),
    /** The eyebrow above the `h1` - `SectionHeader`'s label treatment. */
    eyebrow: z.string().min(1),
    /**
     * The plain-language paragraph before the clauses start, at `--text-lg`.
     * superlist sets one too; ours is required rather than optional, because a document
     * that cannot be summarised in a sentence is a document nobody reads.
     */
    lede: z.string().min(1),
    /**
     * Effective date, `YYYY-MM-DD`. Optional, and the reason the schema is shaped this
     * way: `/support` is not a document that takes effect, and giving it a date would be
     * inventing a legal character it does not have.
     */
    effective: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
      .optional(),
    /** Stable order, so tests and any future index iterate deterministically. */
    order: z.number().int().nonnegative(),
  }),
});

/**
 * The blog - phases.md 8.9c.
 *
 * The glob takes `.md` **and** `.mdx` from the first day, and both are real: MDX is
 * installed (owner, Gate B), because "how this site was built" is one of the three seed
 * posts and is exactly the post that will want to embed a live `BloomField` rather than
 * describe one.
 *
 * The pattern is `**` rather than `*` so 8.11 can put `es/` beside the English posts
 * without this line changing and without three files moving. That is the whole extent of
 * the locale work done here: there is no locale field, no switcher and no per-post
 * hreflang, because building those before 8.11 knows what it wants is speculation.
 */
const blog = defineCollection({
  loader: glob({ base: 'src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    /** The post's `h1`, and the headline in its `BlogPosting` JSON-LD. */
    title: z.string().min(1),
    /**
     * The `<title>` and share-card title, when the `h1` is not what people search for - SEO
     * audit M6. Optional: without it the title is the `h1` with the site name after it.
     */
    metaTitle: z.string().min(1).optional(),
    /**
     * The line the generated cover carries - **not** the title.
     *
     * The owner's amendment at Gate A, and the thing that makes the card work: as first
     * built, the cover repeated the title within 40px of itself. Deleting the repetition
     * would have turned the card into a picture with an excerpt, so the cover says
     * something sharper instead and the title says what the post is.
     *
     * It is the only place that line exists, which is why the cover's `alt` is the hook
     * rather than empty: an empty alt would drop content that is nowhere else on the page.
     */
    hook: z.string().min(1),
    /** `<meta name="description">` and the feed's item description. */
    description: z.string().min(1),
    /**
     * The paragraph before the post starts, at `--text-lg`. One string with three uses -
     * the article's lede, the index card's excerpt, and the RSS item's summary - so the
     * three cannot drift into three slightly different promises about the same post.
     */
    lede: z.string().min(1),
    /**
     * Publication instant, `YYYY-MM-DDTHH:MM:SSZ`. Sorts the index and the feed.
     *
     * **A time, not a date, and that is the owner's call at 8.9d's Gate A**: all three
     * seed posts are dated the same day, so a date alone leaves the sort key tied and the
     * order falls back to whatever the loader happened to return - a silently unstable
     * index. Sorting is a lexicographic compare, which is only meaningful because this
     * regex admits one format: UTC, seconds, `Z`. An offset like `+02:00` would sort
     * before a `Z` instant it actually follows.
     *
     * The reader is never shown the time. `dateLabel` renders the day; the instant exists
     * for ordering and for the machines that read `datetime`, `datePublished` and
     * `pubDate`.
     */
    publishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'expected YYYY-MM-DDTHH:MM:SSZ'),
    /**
     * Validated against `src/data/tags.ts` rather than accepted as free text, so
     * `Engineering` and `engineering` cannot become two tags with two routes.
     *
     * **Slugs, not labels, since 8.11a.** The label is presentation and now lives in the
     * locale catalogue; the slug is the identity. A post written before that says
     * `['Product']` and fails validation until it says `['product']`, which is the
     * intended failure - the alternative is frontmatter whose meaning depends on which
     * language the site was in when it was written.
     */
    tags: z.array(z.enum(TAG_SLUGS)).min(1),
    /** A draft is absent from the index, the feed, every tag page, and the router. */
    draft: z.boolean().default(false),
  }),
});

/**
 * The changelog - phases.md 8.9e.
 *
 * A collection rather than a hand-authored page for the reason 8.9b gave for the legal
 * documents: 8.11 adds locales *on top of* this, where a `.astro` page would be a
 * migration. The pattern takes `**` so `es/` can sit beside the English notes without this
 * line changing.
 *
 * `.md` only, and deliberately. The blog takes `.mdx` because one of its posts embeds a
 * live `BloomField`; a release note that wants a component is a release note that wants to
 * be a blog post, and 8.9c's motion budget for these routes is asserted rather than
 * promised.
 */
const changelog = defineCollection({
  loader: glob({ base: 'src/content/changelog', pattern: '**/*.md' }),
  schema: z.object({
    /**
     * The release this note describes - `1.0`, `1.1`, `1.1.2`.
     *
     * It is the entry's permalink (`/changelog#v1-0`) and appears in the meta line, but it
     * is **not** the entry's title. That is gsap's model, which is right for a library
     * whose product *is* a version number and wrong for an app: superlist titles a release
     * by what shipped, and Gate A took that.
     */
    version: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'expected a version like 1.0 or 1.1.2'),
    /** What shipped, as a sentence. The entry's `h2`. */
    title: z.string().min(1),
    /**
     * Release instant, `YYYY-MM-DDTHH:MM:SSZ`. Sorts the page. Same format and same
     * reasoning as the blog's `publishedAt` - UTC only, because an offset would sort
     * before a `Z` instant it actually follows.
     *
     * **Optional, and that is the whole of 8.9e's honesty problem.** Sonaru has never
     * shipped: there is no git tag, no App Store record and no TestFlight build, so 1.0
     * has no release date to write and writing today's would be the fabrication Gate A
     * rejected - the same ground on which 8.9a refused superlist's `version 1.57.0`
     * footer line and 8.8 refused a plausible App Store id. An entry without one renders
     * `Not yet released`, which is true now and becomes a date the day it ships.
     *
     * `tests/unit/changelog-inventory.spec.ts` allows **at most one** undated entry and
     * requires it to be the newest, since only the unreleased head can be undated. 8.13
     * fills it in.
     */
    releasedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'expected YYYY-MM-DDTHH:MM:SSZ')
      .optional(),
  }),
});

export const collections = { showcase, artists, legal, blog, changelog };

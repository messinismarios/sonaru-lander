import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TAGS } from '../../src/data/tags';
import { catalogue } from '../../src/i18n';

const CLAIM = catalogue('en').home.claim;
import { ROUTES } from '../visual/routes';
import { countWords, readingMinutes } from '../../src/lib/reading-time';
import { isLive } from '../../src/lib/published';

/**
 * The blog's data, checked without a browser - phases.md 8.9c.
 *
 * These are the assertions that catch a mistake nobody can see. A tag whose page does not
 * exist, a cover that no longer matches the hook it was generated from, and a `hook` that
 * has quietly become a copy of the title are all invisible on the page and wrong in the
 * places the page is not: a link in a meta line, somebody else's timeline, and the card
 * that Gate A's amendment exists to fix.
 */

const CONTENT = new URL('../../src/content/blog/', import.meta.url);
const OG = new URL('../../public/og/', import.meta.url);

interface Post {
  readonly slug: string;
  readonly frontmatter: string;
  readonly body: string;
}

/**
 * The posts, read as files rather than through `astro:content`.
 *
 * The collection only resolves inside Astro's module graph, and a unit test that had to
 * boot Astro to read three files would be a slower test that fails for more reasons. The
 * frontmatter is matched with a regex per field rather than parsed as YAML, which is
 * enough for the questions below and adds no dependency.
 */
function posts(): Post[] {
  return readdirSync(CONTENT)
    .filter((name) => /\.mdx?$/.test(name))
    .map((name) => {
      const raw = readFileSync(new URL(name, CONTENT), 'utf8');
      const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
      if (match === null) throw new Error(`${name} has no frontmatter block`);
      return { slug: name.replace(/\.mdx?$/, ''), frontmatter: match[1]!, body: match[2]! };
    });
}

function field(frontmatter: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*'((?:[^']|'')*)'\\s*$`, 'm').exec(frontmatter);
  if (match === null) throw new Error(`missing or unquoted frontmatter field: ${key}`);
  return match[1]!.replace(/''/g, "'");
}

test('every post has a hook that is not its title', () => {
  // The owner's amendment at Gate A. A hook that drifts back into being the title puts
  // the same sentence on the card twice, which is the exact thing it was added to fix -
  // and nothing else in the build would notice.
  const same = posts().filter(
    (post) => field(post.frontmatter, 'hook') === field(post.frontmatter, 'title'),
  );
  expect(same.map((post) => post.slug)).toEqual([]);
});

test('no two posts share a publication instant', () => {
  /*
   * The guard the owner's 8.9d Gate A answer requires. All three seed posts are dated the
   * same day - "backdate all to today" - so the *time* is the entire sort key, and two
   * posts sharing one leaves `localeCompare` returning 0 and the index ordered by whatever
   * the content loader happened to return. That reorders the blog silently: no error, no
   * failing assertion anywhere else, just a different post at the top on some builds.
   *
   * `tests/e2e/blog.spec.ts` pins the resulting order; this pins the thing that makes an
   * order exist at all.
   */
  const instants = posts().map((post) => field(post.frontmatter, 'publishedAt'));
  const duplicates = instants.filter((instant, index) => instants.indexOf(instant) !== index);
  expect([...new Set(duplicates)]).toEqual([]);
});

test('every tag has a route, and every route has a tag', () => {
  const expected = TAGS.map((tag) => `/blog/tags/${tag.slug}`).sort();
  const actual = ROUTES.filter((route) => route.startsWith('/blog/tags/')).sort();
  expect(actual).toEqual(expected);
});

test('every tag a post carries exists in the inventory', () => {
  // The schema's `z.enum` already enforces this at build time. Asserted again because the
  // enum is built from this file, so a tag deleted from `tags.ts` widens nothing and
  // narrows silently - the post would fail to build, and this says why.
  const slugs = new Set<string>(TAGS.map((tag) => tag.slug));
  const unknown: string[] = [];
  for (const post of posts()) {
    const line = /^tags:\s*\[(.*)\]\s*$/m.exec(post.frontmatter);
    expect(line, `${post.slug} has no tags line`).not.toBeNull();
    for (const raw of line![1]!.split(',')) {
      const slug = raw.trim().replace(/^'|'$/g, '');
      if (!slugs.has(slug)) unknown.push(`${post.slug}: ${slug}`);
    }
  }
  expect(unknown).toEqual([]);
});

test('every published post has both covers and a manifest entry that still matches', () => {
  // The staleness guard. `npm run og` records a hash of what each cover was generated
  // from; editing a hook without re-running it makes the committed picture a lie in the
  // one place nobody looks, which is a link preview. Same discipline as mark-geometry.ts.
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', OG), 'utf8')) as Record<
    string,
    string
  >;
  const files = new Set(readdirSync(OG));
  const acts = new Map<string, string>(TAGS.map((tag) => [tag.slug, tag.act]));

  const problems: string[] = [];
  for (const post of posts()) {
    if (/^draft:\s*true\s*$/m.test(post.frontmatter)) continue;
    const hook = field(post.frontmatter, 'hook');
    const firstTag = /^tags:\s*\['([^']+)'/m.exec(post.frontmatter)?.[1] ?? '';
    const act = acts.get(firstTag) ?? '';
    const expected = createHash('sha256').update(`${hook} ${act}`).digest('hex').slice(0, 16);

    if (!files.has(`${post.slug}.jpg`)) problems.push(`${post.slug}.jpg missing`);
    if (!files.has(`${post.slug}-640.jpg`)) problems.push(`${post.slug}-640.jpg missing`);
    if (manifest[post.slug] !== expected) {
      problems.push(`${post.slug} cover is stale - run \`npm run og\``);
    }
  }
  expect(problems).toEqual([]);
});

test('no cover survives the post it belonged to', () => {
  // `site` is the whole site's card, not a post's - 8.10a. It lives in the same directory
  // and the same manifest deliberately (one generator, one staleness guard), so it is the
  // one name this check has to know is not an orphan.
  const slugs = new Set([...posts().map((post) => post.slug), 'site']);
  const orphans = readdirSync(OG)
    .filter((file) => file.endsWith('.jpg'))
    .map((file) => file.replace(/(-640)?\.jpg$/, ''))
    .filter((slug) => !slugs.has(slug));
  expect([...new Set(orphans)]).toEqual([]);
});

test('the site card exists and still matches the claim it was generated from', () => {
  // The same staleness discipline the post covers get, for the same reason: `CLAIM` is a
  // module three things read, and editing it without re-running `npm run og` leaves the
  // picture in somebody's timeline saying what the site used to say.
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', OG), 'utf8')) as Record<
    string,
    string
  >;
  expect(readdirSync(OG)).toContain('site.jpg');

  const expected = createHash('sha256').update(`${CLAIM} hero`).digest('hex').slice(0, 16);
  expect(manifest.site, 'site card is stale - run `npm run og`').toBe(expected);
});

test('a scheduled post is built only once its instant has passed', () => {
  const now = new Date('2026-09-14T09:00:00.500Z');
  expect(isLive('2026-09-14T09:00:00Z', now, false)).toBe(true);
  expect(isLive('2026-09-14T09:00:01Z', now, false)).toBe(false);
  // The dev server previews it, which is also what lets `npm run og` give it a cover early.
  expect(isLive('2026-09-15T09:00:00Z', now, true)).toBe(true);
});

test('reading time counts prose and not code', () => {
  // A post with three code blocks reading as twice its length is the failure this guards.
  const prose = 'word '.repeat(400);
  expect(countWords(`${prose}\n\n\`\`\`sql\n${'SELECT x FROM y '.repeat(200)}\n\`\`\``)).toBe(400);
  expect(countWords('a [linked phrase](https://example.com/very/long/path) here')).toBe(4);
});

test('reading time rounds up and is never zero', () => {
  expect(readingMinutes('')).toBe(1);
  expect(readingMinutes('word')).toBe(1);
  expect(readingMinutes('word '.repeat(200))).toBe(1);
  expect(readingMinutes('word '.repeat(201))).toBe(2);
  expect(readingMinutes('word '.repeat(400))).toBe(2);
});

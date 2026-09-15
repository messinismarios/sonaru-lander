import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { versionAnchor } from '../../src/lib/version';

/**
 * The changelog's data, checked without a browser - phases.md 8.9e.
 *
 * The Zod schema already fails the build on a malformed field, so nothing here re-checks a
 * type. What it checks is the things a schema cannot express - and on this collection they
 * are unusually load-bearing, because the whole unit was gated on *not writing a release
 * date that has not happened*.
 *
 * Read as files rather than through `astro:content`, following `blog-inventory.spec.ts`:
 * the collection only resolves inside Astro's module graph, and a unit test that had to
 * boot Astro to read one file would be slower and fail for more reasons.
 */

const CONTENT = new URL('../../src/content/changelog/', import.meta.url);

interface Entry {
  readonly name: string;
  readonly frontmatter: string;
  readonly body: string;
}

function entries(): Entry[] {
  return (
    readdirSync(CONTENT)
      // Dotfiles are skipped because Astro's glob loader skips them: a parked `.1-0.md` is not
      // a release the page renders, so it is not one these rules apply to.
      .filter((name) => name.endsWith('.md') && !name.startsWith('.'))
      .map((name) => {
        const raw = readFileSync(new URL(name, CONTENT), 'utf8');
        const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
        if (match === null) throw new Error(`${name} has no frontmatter block`);
        return { name, frontmatter: match[1] ?? '', body: match[2] ?? '' };
      })
  );
}

function field(frontmatter: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*'?([^'\n]*)'?\\s*$`, 'm').exec(frontmatter);
  return match?.[1]?.trim();
}

const ALL = entries();

test('there is at least one release note', () => {
  // A changelog route that renders nothing is worse than the pending footer entry it
  // replaced. 8.9e ships exactly one; this fails if that one is ever deleted.
  expect(ALL.length).toBeGreaterThan(0);
});

test('versions are unique', () => {
  const versions = ALL.map((entry) => field(entry.frontmatter, 'version'));
  expect(versions).toEqual([...new Set(versions)]);
});

test('the filename is the version, so a permalink is guessable from either end', () => {
  for (const entry of ALL) {
    const version = field(entry.frontmatter, 'version');
    expect(entry.name, `${entry.name} should be named for its version`).toBe(
      `${version?.replace(/\./g, '-')}.md`,
    );
  }
});

test('anchors are fragment-safe', () => {
  for (const entry of ALL) {
    const version = field(entry.frontmatter, 'version');
    // A dot is legal in a fragment and is the class delimiter in a selector, so every
    // caller that queried `#v1.0` would have to escape it.
    expect(versionAnchor(version ?? '')).toMatch(/^v[\d-]+$/);
  }
});

/**
 * **The guard the whole unit turns on.**
 *
 * Sonaru has never shipped - no git tag, no App Store record, no TestFlight build - so
 * 1.0 has no release date, and `releasedAt` is optional precisely so that today's date is
 * not written in its place. That concession covers exactly one entry: the unreleased head,
 * which `lib/releases.ts` sorts first for the same reason. A second undated entry means
 * either a date was dropped from something that shipped, or the optionality has become a
 * way of not writing dates at all.
 */
test('at most one release is undated', () => {
  const undated = ALL.filter((entry) => field(entry.frontmatter, 'releasedAt') === undefined);
  expect(
    undated.map((entry) => entry.name),
    'only the release that has not shipped yet may omit releasedAt',
  ).toHaveLength(Math.min(undated.length, 1));
});

test('release instants are unique and UTC', () => {
  const instants = ALL.map((entry) => field(entry.frontmatter, 'releasedAt')).filter(
    (value): value is string => value !== undefined,
  );
  expect(instants).toEqual([...new Set(instants)]);
  for (const instant of instants) {
    // Same rule as the blog's `publishedAt`: an offset would sort before a `Z` instant it
    // actually follows.
    expect(instant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
});

for (const entry of ALL) {
  test(`${entry.name} leaves the h1 to the layout and the h2 to its title`, () => {
    // The page's h1 is the masthead and each release's h2 is its frontmatter title, so a
    // note's own sections start at h3. This is one level deeper than the legal collection,
    // whose documents *are* the page.
    const tooShallow = entry.body.split('\n').filter((line) => /^#{1,2}\s/.test(line));
    expect(
      tooShallow,
      `${entry.name} opens a heading above h3; its sections should start at ###`,
    ).toEqual([]);
  });

  test(`${entry.name} keeps its sections within h3 and h4`, () => {
    const tooDeep = entry.body.split('\n').filter((line) => /^#{5,}\s/.test(line));
    expect(tooDeep, `${entry.name} nests deeper than h4`).toEqual([]);
  });

  test(`${entry.name} titles the release by what shipped, not by its number`, () => {
    // Gate A took superlist's model over gsap's here: a version-numbered title is right
    // for a library whose product is a version number, and turns an app's changelog into
    // a version table.
    const title = field(entry.frontmatter, 'title') ?? '';
    const version = field(entry.frontmatter, 'version') ?? '';
    expect(title, `${entry.name}'s title is just its version`).not.toBe(version);
    expect(title.length, `${entry.name}'s title should be a sentence`).toBeGreaterThan(
      version.length + 8,
    );
  });
}

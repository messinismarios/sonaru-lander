import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CHAPTERS, COLOUR_GROUPS, MINIMUM_SIZE, MISUSES } from '../../src/data/brand';
import { PAIRINGS, score } from '../../src/lib/contrast';
import { palette } from '../../src/lib/tokens';

/**
 * The identity document's inventory - phases.md 8.10c.
 *
 * `/brand` documents the palette, and the failure that matters is not a colour printed
 * wrongly - the page reads every value from `tokens.css`, so it cannot be - but a colour
 * that gets **added to the site and documented nowhere**. Nothing about that shows on the
 * page: an undocumented token looks exactly like a token that has no group, which is to say
 * like nothing at all.
 *
 * So this walks the declarations and the stylesheet against each other **in both
 * directions**, the discipline `nav-inventory.spec.ts` established for routes and
 * `press-assets.spec.ts` for files. The direction that actually bites is the second one.
 */

const tokensCss = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const tokens = palette(tokensCss);

test('every token a group names is declared in tokens.css', () => {
  const missing = COLOUR_GROUPS.flatMap((group) =>
    group.tokens.filter((token) => !tokens.has(token)).map((token) => `${group.id}: ${token}`),
  );
  expect(missing).toEqual([]);
});

test('every token tokens.css declares is documented by exactly one group', () => {
  /*
   * The direction that matters. A colour added to the palette and left out of this file is
   * a colour the identity document does not mention, and the page would render perfectly.
   */
  const grouped = COLOUR_GROUPS.flatMap((group) => group.tokens);
  const undocumented = [...tokens.keys()].filter((token) => !grouped.includes(token));
  expect(
    undocumented.map((token) => `--color-${token} is declared but no group in brand.ts lists it`),
  ).toEqual([]);

  const duplicated = grouped.filter((token, index) => grouped.indexOf(token) !== index);
  expect(duplicated).toEqual([]);
});

test('chapter ids are unique, and are usable as fragments', () => {
  const ids = CHAPTERS.map((chapter) => chapter.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
});

test('misuse ids are unique', () => {
  const ids = MISUSES.map((misuse) => misuse.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('the minimum-size figure actually contains the minimum it claims', () => {
  // The figure exists so the number can be judged by eye. If the floor were not among the
  // sizes drawn, the page would be asserting it rather than showing it.
  expect(MINIMUM_SIZE.figure).toContain(MINIMUM_SIZE.px);
});

test('every declared pairing scores, and the page prints what the validator enforces', () => {
  /*
   * `score()` throws on a pairing naming a token the stylesheet no longer declares - the
   * one failure this table can have that looks like success, since a usage rule for a
   * deleted colour is invisible on the page and green in CI. Both consumers call it, so
   * this covers `/brand` and `npm run contrast` at once.
   */
  const scored = score(tokens);
  expect(scored).toHaveLength(PAIRINGS.length);
  const failures = scored
    .filter((pairing) => !pairing.passes)
    .map((pairing) => `${pairing.fg} on ${pairing.bg} - ${pairing.ratio.toFixed(2)}:1`);
  expect(failures).toEqual([]);
});

test('no hex literal reaches src/data/brand.ts', () => {
  /*
   * `CLAUDE.md`'s first non-negotiable, checked on the one module most likely to break it:
   * a document about colour is exactly where somebody types a hex code "just to show it".
   */
  const source = readFileSync(new URL('../../src/data/brand.ts', import.meta.url), 'utf8');
  expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/);
});

test('the built page ships no JavaScript', () => {
  /*
   * **Asserted against `dist/`, not against the rendered page, and that placement is the
   * finding.** The e2e suite runs on `astro dev`, which injects its own HMR client and
   * mounts a dev toolbar - so `/brand` carries scripts in development that it does not
   * ship, and a DOM assertion there fails against a page that is in fact script-free. It is
   * 8.10a's lesson from a new angle: assert against what the visitor gets.
   *
   * `npm run verify` builds before it tests, so this reads a fresh `dist`. Run on its own
   * after editing the page and it reads whatever was built last - which is why the message
   * below says so rather than letting a stale pass look like a real one.
   */
  const built = new URL('../../dist/brand.html', import.meta.url);
  let html: string;
  try {
    html = readFileSync(built, 'utf8');
  } catch {
    throw new Error('dist/brand.html is missing - run `npm run build` before this test.');
  }
  expect(html).not.toMatch(/<script/i);
});

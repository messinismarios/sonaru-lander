import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { CATALOGUES, LOCALES, LOCALE_NAMES, DEFAULT_LOCALE } from '../../copy/config';

/**
 * `copy/` keeps its shape - phases.md 8.11b, Gate C rev 3.
 *
 * The owner's requirement for this refactor was that adding a language is *only* three things:
 * create `copy/<code>/`, import it, and add the code to the config. Everything that makes that
 * true is either the type system's job or this file's.
 *
 * **The type system already covers the inside of a locale.** `CATALOGUES` is
 * `satisfies Partial<Record<Locale, Catalogue>>`, so a directory missing a key - or inventing
 * one - fails `npm run typecheck` and names the key. That is the half worth having a compiler
 * for, and there is no point restating it here.
 *
 * **What a compiler cannot see is a locale declared in one list and forgotten in another**, or
 * a directory sitting in `copy/` that nothing imports. Those are the failures where the site
 * keeps building and a language is quietly half-wired: a `/fr/` tree that routes with no name
 * in the switcher, or French sitting on disk reaching nobody. That is what this guards.
 */

const COPY = new URL('../../copy/', import.meta.url).pathname;

/** The locale directories actually on disk, which is the fact the config claims things about. */
function directories(): string[] {
  return readdirSync(COPY)
    .filter((entry) => statSync(`${COPY}${entry}`).isDirectory())
    .sort();
}

test('every language on disk is declared, and every declared language is on disk', () => {
  // A directory nothing imports is copy nobody reads; a code with no directory is a /xx/ tree
  // of English. Both build cleanly, which is exactly why they need saying out loud.
  expect(directories()).toEqual([...Object.keys(CATALOGUES)].sort());
});

test('every language with words is a language that routes', () => {
  for (const code of Object.keys(CATALOGUES)) {
    expect(LOCALES, `${code} has copy but does not route`).toContain(code);
  }
});

test('every language that routes has a name of its own', () => {
  /*
   * `LOCALE_NAMES` is what the switcher renders, and it is the one list that covers *routing*
   * locales rather than translated ones - a language you can reach has to be nameable before
   * its words exist, or 8.11b's whole interim state has an unlabelled entry in the footer.
   */
  for (const locale of LOCALES) {
    expect(LOCALE_NAMES[locale], `${locale} has no endonym`).toBeTruthy();
  }
  expect(Object.keys(LOCALE_NAMES).sort()).toEqual([...LOCALES].sort());
});

test('the default locale is one of the locales, and it has words', () => {
  // Everything falls back here, so this is the one locale that may never be missing.
  expect(LOCALES).toContain(DEFAULT_LOCALE);
  expect(Object.keys(CATALOGUES)).toContain(DEFAULT_LOCALE);
});

test('every locale directory carries the same files as the default one', () => {
  /*
   * Structure, not content. The types check the keys inside each file; this checks that the
   * *files* match, so a translator copying `copy/en` and missing `press.ts` is told which file
   * rather than shown a hundred missing keys from a module that does not exist.
   */
  const expected = readdirSync(`${COPY}${DEFAULT_LOCALE}`).sort();
  for (const dir of directories()) {
    expect(
      readdirSync(`${COPY}${dir}`).sort(),
      `copy/${dir} differs from copy/${DEFAULT_LOCALE}`,
    ).toEqual(expected);
  }
});

test('a locale file imports nothing a bundler would have to resolve', () => {
  /*
   * `scripts/check-contrast.mjs` imports `copy/en/brand.ts` directly under
   * `--experimental-strip-types`, so an `astro:` module, a `?raw` import or a path alias inside
   * a copy file breaks a script that has nothing to do with translation. Inherited from 8.11a
   * and worth keeping now that these files live somewhere a contributor may treat as plain data.
   */
  for (const dir of directories()) {
    for (const file of readdirSync(`${COPY}${dir}`)) {
      const source = readFileSync(`${COPY}${dir}/${file}`, 'utf8');
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(match[1], `copy/${dir}/${file} imports ${match[1]}`).toMatch(/^\.\//);
      }
    }
  }
});

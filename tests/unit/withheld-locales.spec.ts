import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCALE,
  LOCALES,
  PUBLISHED_LOCALES,
  WITHHELD_LOCALES,
  hasCatalogue,
} from '../../src/i18n';

/**
 * A language that is declared but not published - phases.md 8.11e.
 *
 * **This file is the reason `WITHHELD_LOCALES` exists as a list instead of `es` simply being
 * deleted from `LOCALES`.** The deletion ships the same bytes and leaves nothing to check:
 * there would be no record on the site that a second language was ever meant, and no build
 * step that notices when the situation changes. Named, the withholding is a fact with a guard
 * on it, and the guard asserts the *absence* positively - no tree in `dist/`, no `hreflang`,
 * no sitemap chunk, no link, no switcher - rather than leaving four other specs to cover
 * nothing and pass.
 *
 * **Against `dist/`, not the dev server**, for 8.10c's reason: every claim here is about
 * shipped bytes, and `npm run verify` builds before it tests.
 */

const DIST = new URL('../../dist/', import.meta.url);
const dist = (path: string) => fileURLToPath(new URL(path, DIST));

/** Every built page, so a claim about "no page does X" is about all of them. */
function builtPages(dir = DIST): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...builtPages(new URL(`${entry.name}/`, dir)));
    else if (entry.name.endsWith('.html')) out.push(fileURLToPath(new URL(entry.name, dir)));
  }
  return out;
}

test('the two lists partition the declared locales, with nothing in both or neither', () => {
  const withheld = WITHHELD_LOCALES as readonly string[];

  const inBoth = PUBLISHED_LOCALES.filter((locale) => withheld.includes(locale));
  expect(inBoth, 'published and withheld at once').toEqual([]);

  expect(
    [...PUBLISHED_LOCALES, ...withheld].sort(),
    'a declared locale that is neither published nor withheld',
  ).toEqual([...LOCALES].sort());

  expect(withheld, 'the default locale cannot be withheld - it is the site').not.toContain(
    DEFAULT_LOCALE,
  );
});

test('a withheld locale is a declared one, so a typo cannot withhold nothing', () => {
  const undeclared = (WITHHELD_LOCALES as readonly string[]).filter(
    (locale) => !(LOCALES as readonly string[]).includes(locale),
  );
  expect(undeclared, 'withheld but not in LOCALES: this withholds nothing at all').toEqual([]);
});

test('a withheld locale has no words yet, or it should be published', () => {
  /*
   * **This is the assertion the unit is for.** The forgetting that 8.11e has to survive is
   * somebody writing `copy/es/`, registering it in `CATALOGUES`, and never touching this
   * list - at which point the Spanish exists, is typechecked, is complete, and ships to
   * nobody, silently, forever. There is no other signal for that: every other test in the
   * suite would be green.
   */
  const translated = (WITHHELD_LOCALES as readonly string[]).filter((locale) =>
    hasCatalogue(locale),
  );
  expect(
    translated,
    'this locale has a full catalogue and is still withheld - take it out of WITHHELD_LOCALES, or say here why not',
  ).toEqual([]);
});

for (const locale of WITHHELD_LOCALES as readonly string[]) {
  test(`/${locale}/ is absent from the build`, () => {
    expect(existsSync(dist(`${locale}/`)), `dist/${locale}/ exists`).toBe(false);
    expect(existsSync(dist(`${locale}/404.html`))).toBe(false);
    expect(existsSync(dist(`sitemap-${locale}-0.xml`))).toBe(false);
  });

  test(`no built page links to or advertises /${locale}/`, () => {
    const offenders: string[] = [];
    for (const file of builtPages()) {
      const html = readFileSync(file, 'utf8');
      if (html.includes(`href="/${locale}/`) || html.includes(`href="/${locale}"`)) {
        offenders.push(`${file}: links to /${locale}/`);
      }
      if (html.includes(`hreflang="${locale}"`)) offenders.push(`${file}: hreflang=${locale}`);
    }
    expect(offenders).toEqual([]);
  });

  test(`the sitemap index does not name ${locale}`, () => {
    expect(readFileSync(dist('sitemap-index.xml'), 'utf8')).not.toContain(`sitemap-${locale}-`);
  });
}

test('one published language renders no switcher on any page', () => {
  /*
   * A switcher of one is furniture: it names a language, asks to be clicked, and cannot be.
   * `LocaleSwitcher.astro` renders nothing rather than an empty list, because an empty `<ul>`
   * would still take the footer `.identity` row's flex gap.
   */
  test.skip(PUBLISHED_LOCALES.length > 1, 'more than one language is published');
  const withSwitcher = builtPages().filter((file) =>
    readFileSync(file, 'utf8').includes('class="locales"'),
  );
  expect(withSwitcher).toEqual([]);
});

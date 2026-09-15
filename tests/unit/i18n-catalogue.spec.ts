import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EXEMPT_FILES, EXEMPT_STRINGS } from '../../src/i18n/allowlist';
import { catalogue, LOCALES } from '../../src/i18n';

/**
 * No user-visible string outside `copy/` - phases.md 8.11a, retargeted at 8.11b Gate C rev 3.
 *
 * **The copy moved out of `src/` entirely at 8.11b.** It lives in `copy/<locale>/`, one
 * directory per language, and this scanner only ever walks `src/` - so the rule it enforces is
 * now the plain one its name states: a sentence found anywhere under `src/` is a sentence that
 * escaped the catalogue.
 *
 * `phases.md` asked for "a lint rule that fails the build on a hardcoded string". The
 * owner chose a test at Gate B: it fails the build through the same `npm run verify`, it
 * is ~40 lines against ~150 of `astro-eslint-parser` AST plumbing that only this repo
 * would ever use, and it is the fifth inventory spec of its kind after `blog-inventory`,
 * `brand-inventory`, `nav-inventory` and `press-assets`.
 *
 * **What it cannot do**, stated rather than discovered later: it is a scanner, not a
 * compiler. It reads text nodes, a fixed set of attributes, and quoted literals in
 * frontmatter. A string assembled at runtime out of two variables is invisible to it, and
 * so is one passed through a prop it does not know the name of. It catches the mistake
 * that actually happens - someone types a sentence into a component - and it is honest
 * about not catching every possible one.
 */

const SRC = new URL('../../src/', import.meta.url).pathname;

/** Attributes whose value a person reads or hears. `alt` and `aria-label` most of all. */
const COPY_ATTRS =
  /\b(aria-label|alt|title|placeholder|label|summary|eyebrow|headline|lede)=["']([^"'\n]+)["']/g;

/** Token names, kebab keys, camelCase identifiers, SCREAMING constants. */
const IDENTIFIER = /^(?:[a-z]+-\d+|[a-z]+(?:-[a-z]+)+|[a-z]+[A-Z]\w*|[A-Z_]+)$/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(astro|svelte|ts)$/.test(entry.name) ? [path] : [];
  });
}

function strip(source: string): string {
  return (
    source
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[\s;{),])\/\/[^\n]*/g, '$1')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      /* Messages thrown at whoever broke the build. Never rendered, never translated. */
      .replace(/throw new Error\([\s\S]*?\);/g, '')
  );
}

/**
 * Is this string something a visitor reads?
 *
 * A phrase, or a capitalised label. Not an identifier, not a URL, not a hex value, and
 * not a template literal - anything carrying `${` is being assembled from values, and the
 * words in it came from somewhere this scanner has already checked.
 */
function isCopy(raw: string): boolean {
  const value = raw.trim();
  if (value.length < 3 || !/[A-Za-z]/.test(value)) return false;
  if (value.includes('${')) return false;
  if (/^https?:|^\/|^#[0-9a-f]{3,8}$|^--|^var\(|^\d/.test(value)) return false;
  if (IDENTIFIER.test(value)) return false;
  const words = value.split(/\s+/).filter((word) => /[A-Za-z]{2}/.test(word));
  return words.length >= 2 || /^[A-Z]/.test(value);
}

function findings(): string[] {
  const exemptFiles = new Set(EXEMPT_FILES.map((entry) => entry.file));
  const exemptStrings = new Set(EXEMPT_STRINGS.map((entry) => entry.value));
  const found: string[] = [];

  for (const path of walk(SRC)) {
    const file = `src/${relative(SRC, path)}`.replace(/\\/g, '/');
    /* `src/i18n/` is the lookup machinery and holds no prose of its own since the copy moved
     * to `copy/`. It stays skipped because its doc comments quote catalogue keys and example
     * sentences, which a scanner reading quoted literals cannot tell from the real thing. */
    if (file.startsWith('src/i18n/') || exemptFiles.has(file)) continue;

    const source = strip(readFileSync(path, 'utf8'));
    let script = source;
    let template = '';
    if (file.endsWith('.astro')) {
      const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
      if (match) [, script = '', template = ''] = match;
    } else if (file.endsWith('.svelte')) {
      script = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1])
        .join('\n');
      template = source.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    }

    const candidates = [
      ...[...template.matchAll(/>([^<>{}\n][^<>{}]*)</g)].map((match) => match[1] ?? ''),
      ...[...template.matchAll(COPY_ATTRS)].map((match) => match[2] ?? ''),
      ...[...script.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.){3,})\1/g)].map((m) => m[2] ?? ''),
    ];

    for (const candidate of candidates) {
      const value = candidate.trim();
      if (!isCopy(value) || exemptStrings.has(value)) continue;
      found.push(`${file}: ${value.slice(0, 80)}`);
    }
  }
  return found;
}

test('no user-visible string lives outside copy/', () => {
  expect(findings()).toEqual([]);
});

/**
 * The allowlist's own guard.
 *
 * A whole-file exemption is the strong form and it should stay rare, so the set is
 * asserted exactly: adding one means editing this assertion, which is a change a reviewer
 * sees rather than a line appended to a list nobody rereads.
 */
test('the only whole-file exemptions are the build-only routes', () => {
  expect(EXEMPT_FILES.map((entry) => entry.file).sort()).toEqual([
    /* `/brand`'s running prose moved into copy/en/brand.ts alongside its tabular content,
     * so the identity document no longer needs a whole-file exemption. The four dev-only
     * routes and the camera stand stayed unprefixed: a tool 8.13 deletes does not get a
     * Spanish twin. */
    'src/pages/blog/lab.astro',
    'src/pages/kit.astro',
    'src/pages/logo/lab.astro',
    'src/pages/og/press-assets.astro',
    'src/pages/specimen.astro',
  ]);
});

test('every exemption says why it is one', () => {
  for (const entry of [...EXEMPT_FILES, ...EXEMPT_STRINGS]) {
    const subject = 'file' in entry ? entry.file : entry.value;
    expect(entry.reason.trim().length, `${subject} has no reason`).toBeGreaterThan(20);
  }
});

/**
 * 8.11a ships English only. `es` arrives at 8.11c, and the day it does this test starts
 * asserting that asking for it returns Spanish rather than quietly returning English.
 */
test('a locale with no catalogue falls back whole, never key by key', () => {
  for (const locale of LOCALES) {
    const strings = catalogue(locale);
    expect(strings.ui.skipToContent.length, `${locale} has chrome`).toBeGreaterThan(0);
  }
  expect(catalogue('en')).toBe(catalogue(undefined));
});

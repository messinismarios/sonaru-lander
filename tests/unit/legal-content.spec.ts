import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * The documents themselves - phases.md 8.9b.
 *
 * The Zod schema in `src/content.config.ts` already fails the build on a malformed or
 * half-filled entry, so nothing here re-checks a type. What it checks is the two things
 * a schema cannot express: that the body never opens a second `h1` - the layout owns the
 * only one, and a `#` in the markdown would put two in the outline - and that the
 * promises the site makes elsewhere about these pages are actually kept by their text.
 *
 * The last group is the one worth having. `design-system.md` §7.4 requires a published
 * takedown contact and `phases.md` 8.9b requires the pages that unblock App Store
 * submission; both are satisfied by *words on a page*, which is exactly the kind of
 * requirement that quietly stops being true when someone rewrites the copy.
 */

const DIR = new URL('../../src/content/legal/', import.meta.url);

const documents = readdirSync(DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ name, source: readFileSync(new URL(name, DIR), 'utf8') }));

/** The body, with the frontmatter block removed. */
function body(source: string): string {
  return source.replace(/^---\n[\s\S]*?\n---\n/, '');
}

test('there are three documents, and they are the three the footer offers', () => {
  expect(documents.map((entry) => entry.name).sort()).toEqual([
    'privacy.md',
    'support.md',
    'terms.md',
  ]);
});

for (const { name, source } of documents) {
  test(`${name} leaves the h1 to the layout`, () => {
    const opened = body(source)
      .split('\n')
      .filter((line) => /^#\s/.test(line));
    expect(opened, `${name} sets its own h1; the title in frontmatter is the h1`).toEqual([]);
  });

  test(`${name} starts its sections at h2`, () => {
    // h3 is allowed, h4 is not: three levels is the whole depth these documents have,
    // and a fourth is a sign the page wants to be two pages.
    const tooDeep = body(source)
      .split('\n')
      .filter((line) => /^#{4,}\s/.test(line));
    expect(tooDeep).toEqual([]);
  });
}

test('the privacy policy covers this website, not only the app', () => {
  // The whole reason a new document was written rather than the API's copy reused: the
  // waitlist collects an address and hashes an IP, and the old policy described neither.
  const text = documents.find((entry) => entry.name === 'privacy.md')?.source ?? '';
  expect(text).toContain('waitlist');
  expect(text).toContain('SHA-256');
  expect(text.toLowerCase()).toContain('cookie');
});

test('the support page publishes the takedown contact design-system.md §7.4 requires', () => {
  const text = documents.find((entry) => entry.name === 'support.md')?.source ?? '';
  expect(text.toLowerCase()).toContain('takedown');
  expect(text).toContain('support@sonaru.app');
});

test('every document that takes effect carries the date it took effect', () => {
  // /support deliberately has none - it is not a document that takes effect, and giving
  // it a date would invent a legal character it does not have.
  for (const { name, source } of documents) {
    const hasDate = /^effective: /m.test(source);
    expect(hasDate, `${name}`).toBe(name !== 'support.md');
  }
});

import { expect, test } from '@playwright/test';

import { ROUTES } from './routes';

/**
 * Inline components must not fuse with the words around them.
 *
 * Astro trims the newline and indentation before a component that begins a line, so
 * `... and\n<Link>Apple Music</Link>` renders as "andApple Music". Prettier is free to
 * re-wrap any paragraph at any time, which means a literal space that looks correct in
 * source can become a line break - and the defect appears without anyone editing the
 * sentence. The durable fix is an explicit `{' '}`; this is the check that the fix is
 * actually in place.
 *
 * It failed against the first version of /kit, which read "alongside Spotify andApple
 * Music" and "Read why release tracking is broken" run together. Nothing else caught it:
 * the markup was valid, the build was clean, and the source looked right.
 */

/**
 * Every page in the app, discovered rather than listed.
 *
 * A hardcoded list is a guard that silently stops covering new work - this test was
 * written with two routes in it, and the very next page added introduced exactly the
 * defect it exists to catch. Reading the router's own directory means a new page is
 * covered the moment it exists.
 *
 * It recurses, because the first version did not: moving `logo.astro` to
 * `logo/index.astro` silently dropped both logo routes from coverage. A guard that
 * quietly narrows is the same failure as a guard that was never written.
 */

for (const route of ROUTES) {
  test(`inline elements on ${route} keep their surrounding spaces`, async ({ page }) => {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);

    const fused = await page.evaluate(() => {
      const problems: string[] = [];
      const WORD = /[\p{L}\p{N}]/u;

      /** Text of the node immediately beside an inline element, in document order. */
      const edgeText = (node: ChildNode | null, side: 'end' | 'start'): string | null => {
        if (node === null) return null;
        const text = node.textContent;
        if (text === null || text === '') return null;
        return side === 'end' ? (text.at(-1) ?? null) : (text[0] ?? null);
      };

      for (const inline of document.querySelectorAll('p a, p strong, p em, p code')) {
        const own = inline.textContent ?? '';
        if (own === '') continue;

        const before = edgeText(inline.previousSibling, 'end');
        const after = edgeText(inline.nextSibling, 'start');
        const first = own[0];
        const last = own.at(-1);

        const context = (inline.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim();

        if (before !== null && first !== undefined && WORD.test(before) && WORD.test(first)) {
          problems.push(`"${before}" fuses into "${own}" - ${context.slice(0, 90)}`);
        }
        if (after !== null && last !== undefined && WORD.test(last) && WORD.test(after)) {
          problems.push(`"${own}" fuses into "${after}" - ${context.slice(0, 90)}`);
        }
      }
      return problems;
    });

    expect(fused, `${route} has inline elements running into adjacent words`).toEqual([]);
  });
}

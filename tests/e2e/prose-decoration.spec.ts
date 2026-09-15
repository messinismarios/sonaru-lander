import { expect, test } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * Prose decorates prose links, and nothing else - phases.md 8.11b, Gate C rev 4.
 *
 * **The defect this was written for shipped on `/press` and the owner saw it.** The kit's
 * download button is a `Button` with an `href`, so it renders an `<a>`, and it sat inside
 * `Document.astro`'s `.prose`. That rule selected `a` by *tag*, so it handed a pill button the
 * inline link's underline - invisible at rest under default motion, because the bar sits at
 * `scaleX(0)` until hover, and plainly visible under **reduced motion**, where the same rule
 * pins it to `scaleX(1)` at `opacity: 0.4`. So the site had a button with a line under it for
 * exactly the visitors who had asked for less movement, and every default-motion check -
 * including every visual baseline that is not a reduced variant - agreed the page was fine.
 *
 * **This asserts on which rules matched, not on computed style, and that distinction is the
 * whole reason the test is worth having.** The first version of it checked whether a classed
 * anchor had a visible `::after`, and it reported `a.tag` on all six blog posts - which is
 * *correct markup*: `PostMeta.astro` deliberately gives a tag chip the site's link treatment
 * and `tests/e2e/blog.spec.ts` asserts it matches a real `Link`. Computed style cannot tell a
 * component styling itself from a layout reaching in and styling it, and those are the two
 * things that had to be told apart here. `CSS.getMatchedStylesForNode` can: the question is
 * whether a selector containing `.prose` matched an anchor that belongs to a component.
 */

/** Every route that renders the site's chrome - a camera stand has no `Base` and no prose. */
const PAGES = ROUTES.filter((route) => !isCameraStand(route));

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`.prose never styles a component's anchor (${reducedMotion})`, async ({ page }) => {
    /*
     * **Both motion modes, and the reduced one is the point.** The reduced-motion branch is a
     * separate block with its own selectors, so it can be fixed in one place and left wrong in
     * the other - which is the shape of the original defect, and is not hypothetical.
     */
    await page.emulateMedia({ reducedMotion });

    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable');
    await client.send('CSS.enable');

    const offenders: string[] = [];
    for (const route of PAGES) {
      await page.goto(route);

      const doc = (await client.send('DOM.getDocument', { depth: -1 })) as {
        root: { nodeId: number };
      };
      const { nodeIds } = (await client.send('DOM.querySelectorAll', {
        nodeId: doc.root.nodeId,
        // Anchors that came from a component. A bare <a> is what `.prose` is *for*.
        selector: '.prose a[class]',
      })) as { nodeIds: number[] };

      for (const nodeId of nodeIds) {
        const matched = (await client.send('CSS.getMatchedStylesForNode', { nodeId })) as {
          matchedCSSRules?: { rule: { selectorList: { text: string } } }[];
          pseudoElements?: { matches: { rule: { selectorList: { text: string } } }[] }[];
        };

        const selectors = [
          ...(matched.matchedCSSRules ?? []).map((entry) => entry.rule.selectorList.text),
          ...(matched.pseudoElements ?? []).flatMap((pseudo) =>
            pseudo.matches.map((entry) => entry.rule.selectorList.text),
          ),
        ];

        for (const selector of selectors.filter((text) => text.includes('.prose'))) {
          offenders.push(`${route}: ${selector}`);
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
}

test('a Markdown link in prose still gets its underline', async ({ page }) => {
  /*
   * The other direction, so the fix can never be "delete the rule". A bare `<a>` written by an
   * author in Markdown is exactly what `.prose` exists to style, and `/privacy` is all prose.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/privacy');
  const bare = page.locator('.prose a:not([class])').first();
  await expect(bare).toBeVisible();
  const after = await bare.evaluate((node) => {
    const style = getComputedStyle(node, '::after');
    return { content: style.content, height: style.height, position: style.position };
  });
  expect(after.content).not.toBe('none');
  expect(after.position).toBe('absolute');
  expect(after.height).toBe('1px');
});

test('the kit download is a button, with no line under it', async ({ page }) => {
  /*
   * The owner's report, pinned as itself rather than only as the general rule above - this is
   * the one a reader of this file will want to find.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/press');
  const kit = page.locator('a.btn', { hasText: 'Download the kit' });
  await expect(kit).toBeVisible();
  const after = await kit.evaluate((node) => getComputedStyle(node, '::after').content);
  expect(after).toBe('none');
});

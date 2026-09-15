import { expect, test } from '@playwright/test';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * Class names that collide with a Tailwind utility - phases.md 8.10c.
 *
 * **Found by looking at `/brand`, not by a test, and it is invisible in the source.** The
 * contents block was written as `<nav class="contents">` with a border, padding and a
 * radius in a scoped `<style>`, and it rendered with no box at all - because **`contents`
 * is a Tailwind utility**: `.contents { display: contents }`, which erases the element's
 * own box and promotes its children into the parent's layout. Tailwind v4 generates
 * utilities on demand by scanning source files, so *using the class name is what created
 * the rule that broke it*. Every scoped declaration applied, and all of them were painting
 * a box that no longer existed.
 *
 * **The exact mechanism, because it decides what this guard can and cannot catch.** A
 * scoped Astro rule carries a `[data-astro-cid-…]` attribute, so it out-specifies a bare
 * utility *for the properties it declares*. The danger is only the property the scoped
 * rule **leaves unset** - `display` here - where the utility is unopposed. So the fix is
 * always to rename ours, never to out-specify: a name the framework owns can start
 * declaring something new without us touching a file.
 *
 * Nothing could have failed on its own. The declarations were in the stylesheet, the
 * element was in the DOM, `visibility` was `visible`, and the only symptom was a missing
 * border. Same shape as 8.10b's swatch labels set in a decorative token: correct-looking
 * source whose only evidence is on the screen.
 *
 * The guard is site-wide rather than `/brand`'s, in the spirit of `isCameraStand()` - a
 * check written for one page that is one page wide stops covering the next one.
 */

/**
 * Names the site knowingly shares with a utility, and why each is safe.
 *
 * An entry here is a claim that has been checked, not a suppression. Adding one means
 * confirming the scoped rule declares every property the utility does; anything else
 * belongs on the other side of this list, renamed.
 */
const KNOWN: Readonly<Record<string, string>> = {
  /*
   * Used deliberately as the utility, and both islands also author their own `.sr-only`
   * with the same declarations. Belt and braces rather than a collision.
   */
  'sr-only': 'PlanToggle.svelte and WaitlistForm.svelte both declare it themselves',
  /*
   * `Plans.astro` declares `display: grid` under this name itself, so its scoped rule and
   * Tailwind's `.grid` say the identical thing and the utility changes nothing. Latent
   * rather than live - and the section is frozen behind 8.7's Gate C, so it is recorded
   * here rather than renamed.
   */
  grid: 'Plans.astro declares display: grid itself; the utility is redundant, not opposed',
};

/** Svelte's scoping hashes are that framework's `data-astro-cid`, and declare nothing. */
const SCOPING_HASH = /^svelte-[a-z0-9]+$/;

const ROUTES_TO_CHECK = ROUTES.filter((route) => !isCameraStand(route));

test('no page uses a class name that a utility rule also defines', async ({ page }) => {
  const collisions: string[] = [];

  for (const route of ROUTES_TO_CHECK) {
    await page.goto(route);
    const hits = await page.evaluate(() => {
      /*
       * Only what the page itself authored. The dev toolbar lives in a shadow root and is
       * not reachable here, and anything outside `main` is chrome the layouts own.
       */
      const used = new Set<string>();
      for (const element of document.querySelectorAll('main *')) {
        for (const name of element.classList) used.add(name);
      }

      const found: Array<{ name: string; rule: string }> = [];
      const walk = (rules: CSSRuleList): void => {
        for (const rule of rules) {
          const nested = (rule as CSSGroupingRule).cssRules;
          const selector = (rule as CSSStyleRule).selectorText;
          if (selector === undefined) {
            if (nested !== undefined) walk(nested);
            continue;
          }
          /*
           * A *bare* single-class selector only, and one that actually declares something.
           * A scoped rule always carries its attribute selector, so this cannot match the
           * page's own styles - which is what makes a hit meaningful rather than noise.
           */
          const match = selector.match(/^\.([a-zA-Z][\w-]*)$/);
          const declares = (rule as CSSStyleRule).style?.length > 0;
          if (match?.[1] !== undefined && declares && used.has(match[1])) {
            found.push({ name: match[1], rule: (rule as CSSStyleRule).cssText.slice(0, 90) });
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules);
        } catch {
          /* A cross-origin sheet cannot be read, and we author none. */
        }
      }
      return found;
    });

    for (const hit of hits) {
      if (SCOPING_HASH.test(hit.name) || hit.name in KNOWN) continue;
      collisions.push(
        `${route}: .${hit.name} is also a utility - ${hit.rule}. Rename ours, or add it to ` +
          `KNOWN with the reason it is safe.`,
      );
    }
  }

  expect(collisions).toEqual([]);
});

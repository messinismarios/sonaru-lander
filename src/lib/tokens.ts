/**
 * The palette, parsed out of `tokens.css`.
 *
 * **Because `CLAUDE.md`'s first non-negotiable is that no hex literal lives outside
 * `src/styles/tokens.css`** - the contrast validator parses that file, so a colour written
 * anywhere else is a colour nothing checks. 8.10b is the first thing on the site that has
 * to *print* the palette rather than paint with it: `/press` publishes six values for a
 * journalist to paste, and typing them into a data module would have put six unchecked hex
 * literals in `src/` - six that go quietly wrong the day a token moves.
 *
 * **The caller supplies the stylesheet, and that is not ceremony.** This module has two
 * consumers in two different environments: `src/data/press.ts` runs inside Astro, where the
 * text arrives through Vite's `?raw` and is inlined at build time, and
 * `scripts/lib/brand-svg.mjs` runs in plain Node, where it is a `readFileSync`. The first
 * version read the file here with `new URL('../styles/tokens.css', import.meta.url)`, which
 * **worked in `astro dev` and failed the production build** - the module is bundled into
 * `dist/.prerender/chunks/`, so the relative URL pointed at a stylesheet that is not there.
 * Nothing but `npm run build` would have caught it, which is the argument for the split:
 * one parser, and each caller reads the file the way its own environment can.
 *
 * `scripts/check-contrast.mjs` keeps its own copy of this parse deliberately. It is the
 * validator, and a validator that imports its subject's helper can agree with it about the
 * wrong thing.
 */

const PATTERN = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;

/**
 * The hex behind `--color-<name>`, read from the stylesheet text given.
 *
 * Throws rather than returning a fallback: a missing token means the palette moved under
 * something that names it, and a build that fails says so at the moment it becomes true.
 * A default would ship a wrong colour to a press page.
 */
export function colour(css: string, name: string): string {
  for (const [, token, hex] of css.matchAll(PATTERN)) {
    if (token === name) return hex as string;
  }
  throw new Error(
    `--color-${name} is not defined in src/styles/tokens.css. Something names a token the ` +
      `palette no longer has.`,
  );
}

/**
 * Every `--color-*` token in the stylesheet text given, keyed without the prefix.
 *
 * **Added at 8.10c because `/brand` needs the whole palette rather than one value.** It
 * prints all twenty tokens in their groups and scores the declared pairings against them,
 * and calling `colour()` in a loop would re-scan the stylesheet once per token and - worse
 * - could not answer the question the page actually has to ask, which is *"is there a
 * token here that nothing documents?"*. That direction needs the full set.
 *
 * The keys match `src/lib/contrast.ts`'s pairing names, which is not a coincidence: both
 * are `tokens.css`'s own names with `--color-` removed.
 */
export function palette(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, token, hex] of css.matchAll(PATTERN)) {
    if (token !== undefined && hex !== undefined) tokens.set(token, hex.toLowerCase());
  }
  return tokens;
}

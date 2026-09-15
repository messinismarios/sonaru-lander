/**
 * The mark as an SVG string - one implementation, two generators.
 *
 * `build-brand-assets.mjs` has written the favicon and the app icons from its own copy of
 * this since 8.1, and 8.10b's press kit needs the same mark in two colourways and four
 * sizes. A second copy of the drawing in a second script is the thing this repo has been
 * careful about everywhere else: `mark-geometry.ts` is the single source of the geometry
 * precisely so that nothing restates it, and a generator that restates its *rendering* is
 * the same defect one level up.
 *
 * **Colour is a parameter, and that is the only thing 8.10b added.** The defaults are the
 * values `build-brand-assets.mjs` used before the extraction, to the digit, so the
 * committed favicon and icons regenerate byte-identical - verified by re-running
 * `npm run brand` and reading `git status`, not by assuming.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PRESET, sPath, sonarPath, fitViewBox } from '../../src/components/brand/mark-geometry.ts';
import { colour } from '../../src/lib/tokens.ts';

/* Plain Node here, so the stylesheet is read rather than inlined - the other half of the
 * split `src/lib/tokens.ts` explains. */
const TOKENS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

/*
 * Read from `tokens.css`, not typed here. `build-brand-assets.mjs` carried its own copies
 * of these two from 8.1 - harmless while they agreed, and exactly the hex-outside-tokens
 * that `CLAUDE.md` bans for the reason that they might not.
 */

/** The mark's stroke on the site's own dark ground. */
export const WHITE = colour(TOKENS, 'white');
/** The wave carries the brand colour (8.1 Gate C rev 13). */
export const PLUM_300 = colour(TOKENS, 'plum-300');
/** The stroke of the light colourway, approved at 8.10b's Gate B. */
export const INK_950 = colour(TOKENS, 'ink-950');
/** Its wave - `--plum-300` on white is not legible. */
export const PLUM_700 = colour(TOKENS, 'plum-700');

/**
 * @param {object} options
 * @param {number} options.size Rendered px. The mark is square.
 * @param {string} [options.background] Painted behind the mark; omitted leaves it transparent.
 * @param {string} [options.stroke] The S.
 * @param {string} [options.sonar] The wave.
 */
export function markSvg({ size, background, stroke = WHITE, sonar = PLUM_300 }) {
  const box = fitViewBox(PRESET);
  const bg =
    background === undefined
      ? ''
      : `<rect x="-1000" y="-1000" width="3000" height="3000" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${size}" height="${size}">
  ${bg}
  <g fill="none" stroke="${stroke}" stroke-linecap="round">
    <path d="${sonarPath(PRESET)}" stroke="${sonar}" stroke-width="${PRESET.sonarStroke}" opacity="${PRESET.sonarOpacity}"/>
    <path d="${sPath(PRESET)}" stroke-width="${PRESET.stroke}"/>
  </g>
</svg>`;
}

/**
 * The two colourways the press kit ships, and the only thing that separates them.
 *
 * They live here rather than in the generator because `tests/unit/press-assets.spec.ts`
 * recomputes the hash below, and importing the generator would run it - a unit test is not
 * a thing that should launch Chrome and rewrite a megabyte of the repo.
 */
export const COLOURWAYS = {
  dark: { stroke: WHITE, sonar: PLUM_300 },
  light: { stroke: INK_950, sonar: PLUM_700 },
};

/**
 * What the logo files were generated *from* - the geometry and the two colourways.
 *
 * `npm run press` records it in `public/press/manifest.json` and the unit test recomputes
 * it, so refining the mark or moving a token without re-running the generator fails the
 * build instead of shipping a press kit that quietly shows the old mark. The same
 * discipline `npm run og` uses for the covers, and `npm run brand` for the icons.
 *
 * **It deliberately does not cover the screenshots.** Their input is five PNGs in the iOS
 * checkout, which CI does not have - a hash over those would fail on a clean clone.
 */
export function logoHash(preset = PRESET, colourways = COLOURWAYS) {
  return createHash('sha256')
    .update(JSON.stringify({ preset, colourways }))
    .digest('hex')
    .slice(0, 16);
}

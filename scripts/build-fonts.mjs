/**
 * Font pipeline - phases.md 8.1: "subset, variable, preload, metrics-matched fallback
 * with **zero** layout shift on swap".
 *
 * Run: npm run fonts
 *
 * Does two things, both reproducibly:
 *
 *  1. Subsets the licensed Satoshi variable font to the characters this site actually
 *     sets - Latin-1 plus the Spanish punctuation /es/ needs - keeping the wght axis
 *     intact. design-system.md §3 asks for a subset per locale; en and es share one
 *     Latin subset, so one file covers both without a second network request when the
 *     visitor switches locale.
 *
 *  2. Computes the @font-face descriptors for a metrics-matched fallback, so the text
 *     laid out in Arial before Satoshi arrives occupies the *same* space and the swap
 *     costs no layout shift. The CLS budget is 0.01 total (acceptance-criteria.md §3)
 *     and a font swap may not spend it.
 *
 * The computed descriptors are written into src/styles/fonts.css, which is generated -
 * edit this script, not that file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import subsetFont from 'subset-font';
import * as fontkit from 'fontkit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'public/fonts/satoshi-variable.woff2');
const SUBSET = join(ROOT, 'public/fonts/satoshi-subset.woff2');

/**
 * The logotype is a different face from the body text, and it only ever sets one word - so
 * it is subset to the six letters of "Sonaru" and nothing else. ~31 KB becomes ~2 KB, and
 * that is the honest shape of the dependency: a logotype is lettering, not a typeface the
 * site composes arbitrary text in.
 *
 * Provisional alongside the mark. When the logotype is finished it becomes outlines and
 * this file stops shipping entirely.
 */
const LOGOTYPE_SOURCE = join(ROOT, 'public/fonts/candidates/outfit.woff2');
const LOGOTYPE_SUBSET = join(ROOT, 'public/fonts/logotype-subset.woff2');
const LOGOTYPE_CHARS = 'Sonaru';

const OUT_CSS = join(ROOT, 'src/styles/fonts.css');

/**
 * The character set we commit to serving. Latin basic + Latin-1 Supplement covers
 * English and Spanish (á é í ó ú ü ñ ¿ ¡), plus the typographic punctuation the copy
 * uses - em dash, curly quotes, ellipsis, the bullet used as a meta separator.
 */
const CHARSET = [
  ...rangeChars(0x20, 0x7e), // Basic Latin
  ...rangeChars(0xa0, 0xff), // Latin-1 Supplement - Spanish accents, ¿, ¡
  ...'‘’“”–-…•·€™←→↑↓',
].join('');

/** @param {number} from @param {number} to @returns {string[]} */
function rangeChars(from, to) {
  const out = [];
  for (let code = from; code <= to; code += 1) out.push(String.fromCodePoint(code));
  return out;
}

/**
 * The system face the fallback stack actually resolves to. Arial is present on macOS
 * and Windows; Liberation Sans is metric-compatible with it on Linux, so one set of
 * overrides holds across all three.
 */
const FALLBACK = {
  name: 'Arial',
  unitsPerEm: 2048,
  ascent: 1854,
  descent: -434,
  lineGap: 67,
  xHeight: 1062,
};

/**
 * Satoshi's advance width relative to Arial's, at weight 400, over a representative
 * sentence of real site copy - measured in the browser via canvas `measureText`, which
 * is the renderer whose line breaking we actually care about.
 *
 * This is what `size-adjust` is derived from, NOT the x-height ratio. Matching x-heights
 * makes the two faces *look* the same size but leaves their advance widths different, so
 * the fallback wraps at a different word and the block gains or loses a line - which is
 * a far bigger layout shift than any mismatch in cap height. The first version of this
 * script matched x-height (0.9642) and moved the document 77px.
 *
 * Re-measured after the subsetter's axis-limit bug was removed - the earlier values
 * (0.9972 / 0.9848) were taken against a subset whose advance widths were wrong.
 *
 * Weight 400 is the target because body copy is where wrapping happens; display text is
 * constrained with `ch`-based max-widths, which scale with the font and stay put on their
 * own. tests/visual/font-fallback.spec.ts asserts the result stays at zero shift.
 */
const ADVANCE_RATIO = { regular: 0.9761, bold: 0.9648 };

const source = readFileSync(SOURCE);
const satoshi = fontkit.create(source);

/*
 * No `variationAxes` option, deliberately.
 *
 * Satoshi's fvar declares wght min 300 / default 900 / max 900, and asking the subsetter
 * to re-limit that axis - even to the range it already has - triggers an instancing pass
 * that rebuilds the variation metrics. The result renders: 56 of 59 glyphs came back with
 * different advance widths than the source, each off by a different amount in a different
 * direction, which reads on the page as letters bunching in one word and gaping in the
 * next. Omitting the option keeps the font's own gvar/HVAR data untouched, and
 * tests/visual/font-metrics.spec.ts asserts the subset stays metrically identical to the
 * source. The full 300-900 range survives subsetting on its own; restricting it bought
 * nothing and cost correctness.
 */
const subset = await subsetFont(source, CHARSET, { targetFormat: 'woff2' });
writeFileSync(SUBSET, subset);

const logotypeSource = readFileSync(LOGOTYPE_SOURCE);
const logotypeSubset = await subsetFont(logotypeSource, LOGOTYPE_CHARS, { targetFormat: 'woff2' });
writeFileSync(LOGOTYPE_SUBSET, logotypeSubset);

/*
 * size-adjust scales the fallback so its advance width matches Satoshi's. Every vertical
 * override is then expressed against that adjusted em, which is why each divides by
 * sizeAdjust - that is what keeps line boxes identical once the widths agree.
 */
const pct = (/** @type {number} */ n) => `${(n * 100).toFixed(2)}%`;

/**
 * One fallback face per weight band. Arial Regular and Arial Bold are different
 * typefaces with different advance widths, so they need different `size-adjust` values -
 * and a single @font-face spanning 300-900 silently maps *every* weight to Arial
 * Regular, which is how the bold headings ended up 6-8% narrow.
 *
 * @param {number} ratio
 */
function overridesFor(ratio) {
  return {
    sizeAdjust: pct(ratio),
    ascent: pct(satoshi.ascent / satoshi.unitsPerEm / ratio),
    descent: pct(Math.abs(satoshi.descent) / satoshi.unitsPerEm / ratio),
    lineGap: pct(satoshi.lineGap / satoshi.unitsPerEm / ratio),
  };
}

const regular = overridesFor(ADVANCE_RATIO.regular);
const bold = overridesFor(ADVANCE_RATIO.bold);
const xHeightDrift =
  satoshi.xHeight /
  satoshi.unitsPerEm /
  (ADVANCE_RATIO.regular * (FALLBACK.xHeight / FALLBACK.unitsPerEm));

const css = `/*
 * GENERATED by scripts/build-fonts.mjs - do not edit by hand.
 *
 * Satoshi (Indian Type Foundry, ITF Free Font Licence) is the site's only typeface,
 * chosen by the owner at the 8.1 gate. See public/fonts/LICENSES.md.
 *
 * "Satoshi Fallback" is Arial, rescaled so its x-height, ascent, descent and line gap
 * match Satoshi's exactly, so text set in it occupies identical space.
 *
 * **\`block\`, not \`swap\`** (owner, 8.14, 2026-09-13). The fallback matches Satoshi's space but
 * not its letterforms, and on a phone the swap read as every line of text twitching on load.
 * Text now stays invisible until its face arrives - both files are preloaded - and paints
 * once. The fallback still takes over if a face misses the browser's block period (~3s).
 */

@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/satoshi-subset.woff2') format('woff2-variations');
  font-weight: 300 900;
  font-style: normal;
  font-display: block;
}

/*
 * The logotype. Outfit (OFL), subset to the six letters of "Sonaru". Chosen by the owner
 * over Satoshi and three other rounder candidates with the word set in each.
 *
 * No fallback face is declared on purpose: if it fails to load, the wordmark should render
 * in Satoshi rather than in a system font that resembles neither.
 */
@font-face {
  font-family: 'Sonaru Logotype';
  src: url('/fonts/logotype-subset.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'Satoshi Fallback';
  src: local('Arial'), local('Liberation Sans'), local('Helvetica');
  font-weight: 300 500;
  font-style: normal;
  size-adjust: ${regular.sizeAdjust};
  ascent-override: ${regular.ascent};
  descent-override: ${regular.descent};
  line-gap-override: ${regular.lineGap};
}

@font-face {
  font-family: 'Satoshi Fallback';
  src: local('Arial Bold'), local('Arial-BoldMT'), local('Liberation Sans Bold'),
    local('Helvetica Bold');
  font-weight: 600 900;
  font-style: normal;
  size-adjust: ${bold.sizeAdjust};
  ascent-override: ${bold.ascent};
  descent-override: ${bold.descent};
  line-gap-override: ${bold.lineGap};
}
`;
writeFileSync(OUT_CSS, css);

const kb = (/** @type {number} */ bytes) => `${(bytes / 1024).toFixed(1)} KB`;
process.stdout.write(
  [
    `Satoshi subset:  ${kb(source.length)} -> ${kb(subset.length)} ` +
      `(${CHARSET.length} characters, wght 300-900 preserved)`,
    `Logotype subset: ${kb(logotypeSource.length)} -> ${kb(logotypeSubset.length)} ` +
      `("${LOGOTYPE_CHARS}" only)`,
    `Fallback regular (Arial):      size-adjust ${regular.sizeAdjust}, ascent ${regular.ascent}, descent ${regular.descent}`,
    `Fallback bold    (Arial Bold): size-adjust ${bold.sizeAdjust}, ascent ${bold.ascent}, descent ${bold.descent}`,
    `  x-height lands within ${pct(Math.abs(1 - xHeightDrift))} of Satoshi's`,
    `Wrote ${OUT_CSS.replace(ROOT + '/', '')}`,
    '',
  ].join('\n'),
);

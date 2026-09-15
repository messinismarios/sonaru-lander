/**
 * The identity document as a PDF - phases.md 8.10d.
 *
 * Run: `npm run pdf`  (needs the dev server: `npm run dev`)
 *
 *   public/brand/sonaru-brand.pdf    the document
 *   public/brand/manifest.json       bytes, page count, and a hash of what made it
 *
 * **There is no second document, and that is the whole design.** This is `/brand`
 * printed. The composition is not written here and there is no template: the page's own
 * `@media print` block is the entire specification, so a visitor who hits Cmd-P on the
 * route gets the file we ship. Every other approach - a print-only route, a PDF library,
 * a templating layer - is a second copy of an identity document that would be wrong the
 * first day somebody edited one of them. It is the same reason `npm run og` photographs
 * `PostCover.astro` instead of drawing a card, and the reason this repo still has exactly
 * one image toolchain.
 *
 * **What the print block is actually for.** Rendered as it stands on screen, this page is
 * a **12.8 MB** PDF. Chrome rasterises every `position: fixed` layer *once per printed
 * page*, and the site has four: the ground gradient (`background-attachment: fixed`), the
 * noise dither, the fixed header, and the bloom. That is 132 image objects, 32 of them
 * full-page plates. With those four neutered in print the same document is **775 KB** and
 * 14 images. The obvious lever - `printBackground: false` - is not the answer: it drops
 * the ground and prints the site's light-on-dark type onto white paper.
 *
 * **`tagged` and `outline` are both on.** A 15-page document that a screen reader sees as
 * one undifferentiated stream is a 15-page document nobody can navigate, and `outline`
 * turns the eight `<h2>`s into the reader's own chapter list - the sidebar `/brand`
 * deliberately does not have on screen.
 *
 * **The page geometry lives in the CSS, not here.** `preferCSSPageSize` is on and this
 * script passes no `format` and no `margin`, so `@page` in `brand.astro` is the single
 * source of A4 and its margins. Passing them here as well would be two truths about the
 * same document, and Cmd-P would honour the other one.
 *
 * **On the running footer, and what Chrome cannot do.** Gate B said the footer would carry
 * the chapter name and the page number. Chrome's `footerTemplate` is handed only
 * `pageNumber`, `totalPages`, `title`, `url` and `date` - Blink implements none of CSS
 * Generated Content for Paged Media, so there is no `@page { @bottom-left }` and no
 * `position: running()` to put a chapter name in a margin box. The footer carries the
 * document and the page number; the chapter list is the PDF outline instead. Disclosed
 * rather than quietly dropped.
 *
 * **The manifest guards everything, which is new.** `build-press-assets.mjs` had to admit
 * its screenshot hashes guard nothing, because their inputs live in a repo CI does not
 * check out. Every input to this file is in this repo, so the hash below is a real guard:
 * edit a sentence in `brand.ts`, a token in `tokens.css` or a curve in `motion/tokens.ts`
 * without re-running this script, and `tests/unit/brand-pdf.spec.ts` fails the build.
 *
 * **Nothing here stamps a date.** A generated artefact that records the day it ran is a
 * different file on every run, which would make the committed PDF unreproducible and its
 * hash a record of nothing. What the document is current with is its inputs.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { colour } from '../src/lib/tokens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/brand');
const PDF_FILE = 'sonaru-brand.pdf';
const ORIGIN = process.env.BRAND_PDF_ORIGIN ?? 'http://localhost:4321';

/**
 * Everything the printed document is made of.
 *
 * The page renders no number of its own - it reads them from these files - so this list is
 * what "the document changed" means. A file that feeds `/brand` and is missing here is a
 * way for the PDF to go stale silently, which is the one failure this manifest exists to
 * prevent.
 */
const INPUTS = [
  /* Moved under the locale parameter at 8.11b with every other shipping page. The path is
   * part of the manifest's key, so this line and `public/brand/manifest.json` had to move
   * together - the guard failed on the old path, which is the manifest working. */
  'src/pages/[...locale]/brand.astro',
  'src/data/brand.ts',
  /*
   * Added at 8.11a, and the guard found the gap itself: the chapters, the misuse and
   * voice tables, the colour notes and every contrast label moved out of `brand.ts` into
   * the catalogue, so **the document's words now live in a file this list did not
   * watch**. Without this line, editing the identity's own prose would leave a 24-page
   * PDF saying the old thing with nothing failing - exactly the silent staleness the
   * manifest exists to prevent.
   */
  'copy/en/brand.ts',
  'src/layouts/Document.astro',
  'src/styles/tokens.css',
  'src/lib/contrast.ts',
  'src/lib/tokens.ts',
  'src/motion/tokens.ts',
  'src/components/brand/mark-geometry.ts',
  'src/components/brand/SonaruMark.astro',
  'src/components/brand/Wordmark.astro',
  'src/components/brand/ConstructionFigure.astro',
];

/* The dev toolbar is `position: fixed` over every page the dev server serves, which in a
 * printed document means it appears in the corner of all fifteen pages. `npm run og` hit
 * the same thing and hides it the same way. */
const HIDE_DEV_TOOLBAR = 'astro-dev-toolbar{display:none!important}';

const tokensCss = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');

/**
 * The running footer.
 *
 * Chrome renders this as its own little document with none of the site's CSS, so the type
 * and the colour have to be stated inline - but the colour is still *read* rather than
 * typed, because a hex literal in this file would be the one place on the whole brand
 * surface where a colour is not `tokens.css`'s to decide.
 *
 * The margin box sits outside the page box, and `<html>`'s background propagates to the
 * whole sheet, so this text is sitting on ink and has to be light.
 */
const footerTemplate = `<div style="
  width:100%;
  margin:0 16mm;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:7pt;
  letter-spacing:0.08em;
  text-transform:uppercase;
  color:${colour(tokensCss, 'mute-400')};
  display:flex;
  justify-content:space-between;
"><span>Sonaru - Brand</span><span class="pageNumber"></span></div>`;

/**
 * How many pages the document came out at.
 *
 * Read from the page tree's own `/Count` rather than by counting `/Type /Page` objects -
 * that string also matches `/Type /Pages`, and a page-count that is quietly one too high
 * is exactly the kind of number this project does not print.
 */
function pageCount(buffer) {
  const counts = [
    ...buffer.toString('latin1').matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count (\d+)/g),
  ];
  if (counts.length === 0) throw new Error('no page tree in the generated PDF');
  return Math.max(...counts.map((match) => Number(match[1])));
}

function hashOf(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const inputs = Object.fromEntries(
  INPUTS.map((path) => {
    const full = join(ROOT, path);
    if (!existsSync(full)) throw new Error(`${path} is a declared input and does not exist`);
    return [path, hashOf(readFileSync(full, 'utf8'))];
  }),
);

const browser = await chromium.launch();
const page = await browser.newPage();

const response = await page.goto(`${ORIGIN}/brand`, { waitUntil: 'networkidle' });
if (response === null || !response.ok()) {
  throw new Error(`${ORIGIN}/brand did not load - is \`npm run dev\` running?`);
}
await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });

/* Fonts are the document's type. Printing before they resolve sets fifteen pages in the
 * metrics-matched fallback `build-fonts.mjs` exists to make invisible. */
await page.evaluate(() => document.fonts.ready);

const path = join(OUT, PDF_FILE);
await page.pdf({
  path,
  preferCSSPageSize: true,
  printBackground: true,
  tagged: true,
  outline: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate,
});

await browser.close();

const buffer = readFileSync(path);
const pages = pageCount(buffer);

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify({ file: PDF_FILE, bytes: buffer.length, pages, inputs }, null, 2)}\n`,
);

process.stdout.write(
  `  wrote public/brand/${PDF_FILE} - ${(buffer.length / 1024).toFixed(0)} KB, ${pages} pages\n` +
    `  wrote public/brand/manifest.json\n`,
);

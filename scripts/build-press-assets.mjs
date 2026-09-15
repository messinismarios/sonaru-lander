/**
 * The press kit - phases.md 8.10b.
 *
 * Run: `npm run press`  (needs the dev server: `npm run dev`)
 *
 * Writes everything `/press` hands out:
 *
 *   public/press/sonaru-mark[-light].svg          the mark, from the geometry module
 *   public/press/sonaru-mark[-light]-512|1024.png rasterised from the camera stand
 *   public/press/sonaru-lockup[-light]-1024|2048.png
 *   public/press/screens/<id>.jpg                 720 wide - what the page shows
 *   public/press/screens/<id>-full.jpg            source resolution - what it links to
 *   public/press/sonaru-press-kit.zip             all of the above, in one download
 *   public/press/manifest.json                    bytes and dimensions, read by the page
 *
 * **The rasters are photographs of the site's own components**, taken from
 * `/og/press-assets` - the reason is in that file's header. The SVG is drawn from
 * `mark-geometry.ts` through `lib/brand-svg.mjs`, because the mark alone *is* geometry;
 * the lockup is not, and there is no vector lockup in this kit. That was decided at Gate B
 * rather than skipped: the wordmark is live Outfit text, and `design-system.md` §9.5 says
 * outlining it was **dropped, not done, and must not be reopened as cleanup**.
 *
 * **The screenshots come from the iOS repo and are copied, not linked.** `CLAUDE.md`'s
 * rule is that a backend or client deploy can never break this site; a build that reached
 * across the workspace would be exactly that. So this script needs the sibling checkout,
 * the committed output does not, and `npm run build` never runs this file.
 *
 * **On the manifest and what it can honestly guard.** `npm run og` hashes what each cover
 * was generated *from*, so editing a post's hook without re-running it fails the build.
 * The same trick works here for the logo files - their input is `PRESET` plus the two
 * colourways, both of which live in this repo - and `tests/unit/press-assets.spec.ts`
 * recomputes that hash. **It cannot work for the screenshots**: their input is five PNGs in
 * a repo CI does not check out, so the manifest records their hashes for a human reading a
 * diff and the test asserts only that the files exist and are non-empty. A guard that
 * claimed more than that would be a guard that fails on a clean checkout.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { markSvg, COLOURWAYS, logoHash } from './lib/brand-svg.mjs';
import { perceptuallyEqual } from './lib/image-compare.mjs';

const { PRESET } = await import('../src/components/brand/mark-geometry.ts');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/press');
const SCREENS_OUT = join(OUT, 'screens');
const ORIGIN = process.env.PRESS_ORIGIN ?? 'http://localhost:4321';
const IOS_SCREENSHOTS =
  process.env.IOS_SCREENSHOTS ?? join(ROOT, '../sonaru-frontend-ios/docs/app-store/screenshots');

/**
 * What the page displays.
 *
 * **Sized from the layout rather than from a guess.** The gallery is five phones across
 * `--measure-wide`, so a thumbnail is ~130px at 1440 and ~159px at 390 (two up) - the
 * widest it is ever painted. 360 is comfortably 2x that. Gate B planned 720, which was 2x
 * of a column the gallery turned out not to give: five images at 5.5x their painted size,
 * 272 KB to render 130px-wide pictures, and precisely the "properly size images" audit
 * that costs the Lighthouse 100 `acceptance-criteria.md` §3 requires.
 */
const DISPLAY_WIDTH = 360;
/* Measured at Gate B on `02-feed.png`: q80 at 720 wide is 75 KB against 896 KB for the
 * same pixels as PNG, and the UI type is still crisp. q92 is for the full-res download,
 * where a journalist may crop into it. */
const DISPLAY_QUALITY = 0.8;
const FULL_QUALITY = 0.92;

const HIDE_DEV_TOOLBAR = 'astro-dev-toolbar{display:none!important}';

/** The five captures, in the order the app introduces them. */
const SCREENS = [
  { id: 'welcome', file: '01-welcome.png' },
  { id: 'feed', file: '02-feed.png' },
  { id: 'search', file: '03-search.png' },
  { id: 'auto-add', file: '04-autoadd-settings.png' },
  { id: 'pro', file: '05-subscription-paywall.png' },
];

const written = [];
const manifest = { logoHash: logoHash(PRESET, COLOURWAYS), files: {} };
let anyChanged = false;

mkdirSync(SCREENS_OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
/** A scratch page used only to decode images - never photographed. */
const utility = await browser.newPage();

/** Width and height of an encoded image, read by decoding it rather than parsing headers. */
async function dimensions(buffer, mime) {
  return await utility.evaluate(
    async ([data, type]) =>
      await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.src = `data:${type};base64,${data}`;
      }),
    [buffer.toString('base64'), mime],
  );
}

/**
 * Write, unless what is already committed is the same picture.
 *
 * The byte comparison catches the common case. The perceptual one catches the lockups,
 * which are **not** byte-stable between runs: they are photographed at a fractional
 * `deviceScaleFactor` (1024 divided by whatever "Sonaru" measures at 128px), and subpixel
 * text antialiasing on a curve does not reproduce exactly. Without it, `npm run press`
 * rewrote two PNGs and the megabyte zip on every single invocation - measured by running
 * it three times over, not predicted.
 */
async function write(relative, buffer, mime) {
  const path = join(OUT, relative);
  const unchanged =
    existsSync(path) &&
    (readFileSync(path).equals(buffer) ||
      (mime !== 'image/svg+xml' &&
        (await perceptuallyEqual(utility, readFileSync(path), buffer, mime))));
  if (!unchanged) {
    writeFileSync(path, buffer);
    anyChanged = true;
  }
  /*
   * **Measure the file that is served, not the buffer that was discarded.** When the
   * perceptual comparison above says "same picture", the freshly generated buffer is thrown
   * away and the committed file stays - so recording `buffer.length` here describes a file
   * nobody can download. The two lockups drifted by 1 and 2 bytes that way, which
   * `fileWeight()` rounds out of sight; the tolerance is 0.5% of pixels, so the next drift
   * is not bounded to a couple of bytes, and `/press` prints these numbers as download
   * weights.
   */
  const served = unchanged ? readFileSync(path) : buffer;
  const size = mime === 'image/svg+xml' ? null : await dimensions(served, mime);
  manifest.files[relative] = {
    bytes: served.length,
    ...(size === null ? {} : { width: size.width, height: size.height }),
  };
  written.push(`${unchanged ? 'unchanged' : 'wrote    '} public/press/${relative}`);
}

/* ---- the logo files ------------------------------------------------------------- */

for (const [name, colours] of Object.entries(COLOURWAYS)) {
  const suffix = name === 'dark' ? '' : '-light';
  await write(
    `sonaru-mark${suffix}.svg`,
    Buffer.from(markSvg({ size: 512, ...colours }), 'utf8'),
    'image/svg+xml',
  );
}

const stand = await browser.newPage({ viewport: { width: 1600, height: 900 } });
try {
  await stand.goto(`${ORIGIN}/og/press-assets`, { waitUntil: 'networkidle' });
} catch (error) {
  await browser.close();
  process.stderr.write(
    `Could not reach ${ORIGIN}/og/press-assets - start the dev server first (npm run dev).\n` +
      `${String(error)}\n`,
  );
  process.exit(1);
}
/* The lockup *is* the type. Without this the first run against a cold server photographs
 * Satoshi, which is the fallback the wordmark degrades to rather than a failure. */
await stand.evaluate(() => document.fonts.ready);
await stand.addStyleTag({ content: HIDE_DEV_TOOLBAR });
await stand.close();

/**
 * One raster, at an exact delivered width.
 *
 * The mark is square and sized in px, so its target is a clean multiple. The lockup's width
 * is whatever "Sonaru" measures at 128px in Outfit - so the shot's natural width is read
 * off the page and the target is reached with `deviceScaleFactor`, which is a real
 * higher-resolution render rather than an upscale of a small one.
 */
async function shoot(shotName, targetWidth) {
  const measurePage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await measurePage.goto(`${ORIGIN}/og/press-assets`, { waitUntil: 'networkidle' });
  await measurePage.evaluate(() => document.fonts.ready);
  const natural = await measurePage
    .locator(`[data-press-shot="${shotName}"]`)
    .evaluate((element) => element.getBoundingClientRect().width);
  await measurePage.close();

  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: targetWidth / natural,
  });
  await page.goto(`${ORIGIN}/og/press-assets`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
  const buffer = await page
    .locator(`[data-press-shot="${shotName}"]`)
    .screenshot({ type: 'png', omitBackground: true });
  await page.close();
  return buffer;
}

for (const name of ['dark', 'light']) {
  const suffix = name === 'dark' ? '' : '-light';
  for (const width of [512, 1024]) {
    await write(
      `sonaru-mark${suffix}-${width}.png`,
      await shoot(`mark-${name}`, width),
      'image/png',
    );
  }
  for (const width of [1024, 2048]) {
    await write(
      `sonaru-lockup${suffix}-${width}.png`,
      await shoot(`lockup-${name}`, width),
      'image/png',
    );
  }
}

/* ---- the screenshots ------------------------------------------------------------ */

if (!existsSync(IOS_SCREENSHOTS)) {
  await browser.close();
  process.stderr.write(
    `No screenshots at ${IOS_SCREENSHOTS}.\nThey live in the sibling iOS checkout; set ` +
      `IOS_SCREENSHOTS to point elsewhere. The committed output does not need them - only ` +
      `regenerating does.\n`,
  );
  process.exit(1);
}

/**
 * PNG in, JPEG out, through the canvas of the browser that is already running.
 *
 * `sips` would do this in one line on this machine and exist nowhere else; adding a Node
 * image library would be the second toolchain 8.1 refused. Chrome is already a dependency
 * of the test suite, so it is the one that converts.
 */
async function toJpeg(png, target, quality) {
  const encoded = await utility.evaluate(
    async ([data, size, q]) =>
      await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size.width;
          canvas.height = size.height;
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', q).split(',')[1]);
        };
        image.src = `data:image/png;base64,${data}`;
      }),
    [png.toString('base64'), target, quality],
  );
  return Buffer.from(encoded, 'base64');
}

/*
 * Every capture is delivered at one width, and it is the narrowest of the five.
 *
 * `01-welcome.png` is 1179x2556 where the other four are 1178x2556 - a one-pixel
 * inconsistency in the source set that would put one phone in the row at a different
 * aspect to its neighbours. Both dimensions are therefore stated rather than derived: at a
 * width alone, `01` came out 2554 tall against the others' 2556 and the gallery's row of
 * phones was a pixel ragged. Forcing the majority size stretches `01` by 0.08%, which is
 * two pixels over a phone's height and nothing an eye can find. **The App Store has the same set and a bigger version of the problem** - see
 * 8.10b's Gate B note and `sonaru-frontend-ios/docs/app-store/metadata.md`; fixing it
 * there is the iOS repo's, not this script's.
 */
const FULL = { width: 1178, height: 2556 };
/* The gallery's own size, at 2x the ~360px column each phone gets. */
const DISPLAY = { width: DISPLAY_WIDTH, height: 781 };

for (const { id, file } of SCREENS) {
  const source = readFileSync(join(IOS_SCREENSHOTS, file));
  await write(`screens/${id}-full.jpg`, await toJpeg(source, FULL, FULL_QUALITY), 'image/jpeg');
  await write(`screens/${id}.jpg`, await toJpeg(source, DISPLAY, DISPLAY_QUALITY), 'image/jpeg');
  manifest.files[`screens/${id}-full.jpg`].sourceSha = createHash('sha256')
    .update(source)
    .digest('hex')
    .slice(0, 16);
}

await browser.close();

/* ---- the zip --------------------------------------------------------------------- */

const ZIP = 'sonaru-press-kit.zip';
/*
 * The logos and the full-size screenshots - not the 720px versions, which exist so the
 * gallery on the page loads quickly and are no use to anybody downloading a kit. Shipping
 * both put a quarter of a megabyte of thumbnails inside a one-megabyte download.
 */
const members = Object.keys(manifest.files).filter(
  (file) => !file.startsWith('screens/') || file.endsWith('-full.jpg'),
);

/*
 * Rebuilt only when a member changed. `zip` stores each entry's mtime, so an unconditional
 * run rewrites a 1 MB binary on every invocation and the repo grows a diff nobody can read
 * - the same churn `npm run og` fixed for the covers, in a format where it cannot be
 * compared pixel by pixel.
 */
if (anyChanged || !existsSync(join(OUT, ZIP))) {
  execFileSync('zip', ['-q', '-X', '-r', ZIP, ...members], { cwd: OUT });
  written.push(`wrote     public/press/${ZIP}`);
} else {
  written.push(`unchanged public/press/${ZIP}`);
}
manifest.files[ZIP] = { bytes: readFileSync(join(OUT, ZIP)).length };

writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${written.join('\n')}\n`);

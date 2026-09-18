/**
 * Per-post cover images - phases.md 8.9c.
 *
 * Run: `npm run og`  (needs the dev server: `npm run dev`)
 *
 * Each post gets two files:
 *
 *   public/og/<slug>.jpg       1200x600 - the `og:image`, and the card's 2x source
 *   public/og/<slug>-640.jpg    640x320 - what the index card actually loads
 *
 * **Plus `.avif` and `.webp` of both**, added for SEO audit M1 (owner, 2026-09-15): the index
 * card is a `<picture>` that offers them first and keeps the JPEG as its fallback. The JPEG is
 * still the `og:image`, because social scrapers read JPEG and PNG. The modern formats are
 * encoded with sharp from a lossless capture of the same frozen frame, since a screenshot
 * cannot be taken as AVIF or WebP; the JPEGs are shot exactly as before.
 *
 * **And one card for the whole site**, added at 8.10a:
 *
 *   public/og/site.jpg         1200x600 - what every route that is not a post unfurls with
 *
 * It is the same composition photographed from `/og/site`, so there is one cover design on
 * this site rather than two. It replaced `public/og-default.png`, which
 * `build-brand-assets.mjs` had generated since 8.1 and **nothing had ever referenced** - a
 * 281 KB PNG carrying `system-ui` type and a line of copy that appears nowhere on the site.
 *
 * **JPEG, not PNG, and that was measured rather than assumed.** The first run wrote PNGs
 * at **420 KB each** - six files, 2.5 MB committed to the repo, against a Gate B budget of
 * 80 KB. A cover is a smooth gradient under a line of type, which is the worst case for a
 * lossless format and the best case for a lossy one: the same picture at quality 86 is
 * around a twentieth of the size with no visible difference in the type.
 *
 * They are **one artefact used twice**, which is the direction the owner chose at Gate A
 * from three treatments built at `/blog/lab`. The composition is not written here: it is
 * `src/components/blog/PostCover.astro`, rendered by `/blog/og/<slug>` and photographed
 * through the Chrome Playwright already drives - the same technique `npm run brand` uses
 * for the app icons, and the reason there is no second image toolchain in this repo.
 *
 * **The manifest is the point of the rest of this file.** A generated file committed
 * alongside the source it was generated from goes stale the first time somebody edits a
 * hook and does not re-run the script - and a stale cover is wrong in the one place nobody
 * looks, which is somebody else's timeline. So every run records a hash of what each cover
 * was generated *from*, and `tests/unit/og-manifest.spec.ts` recomputes it and fails the
 * build if they disagree. Exactly the discipline `mark-geometry.ts` has with `npm run
 * brand`, which is where the idea comes from.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { perceptuallyEqual } from './lib/image-compare.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Every path this run touched, for the summary at the end. */
const written = [];
const OUT = join(ROOT, 'public/og');
const ORIGIN = process.env.OG_ORIGIN ?? 'http://localhost:4321';
/* See the note on JPEG in this file's header. 86 was the lowest step with no visible
 * softening on the hook's counters at 1200 wide. */
const JPEG_QUALITY = 86;

/*
 * The dev toolbar is `position: fixed` over every page the dev server serves, and an
 * element screenshot captures whatever is composited over that element - so the first run
 * wrote three covers with Astro's toolbar pill sitting in the bottom of the picture. It is
 * hidden rather than disabled in `astro.config.mjs`, because the toolbar is wanted
 * everywhere except inside the camera.
 */
const HIDE_DEV_TOOLBAR = 'astro-dev-toolbar{display:none!important}';

/** Kept in step with `tests/unit/blog-inventory.spec.ts`, which recomputes it. */
export function coverHash({ hook, act }) {
  return createHash('sha256').update(`${hook} ${act}`).digest('hex').slice(0, 16);
}

/**
 * The posts, read from the running site rather than from the content collection.
 *
 * The collection lives behind `astro:content`, which only resolves inside Astro's own
 * module graph - a plain Node script cannot import it. The dev server is already required
 * to take the screenshots, so it is also where the list comes from: `/blog` renders every
 * published post and nothing else, which makes it the same source of truth the index uses.
 */
async function publishedSlugs(page) {
  await page.goto(`${ORIGIN}/blog`, { waitUntil: 'networkidle' });
  return await page.$$eval('.index a[href^="/blog/"]', (links) =>
    links.map((a) => a.getAttribute('href').replace('/blog/', '')),
  );
}

const browser = await chromium.launch({ channel: 'chrome' });
/*
 * `reducedMotion: 'reduce'` is not an accessibility gesture here, it is an attempt at
 * **determinism**: `BloomField`'s orbs drift on 25/34/43-second loops, so without it every
 * run photographs a different frame and `npm run og` rewrites six files whether or not
 * anything changed. A generated artefact that churns is one nobody can review in a diff.
 *
 * **It is not sufficient on its own, and finding out why turned up a real defect.** The
 * component's reduced-motion block sets `animation: none` on `.orb > i` (specificity
 * 0-1-1) while the animation is declared on `.orb.a > i` (0-2-1), so the override loses
 * and the blooms keep drifting under reduced motion - on every route, not just this one.
 * Measured, not inferred: 18 running animations on `/` with the media feature matching.
 * That is a violation of the appearance approved at 8.1 and it is reported rather than
 * fixed here, because `BloomField` is shared by five sections whose appearance is frozen.
 *
 * So `freezeAnimations` below pins every animation to its first frame explicitly. It is
 * correct whether or not the defect is ever fixed, which is what a generator wants.
 */
const page = await browser.newPage({
  viewport: { width: 1200, height: 600 },
  reducedMotion: 'reduce',
});

/** Every animation on the page held at time zero, so the shot is the same shot each run. */
const freezeAnimations = () =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.currentTime = 0;
      animation.pause();
    }
  });

/*
 * Freezing the animations makes the covers *visually* identical between runs. It does not
 * make them byte-identical, and chasing that further would be chasing the wrong thing:
 * two consecutive renders of the same frozen frame differ in **0.038% of pixels by at most
 * 8/255**, which is GPU rasterisation noise on a large blurred gradient - invisible, and
 * amplified into ~31 KB of byte difference by JPEG's entropy coding.
 *
 * So the generator compares what it just shot against what is committed and keeps the
 * committed file when the two are the same picture. Without this, `npm run og` rewrites six
 * binaries on every run and the repo grows a diff nobody can read. The staleness guard is
 * unaffected: `manifest.json` hashes the post's hook and palette, so a cover that *should*
 * change still fails the test until it does.
 */
const comparePage = await browser.newPage();

const MIME = { jpg: 'image/jpeg', avif: 'image/avif', webp: 'image/webp' };

async function writeCover(file, buffer) {
  const path = join(OUT, file);
  const mime = MIME[file.split('.').pop()];
  if (
    existsSync(path) &&
    (await perceptuallyEqual(comparePage, readFileSync(path), buffer, mime))
  ) {
    written.push(`unchanged public/og/${file}`);
    return;
  }
  writeFileSync(path, buffer);
  written.push(`public/og/${file}`);
}

/*
 * AVIF and WebP of one lossless capture. The qualities are the smallest that keep the hook's
 * type as crisp as the q86 JPEG beside it - the same test that picked 86.
 */
const AVIF_QUALITY = 60;
const WEBP_QUALITY = 82;

async function writeModernCovers(base, png) {
  await writeCover(`${base}.avif`, await sharp(png).avif({ quality: AVIF_QUALITY }).toBuffer());
  await writeCover(`${base}.webp`, await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer());
}

let slugs;
try {
  slugs = await publishedSlugs(page);
} catch (error) {
  await browser.close();
  process.stderr.write(
    `Could not reach ${ORIGIN}/blog - start the dev server first (npm run dev).\n${String(error)}\n`,
  );
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const manifest = {};

for (const slug of slugs) {
  await page.setViewportSize({ width: 1200, height: 600 });
  await page.goto(`${ORIGIN}/blog/og/${slug}`, { waitUntil: 'networkidle' });
  /*
   * The cover's type is the whole picture, so the web font has to be there before the
   * shutter. `document.fonts.ready` resolves once every face used on the page has loaded;
   * without it the first run against a cold dev server photographs the fallback.
   */
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
  await freezeAnimations();

  await writeCover(
    `${slug}.jpg`,
    await page.locator('[data-og-stage]').screenshot({ type: 'jpeg', quality: JPEG_QUALITY }),
  );
  await writeModernCovers(slug, await page.locator('[data-og-stage]').screenshot({ type: 'png' }));

  const source = await page.evaluate(() => ({
    hook: document.querySelector('[data-og-stage] .cover-hook')?.textContent?.trim() ?? '',
    act: document.querySelector('[data-og-stage] .bloom')?.getAttribute('data-act') ?? '',
  }));
  manifest[slug] = coverHash(source);

  /*
   * The 640 is a second screenshot at the smaller size rather than a resize of the first,
   * because the cover's type is sized in `cqw` - it is the same composition re-rendered at
   * the size it will be seen at, not a downsample of a larger one.
   */
  await page.setViewportSize({ width: 640, height: 320 });
  /*
   * `!important` is load-bearing. The stage's size comes from a scoped `.stage` rule,
   * which Astro compiles to `.stage.astro-<hash>` - specificity 0-2-0 against this
   * attribute selector's 0-1-0. Without it the override silently loses and the "640"
   * file is a second copy of the 1200, which is exactly what the first run produced.
   */
  await page.addStyleTag({
    content: `[data-og-stage]{width:640px!important;height:320px!important}${HIDE_DEV_TOOLBAR}`,
  });
  await page.evaluate(() => document.fonts.ready);
  await freezeAnimations();
  await writeCover(
    `${slug}-640.jpg`,
    await page.locator('[data-og-stage]').screenshot({ type: 'jpeg', quality: JPEG_QUALITY }),
  );
  await writeModernCovers(
    `${slug}-640`,
    await page.locator('[data-og-stage]').screenshot({ type: 'png' }),
  );
}

/*
 * The site card - one photograph of the same composition, carrying the site's claim rather
 * than a post's hook. Every route that is not a post unfurls with this.
 *
 * **Only the 1200 is written.** A post's cover needs a 640 because the blog index actually
 * renders it at that size; this one is never on a page, so a second file would be a second
 * thing to keep in step for no reader.
 *
 * It goes in the manifest like a post does, and for the same reason: the claim lives in
 * `copy/en/home.ts`, and editing it without re-running this script would leave a picture
 * in somebody's timeline saying something the site no longer says.
 */
await page.setViewportSize({ width: 1200, height: 600 });
await page.goto(`${ORIGIN}/og/site`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
await freezeAnimations();

await writeCover(
  'site.jpg',
  await page.locator('[data-og-stage]').screenshot({ type: 'jpeg', quality: JPEG_QUALITY }),
);

manifest.site = coverHash(
  await page.evaluate(() => ({
    hook: document.querySelector('[data-og-stage] .cover-hook')?.textContent?.trim() ?? '',
    act: document.querySelector('[data-og-stage] .bloom')?.getAttribute('data-act') ?? '',
  })),
);

/*
 * The route cards - SEO audit M12. `/pricing`, `/waitlist`, `/blog`, `/changelog` and
 * `/press` unfurl with their own picture instead of borrowing the site's. The list, the
 * line each one carries and its palette are `src/data/og-cards.ts`, read here through
 * `/og/route/cards.json` for the reason `publishedSlugs` reads `/blog`: this script is
 * plain Node and the module is TypeScript, so the running site is where they meet.
 *
 * **Only the 1200, like the site card.** These are never rendered on a page, so a 640
 * would be a second file to keep in step for no reader.
 */
const routeCards = await page.evaluate(
  async (origin) => await (await fetch(`${origin}/og/route/cards.json`)).json(),
  ORIGIN,
);

for (const slug of routeCards) {
  await page.goto(`${ORIGIN}/og/route/${slug}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
  await freezeAnimations();

  await writeCover(
    `${slug}.jpg`,
    await page.locator('[data-og-stage]').screenshot({ type: 'jpeg', quality: JPEG_QUALITY }),
  );

  manifest[slug] = coverHash(
    await page.evaluate(() => ({
      hook: document.querySelector('[data-og-stage] .cover-hook')?.textContent?.trim() ?? '',
      act: document.querySelector('[data-og-stage] .bloom')?.getAttribute('data-act') ?? '',
    })),
  );
}

await browser.close();

/*
 * Files for posts that no longer exist are removed, so `public/og/` cannot accumulate
 * covers for deleted or renamed drafts - a stray PNG is a URL that keeps answering after
 * the post it belonged to is gone. `site.jpg` survives it by being in the manifest, which
 * is what this loop tests against - it is not a special case here.
 */
for (const file of readdirSync(OUT)) {
  if (file === 'manifest.json') continue;
  const slug = file.replace(/(-640)?\.(jpg|png|avif|webp)$/, '');
  if (!(slug in manifest)) {
    rmSync(join(OUT, file));
    written.push(`removed public/og/${file}`);
  }
}

const manifestPath = join(OUT, 'manifest.json');
const next = `${JSON.stringify(manifest, null, 2)}\n`;
let previous = '';
try {
  previous = readFileSync(manifestPath, 'utf8');
} catch {
  /* first run */
}
writeFileSync(manifestPath, next);

const lines = written.map((w) =>
  w.startsWith('removed') || w.startsWith('unchanged') ? `  ${w}` : `  wrote ${w}`,
);
lines.push(`  wrote public/og/manifest.json${previous === next ? ' (unchanged)' : ''}`);
process.stdout.write(`${lines.join('\n')}\n`);

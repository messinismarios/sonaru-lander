/**
 * Brand assets - the favicon and the app icons.
 *
 * Run: npm run brand
 *
 * Everything here is derived from `src/components/brand/mark-geometry.ts`, the same module
 * the site renders from. Nothing embeds its own copy of the path data, so a change to the
 * mark regenerates the whole set. The mark is final as of 2026-09-08, which makes that a
 * property worth keeping rather than one still being relied on.
 *
 * PNGs are rasterised through the Chrome that Playwright already drives for the test
 * suite; there is no separate image toolchain to install or keep current.
 *
 * **It no longer builds an OG card.** It built `public/og-default.png` from 8.1 until
 * 8.10a, and **nothing ever referenced the file** - 281 KB of PNG carrying `system-ui`
 * type and the line "Never miss a beat.", which is the filler string from `/specimen` and
 * appears nowhere on the site. Its own comment said the real card would land with the OG
 * system in 8.10, and it has: `scripts/build-og-images.mjs` photographs `/og/site`, so the
 * site card and the post covers are one composition rather than two that drift.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { markSvg, WHITE, PLUM_300 } from './lib/brand-svg.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Imported straight from the TypeScript source under Node's type stripping, so there is no
 * generated mirror of the geometry to fall out of date. This is the same module the site
 * renders from - refine the mark in /logo/lab, re-run, and every asset follows.
 */
const { PRESET, sPath, sonarPath, fitViewBox } =
  await import('../src/components/brand/mark-geometry.ts');

/*
 * The mark's *rendering* moved to `lib/brand-svg.mjs` at 8.10b, for the reason its geometry
 * lives in one module: the press kit needs the same drawing in a second colourway, and two
 * scripts each carrying their own copy of it is how a favicon and a press asset come to
 * disagree. The colours are imported from there too, so there is one `--color-plum-300` in
 * this directory rather than one per generator.
 */
const INK = '#0b0a0b';
const PLUM_800 = '#61053f';
const PLUM_950 = '#240017';

/** App icons sit on the brand ground; a transparent icon reads as a hole on iOS. */
function iconHtml(px) {
  const box = fitViewBox(PRESET);
  return `<!doctype html><body style="margin:0">
<div style="width:${px}px;height:${px}px;display:grid;place-items:center;
  background:linear-gradient(160deg, ${PLUM_800}, ${PLUM_950})">
  <svg viewBox="${box}" width="${Math.round(px * 0.62)}" height="${Math.round(px * 0.62)}">
    <g fill="none" stroke="${WHITE}" stroke-linecap="round">
      <path d="${sonarPath(PRESET)}" stroke="${PLUM_300}" stroke-width="${PRESET.sonarStroke}" opacity="${PRESET.sonarOpacity}"/>
      <path d="${sPath(PRESET)}" stroke-width="${PRESET.stroke}"/>
    </g>
  </svg>
</div></body>`;
}

mkdirSync(join(ROOT, 'public/icons'), { recursive: true });
writeFileSync(join(ROOT, 'public/favicon.svg'), markSvg({ size: 32 }));

const browser = await chromium.launch({ channel: 'chrome' });
const shoot = async (html, width, height, out) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: join(ROOT, out), omitBackground: false });
  await page.close();
  return out;
};

const written = [join('public', 'favicon.svg')];
for (const [px, out] of [
  [180, 'public/icons/apple-touch-icon.png'],
  [192, 'public/icons/icon-192.png'],
  [512, 'public/icons/icon-512.png'],
]) {
  written.push(await shoot(iconHtml(px), px, px, out));
}
await browser.close();

writeFileSync(
  join(ROOT, 'public/site.webmanifest'),
  `${JSON.stringify(
    {
      name: 'Sonaru',
      short_name: 'Sonaru',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: INK,
      background_color: INK,
      display: 'standalone',
    },
    null,
    2,
  )}\n`,
);
written.push(join('public', 'site.webmanifest'));

process.stdout.write(`${written.map((w) => `  wrote ${w}`).join('\n')}\n`);

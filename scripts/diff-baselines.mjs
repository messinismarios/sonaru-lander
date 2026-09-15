/* eslint-disable no-undef --
 * The two callbacks passed to `page.evaluate` run inside Chrome, where `Image`,
 * `document` and `HTMLCanvasElement` are the environment. ESLint type-checks this file
 * against Node's globals only and cannot tell the two scopes apart.
 */

/**
 * Compares two directories of Playwright visual baselines, image by image.
 *
 * Written at 8.9b, after the same discipline had been needed four times and got away from
 * us twice. `SHOT`'s `maxDiffPixelRatio: 0.02` is ~26,000 pixels at 1440x900, so a real
 * design change can be *smaller than the tolerance* and leave the suite green - 8.8's
 * removed header link did exactly that, and 8.6's 625px app icon did it before that. The
 * answer both times was `--update-snapshots=all`, which then raises the opposite question:
 * what actually changed in the images it just overwrote?
 *
 * This answers that question. Copy the baselines somewhere first, regenerate with
 * `--update-snapshots=all`, then run:
 *
 *     node scripts/diff-baselines.mjs <before-dir> <after-dir>
 *
 * It reports, per image, the pixels that differ and the first and last row they occur on
 * - which is what turns "the pricing page changed" into "the pricing page changed only in
 * the footer's last 150 rows", the difference between an approved change and an unnoticed
 * regression in a frozen section.
 *
 * It is not part of `npm test`: it compares two states of the working tree, which only a
 * person mid-change has.
 */
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/** Per-channel difference below which two pixels are the same. Chrome's own AA noise. */
const CHANNEL_TOLERANCE = 3;

const [beforeDir, afterDir] = process.argv.slice(2);

if (beforeDir === undefined || afterDir === undefined) {
  process.stderr.write('usage: node scripts/diff-baselines.mjs <before-dir> <after-dir>\n');
  process.exit(2);
}

const say = (line) => process.stdout.write(`${line}\n`);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

/**
 * Decodes both PNGs onto same-sized canvases and walks them.
 *
 * In the browser because that is the PNG decoder this repo already depends on; adding an
 * image library to compare two screenshots would be a dependency for a debugging tool.
 */
async function compare(before, after) {
  return page.evaluate(
    async ([a, b, tolerance]) => {
      const load = (data) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = `data:image/png;base64,${data}`;
        });

      const [imageA, imageB] = await Promise.all([load(a), load(b)]);
      const width = Math.max(imageA.width, imageB.width);
      const height = Math.max(imageA.height, imageB.height);

      const pixels = (image) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, width, height).data;
      };

      const dataA = pixels(imageA);
      const dataB = pixels(imageB);

      let changed = 0;
      let top = null;
      let bottom = null;

      for (let y = 0; y < height; y += 1) {
        let rowChanged = false;
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (
            Math.abs(dataA[i] - dataB[i]) > tolerance ||
            Math.abs(dataA[i + 1] - dataB[i + 1]) > tolerance ||
            Math.abs(dataA[i + 2] - dataB[i + 2]) > tolerance
          ) {
            changed += 1;
            rowChanged = true;
          }
        }
        if (rowChanged) {
          if (top === null) top = y;
          bottom = y;
        }
      }

      return {
        before: { width: imageA.width, height: imageA.height },
        after: { width: imageB.width, height: imageB.height },
        changed,
        top,
        bottom,
      };
    },
    [before.toString('base64'), after.toString('base64'), CHANNEL_TOLERANCE],
  );
}

const suites = readdirSync(beforeDir).filter((name) => name.endsWith('-snapshots'));
let compared = 0;
let differing = 0;

for (const suite of suites) {
  for (const file of readdirSync(`${beforeDir}/${suite}`).filter((n) => n.endsWith('.png'))) {
    const after = `${afterDir}/${suite}/${file}`;
    if (!existsSync(after)) {
      say(`GONE     ${suite}/${file}`);
      differing += 1;
      continue;
    }

    const result = await compare(
      readFileSync(`${beforeDir}/${suite}/${file}`),
      readFileSync(after),
    );
    compared += 1;

    const resized =
      result.before.width !== result.after.width || result.before.height !== result.after.height;

    if (result.changed > 0 || resized) {
      differing += 1;
      say(`CHANGED  ${suite}/${file}`);
      say(
        `         ${result.before.width}x${result.before.height} -> ${result.after.width}x${result.after.height}` +
          `  ${result.changed} px  rows ${result.top}..${result.bottom}`,
      );
    }
  }
}

say(`\n${compared} baselines compared, ${differing} changed.`);
await browser.close();

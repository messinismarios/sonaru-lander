/**
 * Derives each showcase cover's screen tint and writes it back into the manifest.
 *
 * The iOS app does not compute this in the client: the feed payload carries a
 * `releaseColor` per release (`SonaruCore/Models/FeedModels.swift`) and
 * `FeedView.updateActiveColor` hands it straight to the background controller. The colour
 * is *data attached to the release*, not a decision the UI makes.
 *
 * This script is the web equivalent. It runs at build time, never in the browser -
 * `design-system.md` §6 is explicit that artwork colours are "extracted at build time and
 * baked into the content layer, never computed in the browser at runtime", because a
 * canvas read of three covers on the critical path is exactly the kind of thing that costs
 * the performance bar.
 *
 * Run: npm run showcase
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src/content/showcase/releases.json');
const ARTWORK_DIR = join(ROOT, 'src/assets/showcase/releases');

/**
 * Lightness the derived tint is normalised to, as a fraction.
 *
 * `--plum-900` (#43002B), the ground this tint replaces, sits at L=0.132. Every cover's
 * colour is pulled to the same depth so the screen stays a *ground* whatever the artwork
 * is: a pale cover must not produce a pale screen that the white type then fails against.
 */
const GROUND_LIGHTNESS = 0.132;

/**
 * Saturation floor below which a cover is treated as achromatic. A black-and-white cover
 * has no colour to travel to, and inventing one would be a lie about the artwork.
 */
const ACHROMATIC_BELOW = 0.08;

/** The neutral an achromatic cover falls back to - a desaturated cousin of the ground. */
const ACHROMATIC_TINT = '#241f22';

/**
 * Picks the colour a listener would say the cover *is*.
 *
 * Not the average: averaging a black-and-white sleeve with one yellow disc returns grey,
 * which is true of the pixels and false about the artwork. Instead every pixel is binned
 * into a coarse RGB grid and each bin scored by how much of the cover it covers *and* how
 * saturated it is, so a small vivid area can beat a large flat one - which is how album
 * art actually reads.
 *
 * @param {Buffer} raw RGB pixel data, 3 bytes per pixel.
 * @returns {{r: number, g: number, b: number, saturation: number}}
 */
function vibrantColor(raw) {
  /** @type {Map<number, {r: number, g: number, b: number, count: number}>} */
  const bins = new Map();

  for (let i = 0; i < raw.length; i += 3) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    // 5 bits per channel: coarse enough to group a gradient, fine enough to keep hues apart.
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
    } else {
      bins.set(key, { r, g, b, count: 1 });
    }
  }

  let best = null;
  let bestScore = -1;

  for (const bin of bins.values()) {
    const r = bin.r / bin.count;
    const g = bin.g / bin.count;
    const b = bin.b / bin.count;
    const { s, l } = rgbToHsl(r, g, b);

    // Near-black and near-white pixels carry no usable hue however many there are.
    if (l < 0.06 || l > 0.94) continue;

    // Coverage alone picks the sleeve; saturation alone picks a stray pixel. The product,
    // with saturation weighted up, picks the colour the cover is known by.
    const score = bin.count * (0.15 + s * s * 3);
    if (score > bestScore) {
      bestScore = score;
      best = { r, g, b, saturation: s };
    }
  }

  return best ?? { r: 128, g: 128, b: 128, saturation: 0 };
}

/** @returns {{h: number, s: number, l: number}} with every component in 0..1. */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h, s, l };
}

/** @returns {string} a lowercase 6-digit hex. */
function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * @param {string} file filename within `src/assets/showcase/releases`.
 * @returns {Promise<string>} the tint hex for that cover.
 */
async function tintFor(file) {
  // 64x64 is plenty: we want the cover's colour, not its detail, and it keeps the whole
  // manifest derivable in well under a second.
  const { data } = await sharp(join(ARTWORK_DIR, file))
    .resize(64, 64, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { r, g, b, saturation } = vibrantColor(data);
  if (saturation < ACHROMATIC_BELOW) return ACHROMATIC_TINT;

  const { h, s } = rgbToHsl(r, g, b);
  // Hue is kept exactly; saturation is held back from full chroma for the same reason the
  // plum ramp is desaturated in tokens.css - at ground depth, full chroma reads as neon.
  return hslToHex(h, Math.min(s, 0.72), GROUND_LIGHTNESS);
}

const releases = JSON.parse(readFileSync(MANIFEST, 'utf8'));

let changed = 0;
for (const release of releases) {
  const tint = await tintFor(release.artwork);
  if (release.tint !== tint) changed += 1;
  release.tint = tint;
  process.stdout.write(`  ${release.id.padEnd(14)} ${release.artwork.padEnd(24)} → ${tint}\n`);
}

writeFileSync(MANIFEST, `${JSON.stringify(releases, null, 2)}\n`);
process.stdout.write(
  changed === 0
    ? `\n${releases.length} releases, no tint changed.\n`
    : `\n${releases.length} releases, ${changed} tint${changed === 1 ? '' : 's'} updated.\n`,
);

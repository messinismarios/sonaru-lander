import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { ALL_PRESS_FILES, KIT_FILE, SCREENS } from '../../src/data/press';
import { logoHash } from '../../scripts/lib/brand-svg.mjs';

/**
 * The press kit's files - phases.md 8.10b.
 *
 * `/press` is the one page on this site whose whole purpose is handing over files, so the
 * failure that matters is a download that 404s or a picture that was never regenerated.
 * Neither shows on the page: a broken `<a download>` looks exactly like a working one.
 *
 * The manifest is written by `npm run press` and read by the page, so this walks the
 * declarations and the generated set against each other **in both directions** - the
 * discipline `nav-inventory.spec.ts` established for routes. A file offered but never
 * generated is a broken download; a file generated but never offered is weight in the repo
 * that nothing asked for.
 */

const PRESS = new URL('../../public/press/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', PRESS), 'utf8')) as {
  logoHash: string;
  files: Record<string, { bytes: number; width?: number; height?: number }>;
};

test('every file the page offers was generated and is not empty', () => {
  for (const file of ALL_PRESS_FILES) {
    expect(manifest.files[file], `${file} is offered by src/data/press.ts`).toBeDefined();
    expect(existsSync(fileURLToPath(new URL(file, PRESS))), `public/press/${file}`).toBe(true);
    expect(manifest.files[file]?.bytes ?? 0).toBeGreaterThan(0);
  }
});

test('the manifest measures the files that are served', () => {
  /*
   * `/press` prints these numbers as download weights, so the manifest is a claim about
   * files a visitor receives rather than an internal note. It drifted because
   * `build-press-assets.mjs` regenerates every asset, keeps the committed one when
   * `perceptuallyEqual` says the picture is the same - which is what stops a 1 MB zip
   * churning on every run - and then recorded the length of the buffer it had just thrown
   * away. Two lockups were off by 1 and 2 bytes, invisible because `fileWeight()` rounds to
   * whole kilobytes. The tolerance is 0.5% of pixels, so the next drift need not be small.
   */
  for (const file of Object.keys(manifest.files)) {
    expect(statSync(fileURLToPath(new URL(file, PRESS))).size, `public/press/${file}`).toBe(
      manifest.files[file]?.bytes,
    );
  }
});

test('every file that was generated is offered by the page', () => {
  // The other direction, and the one that catches dead weight: 8.10a deleted a 281 KB PNG
  // that had been generated, committed and referenced by nothing since 8.1.
  for (const file of Object.keys(manifest.files)) {
    expect(ALL_PRESS_FILES, `public/press/${file} is generated but nothing links to it`).toContain(
      file,
    );
  }
});

test('the logo files match the mark and the colourways they were generated from', () => {
  // Recomputed, not trusted. Refining the mark in /logo/lab or moving a colour token
  // without re-running `npm run press` leaves a press kit showing the old identity, and
  // nothing else in the build would say so.
  expect(manifest.logoHash).toBe(logoHash());
});

test('the screenshots are one size, not five', () => {
  /*
   * The source set is not uniform - `01-welcome.png` is 1179x2556 where the other four are
   * 1178x2556 - so the generator states both dimensions rather than deriving the height.
   * Without this the gallery's row of phones is a pixel ragged, which reads as sloppiness
   * rather than as the one-pixel capture inconsistency it is.
   */
  for (const screen of SCREENS) {
    expect(manifest.files[`screens/${screen.id}.jpg`]).toMatchObject({ width: 360, height: 781 });
    expect(manifest.files[`screens/${screen.id}-full.jpg`]).toMatchObject({
      width: 1178,
      height: 2556,
    });
  }
});

test('the kit is one download, and it is the biggest thing on the page', () => {
  const kit = manifest.files[KIT_FILE]?.bytes ?? 0;
  const largestSingle = Math.max(
    ...Object.entries(manifest.files)
      .filter(([file]) => file !== KIT_FILE)
      .map(([, entry]) => entry.bytes),
  );
  expect(kit).toBeGreaterThan(largestSingle);
});

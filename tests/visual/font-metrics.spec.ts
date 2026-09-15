import { expect, test } from '@playwright/test';

/**
 * The subset we ship must be metrically identical to the font we licensed.
 *
 * This exists because of a real defect. `scripts/build-fonts.mjs` originally passed
 * `variationAxes: { wght: { min: 300, max: 900 } }` to the subsetter. Satoshi's fvar
 * already declares that range (min 300, default 900, max 900), so the option looked
 * harmless - but asking harfbuzz to re-limit a variable axis triggers an instancing pass
 * that rebuilds the variation metrics, and it came back wrong: 56 of 59 glyphs had
 * different advance widths than the source, each off by a different amount in a different
 * direction.
 *
 * On the page that reads as letters bunching together inside one word and gaping apart in
 * the next - irregular, not uniformly loose or tight, so it does not look like a
 * letter-spacing bug and does not look like a missing kerning table. Every automated
 * check still passed: the font loaded, the weights rendered, kerning was present, the
 * build was green. It was caught by the owner looking at the screen.
 *
 * Comparing per-glyph advances against the source is the check that would have caught it.
 *
 * Note: this reads `/fonts/satoshi-variable.woff2`, the licensed source. It is the input
 * to the font pipeline and is not referenced by any stylesheet, so it should move out of
 * `public/` before launch (8.13) - at which point this test needs another way to reach it.
 */

/** Pairs chosen to exercise kerning as well as plain advances. */
const SPECIMEN = 'Painted, static - Irregular by construction. AVAWA To Ta Yo ¿Cuántos?';

/** Sub-pixel tolerance at 80px. Anything above this is a real metric change. */
const TOLERANCE_PX = 0.05;

test.describe('shipped subset vs licensed source', () => {
  for (const weight of [400, 700, 800]) {
    test(`advance widths are identical at weight ${weight}`, async ({ page }) => {
      await page.goto('/specimen');

      const result = await page.evaluate(
        async ({ text, weight }) => {
          const load = async (family: string, url: string): Promise<void> => {
            const face = new FontFace(family, `url(${url})`, { weight: '300 900' });
            await face.load();
            document.fonts.add(face);
          };
          await load('SourceSatoshi', '/fonts/satoshi-variable.woff2');
          await load('ShippedSatoshi', '/fonts/satoshi-subset.woff2');
          await document.fonts.ready;

          /** One span per character, so we read each glyph's advance rather than a total. */
          const advances = (family: string): number[] => {
            const host = document.createElement('div');
            host.style.cssText =
              `position:absolute;visibility:hidden;white-space:nowrap;font-size:80px;` +
              `font-weight:${weight};font-family:'${family}';letter-spacing:normal;`;
            host.innerHTML = [...text]
              .map((c) => `<span>${c === ' ' ? '&nbsp;' : c}</span>`)
              .join('');
            document.body.appendChild(host);
            const widths = [...host.children].map((s) => s.getBoundingClientRect().width);
            host.remove();
            return widths;
          };

          const source = advances('SourceSatoshi');
          const shipped = advances('ShippedSatoshi');
          const drift = shipped.map((w, i) => Math.abs(w - (source[i] ?? 0)));
          return {
            worst: Math.max(...drift),
            differing: drift.filter((d) => d > 0.05).length,
            total: drift.length,
          };
        },
        { text: SPECIMEN, weight },
      );

      expect(
        result.worst,
        `${result.differing} of ${result.total} glyphs drifted from the licensed source ` +
          `at weight ${weight} - the subset is not metrically faithful`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    });
  }
});

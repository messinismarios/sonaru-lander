import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * A `404.html` for every prefixed locale - phases.md 8.11b.
 *
 * **Cloudflare Pages serves the nearest `404.html` walking up the path**: with no
 * `dist/es/404.html`, a visitor who mistypes a Spanish URL gets the English 404. The page is
 * built correctly and served wrongly, which is the failure mode nothing local can show you -
 * the same shape as 8.9f's, whose live check is already a 8.13 item and now covers `/es/`
 * too.
 *
 * Under the default `directory` build format the Spanish page landed at
 * `dist/es/404/index.html` and this hook copied it into place. Since SEO audit C1 set
 * `build.format: 'file'`, Astro writes `dist/es/404.html` itself, so the hook only asserts
 * the file is there - a format change that moves it again fails the build rather than
 * quietly serving English.
 */
export function localeFallback404({ locales }) {
  return {
    name: 'sonaru:locale-404',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        for (const locale of locales) {
          await stat(`${root}/${locale}/404.html`);
          logger.info(`404.html present for ${locale}`);
        }
      },
    },
  };
}

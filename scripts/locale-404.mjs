import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/**
 * A `404.html` for every prefixed locale - phases.md 8.11b.
 *
 * **Astro special-cases exactly one 404 and it is the root one.** `src/pages/404.astro`
 * becomes `dist/404.html`; the Spanish page built from the same file under the locale
 * parameter becomes `dist/es/404/index.html`. That was measured at Gate B rather than
 * assumed, and both ways of authoring it - under `[...locale]` and as a literal
 * `src/pages/es/404.astro` - land in the same place.
 *
 * It matters because **Cloudflare Pages serves the nearest `404.html` walking up the
 * path**: with no `dist/es/404.html`, a visitor who mistypes a Spanish URL gets the English
 * 404. The page is built correctly and served wrongly, which is the failure mode nothing
 * local can show you - the same shape as 8.9f's, whose live check is already a 8.13 item
 * and now covers `/es/` too.
 *
 * A copy rather than a move: `/es/404` stays reachable as a page, which is what
 * `tests/visual/routes.ts` photographs and what the owner can open at Gate C.
 */
export function localeFallback404({ locales }) {
  return {
    name: 'sonaru:locale-404',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        for (const locale of locales) {
          const from = `${root}/${locale}/404/index.html`;
          const to = `${root}/${locale}/404.html`;
          await mkdir(dirname(to), { recursive: true });
          await copyFile(from, to);
          logger.info(`404.html written for ${locale}`);
        }
      },
    },
  };
}

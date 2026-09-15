import { readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Keeps the design tools out of the published site - phases.md 8.13.
 *
 * **`dist/` contains shipping routes and nothing else**, which is `isShippingRoute()` applied
 * to the build output rather than to a footer, a sitemap or a locale tree. That predicate has
 * governed three separate questions since 8.11b and this is the fourth: what is actually
 * served.
 *
 * **Deleting the routes was the other option and it retires two pipelines.** 8.13 says to
 * remove the dev-only routes and every camera stand, and taken literally that means deleting
 * the files - at which point `npm run og` and `npm run press` stop working, because they
 * photograph `/blog/og/<slug>`, `/og/site` and `/og/press-assets` **on the dev server**. A
 * fourth blog post could never get a cover without first restoring a deleted route from git.
 * The owner chose to keep the files and prune the output (2026-09-12), which is the same shape
 * 8.11e uses for `/es/`: the thing exists where it is useful and is absent from where it is
 * not.
 *
 * **`/logo/lab` is pruned too** (owner, same decision). 8.13 exempts it from *removal* - "a
 * tool for a settled mark" - and that exemption is about the repository, not about publishing
 * a design instrument at `sonaru.app/logo/lab`.
 *
 * **This runs before `cspHashes()`**, so the hashes describe the pages that ship rather than
 * pages that have just been deleted. Integration hooks run in the order the integrations are
 * listed in `astro.config.mjs`.
 */
export function pruneDevRoutes({ isShippingRoute }) {
  return {
    name: 'sonaru:prune-dev-routes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);

        /** Every built page, as the route it is served at. */
        async function pages(directory, prefix = '') {
          const found = [];
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              found.push(...(await pages(`${directory}/${entry.name}`, `${prefix}/${entry.name}`)));
            } else if (entry.name === 'index.html') {
              found.push({ route: prefix || '/', directory });
            }
          }
          return found;
        }

        const pruned = [];
        for (const { route, directory } of await pages(root)) {
          if (isShippingRoute(route)) continue;
          await rm(directory, { recursive: true, force: true });
          pruned.push(route);
        }

        /*
         * Directories that held nothing but pruned pages are left behind empty - `/og/` once
         * `/og/site` and `/og/press-assets` are gone. An empty directory is not served, but it
         * is litter in the artefact and it makes `dist/` read as if something is still there.
         */
        for (const parent of ['blog/og', 'og', 'logo']) {
          const path = `${root}/${parent}`;
          try {
            if ((await readdir(path)).length === 0) await rm(path, { recursive: true });
          } catch {
            /* Never existed, or a parent was pruned with it. Both are the wanted state. */
          }
        }

        logger.info(`pruned ${pruned.length} dev-only route(s): ${pruned.sort().join(', ')}`);
        await stat(`${root}/index.html`);
      },
    },
  };
}

import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEV_ONLY_ROUTES, isCameraStand, isShippingRoute } from '../../src/data/routes';
import { ROUTES } from '../visual/routes';

/**
 * The published site is the shipping routes and nothing else - phases.md 8.13.
 *
 * **The files deliberately stay in the repository** (owner, 2026-09-12), because the camera
 * stands are the tooling: `npm run og` and `npm run press` photograph `/blog/og/<slug>`,
 * `/og/site` and `/og/press-assets` on the **dev server**. Deleting them, which is what 8.13
 * says in as many words, would mean a fourth blog post could never get a cover without first
 * restoring a route from git. `scripts/prune-dev-routes.mjs` removes them from `dist/`
 * instead - the same shape 8.11e uses for `/es/`.
 *
 * So there are two claims to guard and they pull in opposite directions: **the tools still
 * exist**, and **none of them ships**. A test for either one alone is satisfied by deleting
 * the other's subject.
 */

const DIST = new URL('../../dist/', import.meta.url);

/** Every built page, as the route it is served at. */
function builtRoutes(dir = DIST, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(fileURLToPath(dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...builtRoutes(new URL(`${entry.name}/`, dir), `${prefix}/${entry.name}`));
    } else if (entry.name === 'index.html') {
      found.push(prefix || '/');
    }
  }
  return found;
}

test('nothing in the build is a dev-only route or a camera stand', () => {
  const shipped = builtRoutes();
  expect(
    shipped.length,
    'the build is empty - did the prune hook run away with it?',
  ).toBeGreaterThan(10);

  const leaked = shipped.filter((route) => !isShippingRoute(route));
  expect(leaked, 'published, and should not be').toEqual([]);
});

test('every shipping route is still in the build', () => {
  /*
   * The other direction, and the one that catches a prune predicate that is too greedy. The
   * `/404` route is excluded because Astro writes it as `dist/404.html` rather than as a
   * directory with an index, so it is not a route this walk can see.
   */
  const shipped = new Set(builtRoutes());
  const missing = ROUTES.filter(
    (route) => isShippingRoute(route) && route !== '/404' && !shipped.has(route),
  );
  expect(missing, 'a shipping route the prune took with it').toEqual([]);
});

test('the design tools still exist in the repository', () => {
  /*
   * **The claim the prune must not quietly become a deletion.** `/logo/lab` is named
   * explicitly: 8.13 exempts it from removal, and the owner's ruling is that the exemption is
   * about the repository rather than about publishing a design instrument at a public URL.
   */
  for (const route of DEV_ONLY_ROUTES) {
    expect(ROUTES, `${route} has been deleted, not pruned`).toContain(route);
  }
  const stands = ROUTES.filter((route) => isCameraStand(route));
  expect(
    stands.length,
    'the camera stands are gone - npm run og has nothing to photograph',
  ).toBeGreaterThan(0);
});

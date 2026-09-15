import { readFileSync, readdirSync } from 'node:fs';
import { TAGS } from '../../src/data/tags';
import { DEFAULT_LOCALE, PUBLISHED_LOCALES } from '../../src/i18n';
import { isLive } from '../../src/lib/published';

/*
 * **The inventory moved to `src/` at 8.11b and is re-exported here.** `astro.config.mjs`'s
 * sitemap filter needs the same list and a config cannot import from a test directory, so
 * the one copy lives in `src/data/routes.ts` - see that file's header. Every existing caller
 * of `isCameraStand` keeps importing it from here.
 */
export { isCameraStand, isShippingRoute, DEV_ONLY_ROUTES } from '../../src/data/routes';

/**
 * Every page the router serves, discovered from `src/pages` rather than listed.
 *
 * Shared because two separate guards each needed it and each got it wrong in turn: the
 * spacing guard shipped with a hardcoded pair and stopped covering the very next page
 * added, then lost the logo routes again when they moved into a subdirectory. A guard
 * that quietly narrows is the same failure as one that was never written, so route
 * discovery lives in one place and recurses.
 *
 * **8.9b added the site's first dynamic route.** `src/pages/[document].astro` is filled
 * by the `legal` collection, and reading filenames alone yielded the literal string
 * `/[document]` - which is not a route, would have failed nothing, and would have left
 * `/privacy`, `/terms` and `/support` invisible to every guard that consumes this file.
 * That is the same silent narrowing the paragraph above is about, so it is fixed here
 * rather than worked around in the two callers. 8.9c's `/blog/[slug]` inherits it.
 */

const PAGES = new URL('../../src/pages/', import.meta.url);
const CONTENT = new URL('../../src/content/', import.meta.url);

/**
 * Which content collection fills each dynamic route file.
 *
 * Declared rather than inferred: nothing in `src/pages` records where a route's params
 * come from, and guessing from the parameter name would be a convention one rename would
 * break silently. A dynamic route file with no entry here throws - see `expandDynamic`.
 */
const DYNAMIC_FILL: Readonly<Record<string, string>> = {
  '[document]': 'legal',
  '[slug]': 'blog',
};

/**
 * The tags at least one published post carries, in `src/data/tags.ts`'s order - the tags
 * that have a page.
 *
 * **Since SEO audit H5 (owner, 2026-09-15) a tag with no published post has no page**, so
 * this can no longer be `TAGS` alone: it has to read which tags the posts carry. That means
 * reading frontmatter here, which 8.9c avoided while it did not need to. The rule for
 * "published" is not re-derived - it is `isLive()`, the function `src/lib/posts.ts` uses,
 * with `dev` false because the build is what decides whether a page ships.
 */
export function liveTagSlugs(): string[] {
  const blog = new URL('blog/', CONTENT);
  const carried = new Set<string>();
  for (const entry of readdirSync(blog, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
    const source = readFileSync(new URL(entry.name, blog), 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
    if (/^draft:\s*true\s*$/m.test(frontmatter)) continue;
    const publishedAt = /^publishedAt:\s*['"]?([^'"\n]+)['"]?\s*$/m.exec(frontmatter)?.[1];
    if (publishedAt === undefined || !isLive(publishedAt, new Date(), false)) continue;
    const tags = /^tags:\s*\[(.*)\]\s*$/m.exec(frontmatter)?.[1] ?? '';
    for (const raw of tags.split(',')) carried.add(raw.trim().replace(/^['"]|['"]$/g, ''));
  }
  return TAGS.filter((tag) => carried.has(tag.slug)).map((tag) => tag.slug);
}

/**
 * Dynamic routes whose params come from *values inside* a collection rather than from its
 * entries - 8.9c's `/blog/tags/[tag]`, which `liveTagSlugs` above fills.
 */
const DYNAMIC_VALUES: Readonly<Record<string, () => string[]>> = {
  '[tag]': liveTagSlugs,
};

/** The slugs a collection contributes, from its files - the ids the glob loader assigns. */
function collectionSlugs(collection: string): string[] {
  return readdirSync(new URL(`${collection}/`, CONTENT), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => entry.name.replace(/\.mdx?$/, ''));
}

function expandDynamic(base: string, prefix: string): string[] {
  const values = DYNAMIC_VALUES[base];
  if (values !== undefined) {
    return values().map((value) => `${prefix}/${value}`);
  }
  const collection = DYNAMIC_FILL[base];
  if (collection === undefined) {
    throw new Error(
      `${base}.astro is a dynamic route with no entry in DYNAMIC_FILL or DYNAMIC_VALUES ` +
        `(tests/visual/routes.ts). Add one naming the collection that fills it, or the ` +
        `values that do, or every guard built on route discovery will silently skip the ` +
        `routes it serves.`,
    );
  }
  return collectionSlugs(collection).map((slug) => `${prefix}/${slug}`);
}

/**
 * The directory 8.11b put every shipping page under.
 *
 * **It is a dynamic *directory*, and this file only knew how to expand dynamic *files*.**
 * Left alone, `discoverRoutes` would have returned the literal `/[...locale]/pricing` and
 * every guard built on `ROUTES` - the spacing sweep, the nav inventory, the chrome and
 * reduced-motion walks - would have quietly stopped covering the whole site while still
 * passing. That is the silent narrowing this file's own header is about, one directory
 * deeper, and it is the third time it has been the failure worth naming.
 */
const LOCALE_DIR = '[...locale]';

export function discoverRoutes(dir: URL, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = new URL(`${entry.name}/`, dir);
      if (entry.name === LOCALE_DIR) {
        /* One pass per **published** locale: the default one unprefixed, the rest under
         * their prefix - which is exactly what `localePaths()` emits, expressed as discovery.
         * A withheld locale (8.11e) emits no page, so photographing one would be
         * photographing a 404. */
        for (const locale of PUBLISHED_LOCALES) {
          found.push(
            ...discoverRoutes(nested, locale === DEFAULT_LOCALE ? prefix : `${prefix}/${locale}`),
          );
        }
        continue;
      }
      found.push(...discoverRoutes(nested, `${prefix}/${entry.name}`));
    } else if (entry.name.endsWith('.astro')) {
      const base = entry.name.replace(/\.astro$/, '');
      if (base.includes('[')) {
        found.push(...expandDynamic(base, prefix));
      } else {
        found.push(base === 'index' ? prefix || '/' : `${prefix}/${base}`);
      }
    }
  }
  return found;
}

/**
 * All routes, sorted and **deduplicated**, for tests that should cover the whole site.
 *
 * **The set matters because `/404` is authored twice on purpose** (8.11b). Astro's dev server
 * answers an unmatched path with the route at `src/pages/404.astro` specifically, so that file
 * is static, while `src/pages/[...locale]/404.astro` emits the prefixed locales only - and
 * discovery, which reads filenames rather than `getStaticPaths`, finds `/404` down both paths.
 * Without the set, seven guards built on `ROUTES` declared the same test twice and Playwright
 * refused the whole run with `duplicate test title`, which is the right failure and a confusing
 * one to read.
 */
export const ROUTES: readonly string[] = [...new Set(discoverRoutes(PAGES))].sort();

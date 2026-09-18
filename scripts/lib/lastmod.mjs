/**
 * `<lastmod>` for the sitemap - SEO audit M3 (2026-09-15).
 *
 * **Never the build time.** A date that moves on every deploy while the page did not teaches
 * a crawler the field is noise, and it stops reading it for the whole site. So each URL gets
 * the date its content last really changed, from the most specific source there is:
 *
 * - a post: its `updatedAt` when it has one, else its `publishedAt` (SEO audit M4);
 * - `/blog` and a tag page: the newest live post they list, by `publishedAt` - the list
 *   changes when a post arrives, not when one already on it is revised;
 * - a legal document: its `effective` date;
 * - everything else: the last commit touching the route's own page and copy files.
 *
 * **The git fallback is narrow on purpose.** A page is also its components, so a change to a
 * shared section does not move its date; the alternative - every file a page imports - moves
 * every date on every deploy, which is the build-time failure by another route.
 *
 * **In a shallow clone the git dates are omitted rather than guessed**: there every file's
 * last commit is the one commit the clone has. An omitted `<lastmod>` is valid; a wrong one
 * is not.
 *
 * Loaded by `astro.config.mjs` before Astro exists, so it reads frontmatter with a regex
 * rather than through the content layer; `src/content.config.ts` guarantees the shapes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** One frontmatter value as written, with its quotes stripped. */
function field(source, key) {
  const block = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const value = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  return value?.replace(/^(['"])(.*)\1$/, '$2');
}

function entries(dir) {
  return readdirSync(join(ROOT, dir))
    .filter((name) => /\.mdx?$/.test(name))
    .map((name) => ({
      id: name.replace(/\.mdx?$/, ''),
      file: `${dir}/${name}`,
      source: readFileSync(join(ROOT, dir, name), 'utf8'),
    }));
}

/* The same rule as `publishedPosts()`: no drafts, nothing scheduled for later. */
const posts = entries('src/content/blog')
  .map(({ id, source }) => ({
    href: `/blog/${id}`,
    publishedAt: new Date(field(source, 'publishedAt') ?? NaN),
    updatedAt: field(source, 'updatedAt') ? new Date(field(source, 'updatedAt')) : undefined,
    draft: field(source, 'draft') === 'true',
    tags: [...(field(source, 'tags') ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]),
  }))
  .filter((post) => !post.draft && post.publishedAt.getTime() <= Date.now());

const legal = new Map(
  entries('src/content/legal').map(({ id, file, source }) => [
    `/${id}`,
    { file, effective: field(source, 'effective') },
  ]),
);

const shallow = (() => {
  try {
    const answer = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return answer.trim() !== 'false';
  } catch {
    return true;
  }
})();

function committed(paths) {
  const existing = paths.filter((path) => existsSync(join(ROOT, path)));
  if (shallow || existing.length === 0) return undefined;
  const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...existing], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  return iso === '' ? undefined : new Date(iso);
}

function newest(list) {
  return list.length === 0
    ? undefined
    : new Date(Math.max(...list.map((post) => post.publishedAt.getTime())));
}

/** When the page at `path` (unprefixed) last changed, or `undefined` when nothing honest says. */
export function lastmod(path) {
  const post = posts.find((candidate) => candidate.href === path);
  if (post) return post.updatedAt ?? post.publishedAt;
  if (path === '/blog') return newest(posts);

  const tag = path.match(/^\/blog\/tags\/([^/]+)$/)?.[1];
  if (tag) return newest(posts.filter((candidate) => candidate.tags.includes(tag)));

  const document = legal.get(path);
  if (document) {
    return document.effective
      ? new Date(`${document.effective}T00:00:00Z`)
      : committed([document.file]);
  }

  const name = path === '/' ? 'index' : path.slice(1);
  return committed([
    `src/pages/[...locale]/${name}.astro`,
    `copy/en/${path === '/' ? 'home' : name}.ts`,
    ...(path === '/changelog' ? ['src/content/changelog'] : []),
  ]);
}

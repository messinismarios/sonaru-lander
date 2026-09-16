import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCREENS } from '../../src/data/press';

/**
 * The SEO audit's housekeeping findings (2026-09-15) - M3, L1, L2, L4, L6, L7, L8 - held
 * against what ships. **Against `dist/` and `public/`, not the dev server**: the sitemap and
 * the feed's final bytes exist only in a build. `npm run verify` builds before it tests.
 */

const ROOT = new URL('../../', import.meta.url);
const path = (file: string) => fileURLToPath(new URL(file, ROOT));
const read = (file: string) => {
  if (!existsSync(path(file))) throw new Error(`${file} is missing - run \`npm run build\`.`);
  return readFileSync(path(file), 'utf8');
};

interface Entry {
  readonly path: string;
  readonly lastmod: number | undefined;
  readonly block: string;
}

function sitemap(): Entry[] {
  return [...read('dist/sitemap-en-0.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, b]) => {
    const block = b ?? '';
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    return {
      path: new URL(block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '').pathname,
      lastmod: lastmod === undefined ? undefined : Date.parse(lastmod),
      block,
    };
  });
}

const frontmatter = (source: string, key: string) =>
  source.match(new RegExp(`^${key}:\\s*'?([^'\\n]+)'?$`, 'm'))?.[1];

test.describe('sitemap dates (M3)', () => {
  test('a post is dated by its publishedAt, the index and tags by their newest post', () => {
    const entries = sitemap();
    const posts = entries.filter((e) => /^\/blog\/(?!tags\/)[^/]+$/.test(e.path));
    expect(posts.length).toBeGreaterThan(0);

    for (const post of posts) {
      const file = readdirSync(path('src/content/blog')).find((name) =>
        name.startsWith(`${post.path.slice('/blog/'.length)}.`),
      );
      const source = read(`src/content/blog/${file}`);
      expect(post.lastmod, post.path).toBe(Date.parse(frontmatter(source, 'publishedAt') ?? ''));
    }

    const newest = Math.max(...posts.map((post) => post.lastmod ?? 0));
    expect(entries.find((e) => e.path === '/blog')?.lastmod).toBe(newest);
    for (const tag of entries.filter((e) => e.path.startsWith('/blog/tags/'))) {
      expect(
        posts.map((post) => post.lastmod),
        `${tag.path} is dated by a post it lists`,
      ).toContain(tag.lastmod);
    }
  });

  test('a legal document with an effective date is dated by it', () => {
    for (const name of readdirSync(path('src/content/legal'))) {
      const effective = frontmatter(read(`src/content/legal/${name}`), 'effective');
      if (effective === undefined) continue;
      const entry = sitemap().find((e) => e.path === `/${name.replace(/\.md$/, '')}`);
      expect(entry?.lastmod, name).toBe(Date.parse(`${effective}T00:00:00Z`));
    }
  });

  test('any other page is dated by its last commit, never by the build', () => {
    /*
     * In a shallow clone `lastmod.mjs` omits these dates rather than report the clone's one
     * commit as every file's last - so there is nothing to compare against.
     */
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: path('.'), encoding: 'utf8' }).trim();
    test.skip(git(['rev-parse', '--is-shallow-repository']) !== 'false', 'shallow clone');

    const iso = git([
      'log',
      '-1',
      '--format=%cI',
      '--',
      'src/pages/[...locale]/pricing.astro',
      'copy/en/pricing.ts',
    ]);
    expect(sitemap().find((e) => e.path === '/pricing')?.lastmod).toBe(Date.parse(iso));
  });
});

test('/press lists its screenshots as sitemap images (L7)', () => {
  const press = sitemap().find((e) => e.path === '/press');
  for (const screen of SCREENS) {
    expect(press?.block).toContain(
      `<image:loc>https://sonaru.app/press/screens/${screen.id}.jpg</image:loc>`,
    );
  }
});

test('/favicon.ico is a 48px icon holding a PNG (L1)', () => {
  const ico = readFileSync(path('public/favicon.ico'));
  expect([...ico.subarray(0, 6)], 'ICONDIR: reserved, type 1, one image').toEqual([
    0, 0, 1, 0, 1, 0,
  ]);
  expect([ico[6], ico[7]], 'width and height').toEqual([48, 48]);
  expect(ico.readUInt32LE(18)).toBe(22);
  expect(ico.subarray(22, 26).toString('latin1')).toBe('\x89PNG');
  expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
});

test('the 404 is noindex and claims no canonical or language versions (L2)', () => {
  const html = read('dist/404.html');
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).not.toContain('rel="canonical"');
  expect(html).not.toMatch(/<link rel="alternate" hreflang=/);
});

test('the web manifest has an id, a start URL, a description and a maskable icon (L4)', () => {
  const manifest = JSON.parse(read('public/site.webmanifest')) as {
    id?: string;
    start_url?: string;
    description?: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.description?.length).toBeGreaterThan(0);
  const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable');
  expect(maskable, 'a maskable icon').toBeDefined();
  expect(existsSync(path(`public${maskable?.src}`))).toBe(true);
});

test('the feed names itself and dates itself by its newest post (L6)', () => {
  const feed = read('dist/blog/rss.xml');
  expect(feed).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  expect(feed).toContain(
    '<atom:link href="https://sonaru.app/blog/rss.xml" rel="self" type="application/rss+xml"/>',
  );
  const built = Date.parse(feed.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1] ?? '');
  const items = [...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => Date.parse(m[1]!));
  expect(built).toBe(Math.max(...items));

  for (const page of ['dist/blog.html', 'dist/blog/what-is-sonaru.html']) {
    expect(read(page), page).toContain('type="application/rss+xml"');
    expect(read(page), `${page}'s feed link is absolute`).not.toContain('href="/blog/rss.xml"');
  }
});

test('security.txt names a contact and has not expired (L8)', () => {
  /* When this fails on the date, renew `Expires` - RFC 9116 wants it under a year out. */
  const text = read('public/.well-known/security.txt');
  expect(text).toMatch(/^Contact: mailto:\S+@sonaru\.app$/m);
  expect(text).toMatch(/^Canonical: https:\/\/sonaru\.app\/\.well-known\/security\.txt$/m);
  const expires = Date.parse(text.match(/^Expires: (\S+)$/m)?.[1] ?? '');
  expect(expires).toBeGreaterThan(Date.now());
});

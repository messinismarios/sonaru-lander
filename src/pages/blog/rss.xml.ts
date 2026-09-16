/**
 * `/blog/rss.xml` - the feed.
 *
 * gsap.com publishes RSS **and** Atom and advertises both in `<head>`; superlist.com
 * publishes neither. The owner took gsap's half at Gate A. One feed, not two: Atom exists
 * for readers that cannot parse RSS, and there are none left worth carrying a second
 * document for.
 *
 * **Items carry the lede, not the post.** A full-content feed duplicates the site into a
 * document nothing on the site controls the rendering of, and it means sanitising rendered
 * MDX - a component-bearing post has markup that has no meaning outside the page it was
 * written for. The lede is the same string the index card shows, so the feed promises
 * exactly what the site promises.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { publishedPosts } from '../../lib/posts';
import { catalogue } from '../../i18n';

export async function GET(context: APIContext): Promise<Response> {
  const posts = await publishedPosts();
  /* The feed is per-locale at 8.11b; until then it is the apex, which is English. */
  const t = catalogue(context.currentLocale);
  /*
   * `context.site` comes from `astro.config.mjs`. It is asserted rather than defaulted:
   * a feed with relative links is a broken feed, and silently emitting one is worse than
   * failing the build.
   */
  const site = context.site;
  if (site === undefined) {
    throw new Error('astro.config.mjs must set `site` - an RSS feed needs absolute URLs.');
  }

  /*
   * SEO audit L6. The feed names its own address, so a reader holding a copy knows the
   * original; and `lastBuildDate` is the newest post rather than the build time, for M3's
   * reason - a date that moves on every deploy while the feed did not is a date to ignore.
   */
  const self = new URL('/blog/rss.xml', site).href;
  const newest = posts[0];

  return rss({
    title: t.ui.blog.feedTitle,
    description: t.ui.meta.blog.description,
    site,
    /* The integration appends a slash by default; Pages redirects that form (SEO audit C1). */
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.entry.data.title,
      description: post.entry.data.lede,
      pubDate: new Date(post.entry.data.publishedAt),
      link: post.href,
      categories: post.tags.map((tag) => t.ui.blog.tags[tag.slug].label),
    })),
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      '<language>en</language>',
      `<atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
      newest &&
        `<lastBuildDate>${new Date(newest.entry.data.publishedAt).toUTCString()}</lastBuildDate>`,
    ]
      .filter(Boolean)
      .join(''),
  });
}

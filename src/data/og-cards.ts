/**
 * The routes that unfurl with a card of their own - SEO audit M12.
 *
 * Before this, every route except a blog post shared `og/site.jpg`, so a share of
 * `/pricing` looked exactly like a share of `/`. The five routes here are the ones people
 * actually send each other; everything else - the legal pages, `/brand`, `/support`, the
 * 404 - keeps the site card, because a card nobody shares is a binary in the repo and
 * nothing else.
 *
 * **The line is the page's own `h1`** (owner, Gate A 2026-09-17, kept at Gate C on
 * 2026-09-18 after the meta title was tried and rejected). A preview quotes the page it
 * links to, and reading the heading out of the catalogue rather than writing a second line
 * per route means the card cannot drift from the page: edit the heading and
 * `manifest.json` goes stale, which is what `tests/unit/blog-inventory.spec.ts` fails on.
 *
 * **The composition does not change.** Every card is the same `PostCover` the posts and
 * the site card use, lit by `hero` - 8.10a's decision that there is one cover design on
 * this site, not two, and Gate A kept it rather than drawing artwork per route.
 *
 * Nothing here may import anything only a bundler can resolve: the camera stand and the
 * guards both read it, under Astro and under plain Node.
 */
import type { Catalogue } from '../i18n';
import type { Act } from './tags';

export interface RouteCard {
  /** The file it becomes: `public/og/<slug>.jpg`, and the stand at `/og/route/<slug>`. */
  readonly slug: string;
  /** The page that names it in `og:image`. */
  readonly route: string;
  /** The bloom palette. `hero` throughout - the magenta the brand opens and closes on. */
  readonly act: Act;
  /** The page's `h1`, from the catalogue that renders it. */
  readonly line: (t: Catalogue) => string;
}

export const ROUTE_CARDS: readonly RouteCard[] = [
  { slug: 'pricing', route: '/pricing', act: 'hero', line: (t) => t.pricing.hero.headline },
  { slug: 'waitlist', route: '/waitlist', act: 'hero', line: (t) => t.ui.waitlistPage.headline },
  { slug: 'blog', route: '/blog', act: 'hero', line: (t) => t.ui.blog.headline },
  { slug: 'changelog', route: '/changelog', act: 'hero', line: (t) => t.ui.changelog.title },
  { slug: 'press', route: '/press', act: 'hero', line: (t) => t.press.title },
];

/** Every name `public/og/` may hold that is not a post's - the site card and these. */
export const NON_POST_CARDS: readonly string[] = ['site', ...ROUTE_CARDS.map((c) => c.slug)];

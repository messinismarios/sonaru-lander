/**
 * Keeping a visitor in the locale they chose - phases.md 8.11b, Gate C rev 3.
 *
 * **The defect this exists for shipped, and the owner found it by clicking.** Every link on
 * every `/es/` page pointed at the unprefixed English route, so switching language survived
 * exactly one click. `localePath()` had one caller in the entire site - the switcher - and a
 * language switcher that is the only locale-aware link on the page is a trapdoor, not a
 * switch.
 *
 * **Why this is done here and not at the call sites.** There is no single call site to fix:
 * `src/data/nav.ts` feeds the footer's eighteen destinations, `Link` and `Button` take an
 * `href` prop, eighteen raw `<a>` tags are authored directly in components and pages, and
 * blog posts are MDX, where the author writes a markdown link and will never think about
 * locales. Prefixing inside the two primitives would have covered the smallest share of
 * those and, worse, would have covered them *silently* - the same narrowing that
 * `tests/visual/routes.ts` has now been bitten by three times. One rule in one place, and a
 * new link anywhere on the site is correct without anybody remembering this file exists.
 *
 * **It costs the visitor nothing.** `output` is `'static'`, so middleware runs during
 * prerendering and the rewritten HTML is what lands in `dist/`. There is no runtime hop, no
 * client-side router and no JavaScript involved - an `/es/` page ships with its links
 * already correct in the bytes.
 *
 * **What it deliberately does not touch**, because each of these is served from one place in
 * every language: anything with a file extension (`/press/kit.zip`, `/brand/sonaru-brand.pdf`,
 * `/press/screens/*.jpg`, `/blog/rss.xml`), fragments, `mailto:`, and any absolute or
 * protocol-relative URL. And it never fires on the default locale at all, which is unprefixed
 * at the apex - a rewrite that ran there would break every link on the site.
 *
 * **And it never touches an anchor that carries `hreflang`.** That rule is not a special case
 * for the switcher, though the switcher is what found it: the first version of this file
 * rewrote the switcher's own *English* link to `/es/pricing`, which is to say it fixed the
 * links on the Spanish page by breaking the only way off it. An anchor that declares the
 * language of its destination has already stated which locale it means, so a rewrite there
 * would be overruling an explicit declaration with an inferred one - wrong in general, and
 * not merely inconvenient here. `Link.astro` already takes `hreflang` for exactly this kind of
 * cross-language link, so the switcher needed no change and no marker attribute.
 */
import type { MiddlewareHandler } from 'astro';
import { DEFAULT_LOCALE } from './i18n';
import { splitLocale } from './i18n/routing';

/**
 * Is this `href` a site-internal, page-shaped destination?
 *
 * Page-shaped is the whole of the rule, and the extension test is what carries it: routes on
 * this site have no extension and files always do. That holds because path segments are not
 * translated (Gate A), so a route is the same string in every language and prefixing it is a
 * pure string operation rather than a lookup that can go stale in one direction.
 */
function isInternalPage(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/)[0] ?? '';
  return !/\.[a-z0-9]+$/i.test(path);
}

/**
 * Anchor open tags, and only those.
 *
 * The rewrite is scoped to `<a>` rather than to every `href=` in the document on purpose:
 * `<link rel="canonical">`, `rel="alternate"` and the icon and manifest tags all carry an
 * `href` and every one of them means something this must not change. Matching the whole tag
 * is also what makes the `hreflang` rule above possible - the attribute that exempts a link
 * sits beside the one being rewritten, so both have to be in view at once.
 */
const ANCHOR = /<a\s[^>]*>/gi;

/** `href="..."` and `href='...'`, captured so the quoting style is preserved on the way out. */
const HREF = /(\shref=)("|')(.*?)\2/;

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();

  const { locale } = splitLocale(context.url.pathname);
  if (locale === DEFAULT_LOCALE) return response;

  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return response;

  const html = await response.text();
  const rewritten = html.replace(ANCHOR, (tag) => {
    // An anchor that names its destination's language has already chosen a locale.
    if (/\shreflang=/i.test(tag)) return tag;

    return tag.replace(HREF, (match, prefix: string, quote: string, href: string) => {
      if (!isInternalPage(href)) return match;

      /*
       * Already prefixed is left alone rather than prefixed twice - a page that links to
       * `/es/...` explicitly means it.
       */
      if (splitLocale(href).locale !== DEFAULT_LOCALE) return match;

      const bare = href === '/' ? '' : href;
      return `${prefix}${quote}/${locale}${bare}${quote}`;
    });
  });

  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

/**
 * Locale routing - phases.md 8.11b, Gate B approved 2026-09-11.
 *
 * **One file per route still, and the locale is a parameter of it.** Every shipping page
 * lives under `src/pages/[...locale]/` and returns `localePaths()` from `getStaticPaths`,
 * which emits the English page unprefixed and the Spanish one under `/es/`. Measured in
 * this repo rather than taken from the docs: a rest parameter with `undefined` produces
 * `/pricing` and `es` produces `/es/pricing`, from the same file, and `Astro.currentLocale`
 * resolves to `en` and `es` respectively - which is what lets every component keep calling
 * `catalogue(Astro.currentLocale)` from 8.11a without a single change.
 *
 * **Path segments are not translated** - `/es/pricing`, never `/es/precios` (Gate A).
 * superlist does the same, and it keeps `src/data/nav.ts` one set of destinations rather
 * than one per language: switching locale is then a prefix operation and not a lookup
 * table that can go stale in one direction.
 */
import { DEFAULT_LOCALE, LOCALES, PUBLISHED_LOCALES, type Locale } from './index';

/**
 * The `getStaticPaths` return value every shipping page shares.
 *
 * `undefined` for the default locale is what makes it unprefixed: Astro matches a rest
 * parameter against zero segments. Spelling it out in seventeen files would be seventeen
 * chances to spell it differently.
 *
 * **`PUBLISHED_LOCALES`, not `LOCALES`** - 8.11e. A withheld language is declared but emits
 * no page at all, so it disappears from `dist/` here rather than being generated and then
 * disclaimed. `splitLocale` below deliberately keeps reading `LOCALES`: what a prefix *means*
 * does not change with whether the site ships it.
 */
export function localePaths(): { params: { locale: string | undefined } }[] {
  return PUBLISHED_LOCALES.map((locale) => ({
    params: { locale: locale === DEFAULT_LOCALE ? undefined : locale },
  }));
}

/**
 * The prefixed locales only - every locale except the default.
 *
 * One route needs this and it is the 404: Astro's dev server answers an unmatched path with
 * the route it finds at `src/pages/404.astro` **specifically**, so that file stays static and
 * its twin under the locale parameter must not also claim `/404`. See `NotFound.astro`.
 */
export function prefixedLocalePaths(): { params: { locale: string } }[] {
  return PUBLISHED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({
    params: { locale },
  }));
}

/**
 * The same route in a given locale, in the form the canonical tag uses.
 *
 * **No trailing slash, ever** - `Base.astro` strips it from the canonical because
 * `trailingSlash: 'ignore'` serves both forms and a canonical that varies with how the
 * visitor arrived is worse than none. The Spanish home is therefore `/es` and not `/es/`,
 * which is where we part from superlist: theirs is `/es/`. One rule everywhere beats
 * matching a reference on a detail our own canonical would then contradict.
 */
export function localePath(locale: Locale, path: string): string {
  const bare = path === '/' ? '' : path.replace(/\/$/, '');
  return locale === DEFAULT_LOCALE ? bare || '/' : `/${locale}${bare}`;
}

/**
 * The locale a path is in, and the path with its prefix removed.
 *
 * The switcher's whole job: `/es/pricing` is `es` plus `/pricing`, so the other locale's
 * link is the same route rather than its home page. Sending a visitor to the home page of
 * the other language is the switcher failure everyone has met.
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const bare = pathname.replace(/(.)\/$/, '$1');
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (bare === `/${locale}` || bare.startsWith(`/${locale}/`)) {
      return { locale, path: bare.slice(locale.length + 1) || '/' };
    }
  }
  return { locale: DEFAULT_LOCALE, path: bare || '/' };
}

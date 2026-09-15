/**
 * Looking a locale's words up - phases.md 8.11a, moved out of `src/` at 8.11b Gate C rev 3.
 *
 * **The words themselves are not here any more.** They live in `copy/`, one directory per
 * language and one file per surface, and `copy/config.ts` is the single file a language is
 * declared in. This module is what is left once the copy is gone: the lookup, the fallback
 * rule and the predicate the rest of the site asks about a locale. It holds no strings.
 *
 * The split is the point of the move (owner, 8.11b Gate C). A translator opens `copy/` and
 * meets nothing but sentences - no price in cents, no WCAG threshold, no route, no token
 * name, no feature flag - because a translator who *can* break one of those eventually will.
 * An engineer opens this file and meets no prose to accidentally edit. `src/data/` and
 * `src/lib/` keep the structure and logic they kept at 8.11a.
 *
 * **Islands do not import this.** `WaitlistForm.svelte` and `PlanToggle.svelte` take their
 * strings as a typed prop from their Astro parent. An island that imports the catalogue ships
 * *every* locale's strings to *every* visitor, which is a budget regression no test would
 * have caught - see the two islands' own notes.
 */
import {
  CATALOGUES,
  DEFAULT_LOCALE,
  LOCALES,
  type Catalogue,
  type Locale,
} from '../../copy/config';

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  PUBLISHED_LOCALES,
  WITHHELD_LOCALES,
} from '../../copy/config';
export type { Catalogue, Locale } from '../../copy/config';

function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

/**
 * Does this locale have words of its own yet?
 *
 * **The one predicate behind Gate A's single rule.** A locale that routes but has no
 * catalogue is not a language the site speaks; a page rendered under it is the English page
 * at a second address, and it says so - canonical home, no alternate of its own, no place in
 * that locale's sitemap, and `lang` on `<main>` naming the language the body is actually in.
 *
 * It is `false` for `es` until 8.11c writes it, which is why the Spanish route tree can ship
 * honestly before a single Spanish word exists. It flips for a whole locale at once, never
 * per key - see `catalogue()`.
 */
export function hasCatalogue(locale?: string): boolean {
  return isLocale(locale) && locale in CATALOGUES;
}

/**
 * The strings for a locale.
 *
 * Takes `string | undefined` rather than `Locale` so that every call site can be
 * `catalogue(Astro.currentLocale)` with no cast and no guard - `currentLocale` is
 * `string | undefined` on a route Astro has not matched to a locale.
 *
 * Falls back to the default locale for a language that has no catalogue yet. **That fallback
 * is deliberately the only one in the system and it is all-or-nothing**: a locale is either
 * fully present or it is English. There is no per-key fallback, because a per-key fallback is
 * how a page ships half-translated and nobody notices which half.
 */
export function catalogue(locale?: string): Catalogue {
  return isLocale(locale) && locale in CATALOGUES
    ? CATALOGUES[locale as keyof typeof CATALOGUES]
    : CATALOGUES[DEFAULT_LOCALE as keyof typeof CATALOGUES];
}

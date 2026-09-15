/**
 * Every language the site has, declared once - phases.md 8.11b, Gate C rev 3.
 *
 * **This is the only file you edit to add a language.** The whole procedure is three steps
 * and `copy/README.md` spells them out:
 *
 *   1. `cp -r copy/en copy/<code>` and translate the files in it.
 *   2. Import that directory below and add it to `CATALOGUES`.
 *   3. Add the code to `LOCALES` and its own name for itself to `LOCALE_NAMES` - and, if it
 *      is listed in `WITHHELD_LOCALES`, take it out, which is what publishes it.
 *
 * Nothing else in the repository changes. No route is added - every page lives under
 * `src/pages/[...locale]/` and is emitted once per locale. No link is edited - `src/middleware.ts`
 * prefixes every internal link at build time. No component is touched - each one already asks
 * `catalogue(Astro.currentLocale)` for its words. The switcher, the sitemap, `hreflang`, the
 * per-locale `404.html` and the honest marking of an untranslated page all read the lists
 * below and follow on their own.
 *
 * **`LOCALES` and `CATALOGUES` are two different questions and are deliberately separate.**
 * `LOCALES` is which languages *route* - which `/xx/` trees exist. `CATALOGUES` is which
 * languages have *words*. A locale in the first and not the second is a real, supported
 * state, not a half-finished one: it is the state `es` is in today, and `Base.astro` marks
 * such a page as exactly what it is - canonical pointing at the English twin, no alternate
 * claimed for it, out of that locale's sitemap, and `<main lang="en">` so a screen reader
 * switches voice at the body. Collapsing the two lists into one would make that state
 * unrepresentable, and the alternative to representing it is shipping a Spanish URL that
 * lies about being Spanish.
 *
 * **Plain TypeScript, no bundler features.** `scripts/check-contrast.mjs` imports a copy file
 * directly under `--experimental-strip-types`, so nothing here or under a locale directory may
 * use an `astro:` module, a `?raw` import or a path alias. That constraint is inherited from
 * 8.11a and is the reason the locale files import nothing at all.
 */
import { en } from './en';

/* 1 of 3 - the languages that route. Adding a code here creates its whole `/xx/` tree. */
export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

/** Unprefixed at the apex - `astro.config.mjs` and tech-stack.md §10. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The languages that are declared but **not published yet** - phases.md 8.11e.
 *
 * A withheld locale routes nowhere: no `/xx/` tree in `dist/`, no `hreflang`, no sitemap, no
 * entry in the switcher. It is still a *declared* language - `splitLocale` knows what its
 * prefix means and `copy/` may hold its words - it simply is not on the site yet.
 *
 * **`es` is here because 8.11c and 8.11d were deferred past launch** (owner, 2026-09-12).
 * Every `/es/` page was an English-bodied mirror until Spanish is written, which was approved
 * as an *interim* state at 8.11b and declined as a public one: a switcher offering *Español*
 * and delivering English is a promise the site cannot keep in front of a visitor. **Emptying
 * this array is the entire revert**, and 8.11c is what empties it.
 *
 * **Why this is a third list rather than deleting `es` from `LOCALES`.** The deletion is
 * shorter and leaves nothing to assert. Named here, the withholding is a fact a guard can
 * check - `tests/unit/withheld-locales.spec.ts` walks this array and fails the build if a
 * withheld locale reaches `dist/`, the head, the sitemap or the footer - so the day somebody
 * writes `copy/es/` and forgets this line, the build goes red instead of quietly shipping a
 * Spanish site nobody meant to publish.
 */
export const WITHHELD_LOCALES = ['es'] as const satisfies readonly Locale[];

/**
 * The languages the site actually emits. **Derived, never hand-maintained.**
 *
 * Everything that turns a locale into bytes reads this and not `LOCALES`: `localePaths()`,
 * the switcher, `Base.astro`'s alternates, the sitemap chunks and the per-locale `404.html`.
 * The things that *parse* a locale rather than emit one - `isLocale`, `splitLocale` - keep
 * reading `LOCALES`, because what a prefix means does not change with whether it ships.
 */
export const PUBLISHED_LOCALES: readonly Locale[] = LOCALES.filter(
  (locale) => !(WITHHELD_LOCALES as readonly string[]).includes(locale),
);

/**
 * 2 of 3 - what each language calls itself.
 *
 * **Endonyms, and they are the same in every locale on purpose.** The switcher is read by
 * somebody who does not speak the page they are on, so the one word they can recognise is
 * their own language's name for itself. Making these catalogue keys would invite the exact
 * opposite: a translator would dutifully render *Español* as *Spanish* in the English file,
 * and a Spanish visitor landing on the English home page would be hunting for a word that is
 * no longer on it.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
};

/**
 * Literal types widened to their primitives, structure preserved.
 *
 * `en` is authored with `as const` so it reads as data rather than as a type declaration,
 * which makes every value its own literal type - and `'Free'` is not assignable to `'Gratis'`.
 * Widening keeps the shape and frees the values, which is the guarantee wanted: same keys,
 * any words.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : { readonly [K in keyof T]: Widen<T[K]> };

/** The shape every locale directory is checked against. English is the one that defines it. */
export type Catalogue = Widen<typeof en>;

/**
 * 3 of 3 - the languages that have words.
 *
 * Typed against `Catalogue`, so a locale directory that is missing a key, or has invented
 * one, is a **compile error rather than a page that silently falls back**. That is what makes
 * adding a language safe to do in one sitting: the type checker reads out everything still
 * untranslated instead of the site shipping half of it.
 *
 * `es` is absent because no Spanish words are written yet - 8.11c - and its absence is what
 * every honest-marking rule on the site keys off.
 */
export const CATALOGUES = { en } as const satisfies Partial<Record<Locale, Catalogue>>;

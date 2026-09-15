# `copy/` - every word on the site

Each language is a directory. Each file in it is one surface of the site, written in the
order the page reads, so translating `/press` means opening `press.ts` and going top to
bottom rather than hunting through a single bag of keys.

Nothing here imports anything. No route, no price in cents, no WCAG threshold, no token
name, no feature flag - those live in `src/data/` and `src/lib/` and are deliberately out of
reach, because a translator who _can_ break one of those eventually will.

```
copy/
  config.ts      the only file you edit to add a language
  en/            the authored locale; its shape is what every other one is checked against
    ui.ts        chrome - header, footer, skip link, blog and error strings
    home.ts      the home route's four acts
    pricing.ts   /pricing
    press.ts     /press
    brand.ts     /brand, tabular and running prose both
    waitlist.ts  /waitlist, including the form's error messages
    index.ts     collects the six above
```

## Adding a language

Three steps, and nothing outside this directory changes.

1. **Copy the default locale and translate it.**

   ```sh
   cp -r copy/en copy/fr
   ```

   Keep the filenames and the keys; change only the values.

2. **Declare it in `copy/config.ts`** - import the directory, add the code to `LOCALES`, add
   the language's own name for itself to `LOCALE_NAMES`, and add it to `CATALOGUES`.

3. **Run `npm run verify`.** The type checker reads out every key still missing or misspelled,
   by file. There is no partial state to discover later: a locale is either complete or the
   build is red.

That is the whole procedure. You do not add a route - every page lives under
`src/pages/[...locale]/` and is emitted once per locale. You do not edit a single link -
`src/middleware.ts` prefixes every internal link at build time, so a `<a href="/pricing">`
written anywhere becomes `/fr/pricing` on a French page on its own. You do not touch a
component - each one already asks `catalogue(Astro.currentLocale)` for its words. The
switcher, `hreflang`, the sitemap, the per-locale `404.html` and the canonical tags all read
the config and follow.

## Routing without words

`LOCALES` and `CATALOGUES` answer two different questions on purpose: which languages
**route**, and which have **words**. A locale in the first and not the second is a supported
state, not an unfinished one - it is where `es` sits today. Such a page is marked as exactly
what it is: its canonical points at the English original, it claims no `hreflang` of its own,
it stays out of that locale's sitemap, and `<main lang="en">` makes a screen reader switch
voice at the body and back. Adding a code to `LOCALES` alone is therefore a deliberate move,
not a half-finished one.

## Nothing here reaches a visitor twice

The copy is a static import. It is bundled into the built HTML, so a page ships with its
words already in it - there is no request, no API, and no runtime cost to having any number
of languages. A language you add costs the visitor who does not read it exactly nothing:
islands take their strings as a typed prop from their Astro parent rather than importing the
catalogue, so no visitor ever downloads a locale they are not reading.

## Guards

- `tests/unit/copy-structure.spec.ts` - a directory nothing imports, a code with no
  directory, a locale with no name, or a file missing from a locale.
- `tests/unit/i18n-catalogue.spec.ts` - a user-visible string that escaped into `src/`.
  Every exemption is in `src/i18n/allowlist.ts` with its reason.

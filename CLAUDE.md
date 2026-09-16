# CLAUDE.md - sonaru-frontend-lander

Astro marketing site for Sonaru, served at `https://sonaru.app`. Third repo in the Sonaru
workspace, sibling to `sonaru-backend` and `sonaru-frontend-ios`.

## Read this first

**Every design decision in this repo is gated by human review.** The protocol is
`../specs/lander/review-gates.md` and it is binding: concept → owner approves → plan →
owner approves → build → the owner runs it and says how it looks → owner approves. A gate
is never self-approved, never inferred from silence, and never batched with another gate.
Once Gate C passes, that section's appearance is frozen.

The specs live in the workspace repo, not here:

| Document                                 | What it governs                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `../specs/lander/review-gates.md`        | The gate protocol. Wins over every other document.                                                                                           |
| `../specs/lander/mission.md`             | What the site is for, the two audiences, the hard requirements                                                                               |
| `../specs/lander/reference-study.md`     | Measured study of gsap.com / revolut.com / superlist.com. **Cite it in every gate submission** (§8 lists which reference each section cites) |
| `../specs/lander/design-system.md`       | Colour, type, motion, device mockups, artwork                                                                                                |
| `../specs/lander/tech-stack.md`          | Stack, hosting, CI gates                                                                                                                     |
| `../specs/lander/phases.md`              | The section-by-section plan                                                                                                                  |
| `../specs/lander/acceptance-criteria.md` | Definition of done                                                                                                                           |
| `../specs/lander/gate-log.md`            | Append-only record of every gate. Written at approval, never rewritten                                                                       |

**This repo consumes no Sonaru API** and does not read `sonaru-backend/docs/openapi.json`.
The only server-side code is `functions/` (Cloudflare Pages Functions), which owns the
waitlist endpoint. A backend deploy can never break this site, and this site can never
block a backend contract change.

## Commands

```
npm run dev        # http://localhost:4321
npm run dev:host   # LAN URL, for checking on a real phone at Gate C
npm run verify     # typecheck + lint + format + contrast + build - what CI runs
npm run contrast   # token contrast against WCAG 2.2 AA
```

## Non-negotiables

- **No hex literal outside `src/styles/tokens.css`.** The contrast validator parses that
  file, so a colour defined anywhere else is a colour nothing checks.
- **No magic duration outside `src/motion/tokens.ts`.** Components call a timeline
  factory from `src/motion/timelines/`; they never author tweens inline.
- **Every timeline is defined inside the `gsap.matchMedia()` context** in
  `src/motion/reduced-motion.ts`, so its reduced-motion variant is written next to it and
  cannot be forgotten. Reduced motion is a _designed_ experience, not a kill switch.
- **`any` is banned**, along with `@ts-ignore` and unjustified `eslint-disable`.
- Animate composited properties only - `transform` and `opacity`. Never `width`, `top`,
  `filter` or `box-shadow` in a scrubbed timeline.
- Everything inside a device mockup is `aria-hidden`; the surrounding real copy carries
  the meaning. A screen reader must never have to walk a fake app.
- Conventional commits. `main` protected. Every change lands through a CI-gated PR.

## Layout

```
copy/                every word on the site - one directory per language
copy/config.ts       the only file a language is declared in
src/components/{primitives,device,sections,islands}/
src/motion/          tokens · registry · reduced-motion · timelines/
src/pages/[...locale]/  routes, emitted once per locale (en unprefixed, es under /es/)
src/middleware.ts    prefixes internal links at build time - never do this at a call site
src/i18n/            catalogue lookup and routing helpers; no strings
src/styles/tokens.css
src/content/         blog, changelog, legal, showcase artwork manifest
functions/           Cloudflare Pages Functions (waitlist)
scripts/             build + design tooling (contrast validator)
tests/{e2e,visual,unit}/
docs/                ADRs
```

## Status

Phases 8.0 (reference study), 8.1 (foundations), **8.2 (the hero, plus a header), 8.3 (act
one), 8.4 (act two - the chronological feed) and 8.5 (act three - the notification) are
complete and approved** (8.4 and 8.5 both on 2026-09-04). **8.6 (act four - auto-add and
the final CTA) is complete and approved - Gate C APPROVED 2026-09-06 at rev 3**, after the
2026-09-04 reorder (rev 1) and the 2026-09-05 four-change round (rev 2). **The whole home
route is now frozen**: hero, act one, act two, act three (playlist) and act four
(notification). 8.6's Gate B was approved on the owner's instruction to "approve the plan
for 8.6 and build it", so the plan was written and built in one pass -
`../specs/lander/phases.md` §8.6 flags the one thing in it the owner has not individually
decided, the sub-line's exact wording. **8.7 (the pricing page) is complete and approved - Gate C
APPROVED 2026-09-06 at rev 3**, `npm run verify` green at 130 tests. Three revisions, and
the title band was the whole of it: it opened on the word `Pricing` at up to 256px, lost
its plum accents at rev 1, and was abandoned outright at rev 2 - _"too big, nothing shows
on smaller screens"_ - for an eyebrow plus the claim as `h1`.
**8.8 (the waitlist route and the App Store CTA) is complete and approved - Gate C APPROVED
2026-09-07 at rev 2**, `npm run verify` green at 188 tests. The one owner change was the
header, which had gone on offering "Join the waitlist" in the corner of the waitlist.
**8.9 was decomposed into six gate units** (owner, 2026-09-07), because its checklist was
six independent subsystems and `review-gates.md` §3.3 forbids batching them under one
approval: **a** footer · **b** `/privacy`, `/terms`, `/support` · **c** content engine and
blog · **d** seed posts · **e** changelog · **f** 404/500. Legal deliberately runs ahead of
the engine so the three App-Store-blocking documents do not wait behind RSS and OG image
generation, and **long-form typography is settled once in 8.9b** - on the legal pages,
where the type has nothing to hide behind - then inherited by the blog. **8.9a (the footer)
is complete and approved - Gate C APPROVED 2026-09-07 at rev 1**, `npm run verify` green at
217 tests. **8.9b (`/privacy`, `/terms`, `/support`) is complete and approved - Gate C
APPROVED 2026-09-07 at rev 3**, `npm run verify` green at 274 tests. It settled long-form
typography for the site, made sonaru.app the **canonical** home of the legal documents (a
three-repo change: the backend's `/api/legal/*` routes now 301 here, `openapi.json` was
refreshed, and iOS links the site), published the takedown contact, and paid 8.8's debt of
a privacy link. Its two Gate C change rounds were both about the bloom - see the closed
seam note further down. **8.9c (the content engine and the blog) is complete and approved -
Gate C APPROVED 2026-09-08 at rev 3**, `npm run verify` green at 375 tests. It added
`/blog`, `/blog/[slug]`, `/blog/tags/[tag]` and `/blog/rss.xml` on a Zod-typed collection
behind the same `Document.astro`, installed MDX, and generates one PNG per post that is
both the card's cover and its `og:image`. Two of its changes reach the whole site and are
described below: **the header's scroll-driven scrim** and **the reading pair (band D)**.
**8.9d (the three seed posts) is complete and approved - Gate C APPROVED 2026-09-08 at
rev 2**, `npm run verify` green at 376 tests. Its drafts already existed, written at 8.9c
because the engine had to render something, and **8.9c's approval deliberately did not
cover their copy** - the two were gated separately rather than allowed to blur. **A post's
`publishedAt` is an instant, not a date** (owner, Gate A: _"datetime ordered"_): three posts
on one day left a date-only sort key tied, and `localeCompare` returning 0 hands the index's
order to whatever the content loader happened to return. It is UTC only, because an offset
would sort before a `Z` instant it actually follows, and `tests/unit/blog-inventory.spec.ts`
fails if two posts ever share one. The reader is never shown a time. **8.9e (the changelog)
is complete and approved - Gate C APPROVED 2026-09-09 at rev 2**, `npm run verify` green at
406 tests. `/changelog` is the release notes themselves **stacked and rendered in full**,
newest first, on the same `Document.astro` - the third route to reuse it, and the unit adds
no new layout and no new token. That shape is measured, not chosen: superlist's changelog is
at `/updates`, gsap has none at all (release notes are blog posts under a `release` tag),
they agree on nothing else, and **both render entries in full rather than as cards**.

**The unit's whole difficulty is that Sonaru has never shipped.** No git tag, no App Store
record, no TestFlight build - so `releasedAt` is **optional** and the one entry renders
`Version 1.0 · Not yet released`. That is true today and becomes a date the day the build
ships; writing today's would have been the fabrication **8.9a already refused** when it
dropped superlist's `version 1.57.0` footer line as marketing copy for an unpublished app.
`tests/unit/changelog-inventory.spec.ts` allows exactly one undated entry, and two
assertions in `tests/e2e/changelog.spec.ts` pin the wording and the absent `<time>` **so
they fail deliberately when 8.13 fills the date in**. Entries are titled by what shipped,
never by their number; the version is the anchor and one half of the meta line.

**8.9f (the 404) is complete and approved - Gate C APPROVED 2026-09-09 at rev 1**, `npm run
verify` green at 430 tests, and the second unit in the project to pass without a change
round after 8.9a. **`/404` is the site's own chrome with a sentence over it**: the eyebrow
carries `ERROR 404`, the `h1` is a sentence, the lede's last clause points at the footer,
and there is one button home. No new layout, no new component, no new token.

**The design decision is the chrome, and it is taken against superlist.** Both references'
404s were measured at Gate A and they agree on only three things - the numeral is never the
headline, there is exactly one call to action, and something moves. gsap keeps its full
header, mega-nav and footer; superlist has none at all and is one viewport. **We keep ours
because 8.9a built the footer as an inventory of the routes the site offers**, so a 404 with
that footer under it already _is_ the "here is where you meant to go" page - which is why
the unit needed nothing new. `noindex` is the one thing taken from superlist verbatim.

**There is no `/500`, and that is a finding rather than a shortcut** (owner, Gate A, option
A). The site is `output: 'static'` so no origin can fail; `functions/api/waitlist.ts` never
returns 5xx by design and is `fetch`ed rather than navigated to; and Pages has a `404.html`
convention but **no `500.html` convention**. A designed `/500` would be a route nothing can
reach and no test can exercise. Do not add one back as cleanup.

**The unit found a gap in the site rather than in itself: the footer cannot offer
`/pricing`.** That entry was dropped at 8.9a's Gate A and the route was orphaned until
2026-09-15; this is the first page where it cost something, because the whole design says the
footer has everything. `tests/e2e/404.spec.ts` asserted the hole and turned red the day it
closed - **which is exactly what happened**: the SEO audit found no built page linking
`/pricing`, the owner restored the footer entry as "Pro", and the test now asserts the link.
Found by a failing assertion, not by reading the spec.

**Route discovery did the test wiring.** `/404` enters `tests/visual/routes.ts` by filename,
so the seven guards built on `ROUTES` covered it the moment the file existed. **8.13 carries
the half that cannot be proven locally**: `dist/404.html` is demonstrably built, but Pages
_serving_ it for an unmatched path is documented rather than testable here - check the
status code, not just the page, because a 404 served with a 200 is a soft 404.

**8.10 is decomposed into four gate units** (2026-09-09), for the reason 8.9 was split into
six: **a** the OG image system · **b** `/press` · **c** `/brand`, the identity document ·
**d** the PDF. The logo unit that would have led it does not exist - the mark was already
final (see below), and only `../specs/lander/` had failed to record it.

**8.10a (the OG image system) is complete and approved - Gate C APPROVED 2026-09-09 at
rev 1**, `npm run verify` green at **474 tests** - the third unit to pass without a change
round, after 8.9a and 8.9f. `Base.astro` emits the whole `og:`/`twitter:`/canonical block for **every**
route from the `title` and `description` props each already passed, so the unit needed **no
new copy anywhere**. Before it, three routes emitted an `og:image` and **twelve did not** -
including `/` and `/waitlist`. Nothing failed, because a bare `<head>` is only visible in
somebody else's timeline.

- **One card for the site, per-post covers for posts.** Measured at Gate A, not assumed:
  gsap and superlist each serve **one image across their whole site** and vary only the
  title; only blog posts get their own. `ogImage` defaults in `Base`, so **a new route is
  covered by existing rather than by remembering** - do not move these tags back into pages.
- **The site card is `PostCover.astro` reused**, photographed from `/og/site` by `npm run
og`. One composition on this site, not two. A share of `/` therefore looks like a share
  of a post; that was disclosed at Gate B and approved.
- **`public/og-default.png` and `ogHtml()` are deleted.** Unreferenced since 8.1, 281 KB of
  PNG, `system-ui` not Satoshi, 1200×630 against the covers' 1200×600, and a line -
  _"Never miss a beat."_ - that appears **nowhere on the site**; it is `/specimen`'s filler
  string. The replacement is 34 KB.
- **`src/data/claim.ts` is the single source of "Never miss a release again."** It was
  hardcoded in `Footer.astro` and `Notify.astro`, both frozen behind Gate C. Pointing them
  at the module was approved explicitly and is **proven inert - 160 baselines compared, 0
  changed.** The card's staleness hash can only guard a string it can read.
- **`isCameraStand()` in `tests/visual/routes.ts` replaces four copies of
  `startsWith('/blog/og/')`.** A stand renders no `Base` at all, so every chrome guard must
  skip it, and four separate copies of that string is the silent narrowing `routes.ts`'s own
  header warns about. **Add a stand anywhere and the guards already know.**
- **A latent flake was found and fixed on the way** (`review-gates.md` §4, test code).
  `tests/e2e/blog.spec.ts`'s tag test asserted on a bare `locator('h1')`, and **Astro's dev
  toolbar injects four `<h1>`s** that Playwright's locators reach through its open shadow
  root. The test had been **racing the toolbar's hydration and winning**: `goto` resolves on
  `load`, the toolbar mounts after. 8.10a's head tags perturbed the timing and it began
  losing consistently - and a **strict-mode violation is an error, not a retryable
  mismatch**, so `toHaveText`'s polling could not recover. Scoped to `main h1`; verified with
  the toolbar deliberately mounted, where the bare locator still matches five and the scoped
  one matches one. **Assert against `main`, never the document, in a suite that runs against
  `astro dev`.**
- **The canonical URL strips its trailing slash.** `trailingSlash` is `'ignore'`, so
  `Astro.url.pathname` returns whatever was requested - a canonical that differs between two
  requests for one page is worse than none, because it is what a search engine dedupes on.

**8.10b (`/press`) is complete and approved - Gate C APPROVED 2026-09-10 at rev 2**, `npm
run verify` green at **525 tests**. It is a **press kit, not a newsroom**, and that is
measured: superlist has no press surface at all (`/press`, `/brand`, `/about` all 404),
gsap has only a `/brand` docs page with one zip, and cash.app and revolut both ship
newsrooms with the kit as a footnote - and Sonaru has no news. So the footnote is the page.
**No stat tiles**: cash.app's three are their strongest asset and a pre-launch product
cannot honestly fill one.

- **`npm run press` generates the kit and the output is committed**, the way `npm run og`
  works. The site build never runs it, so the sibling iOS checkout is needed to
  _regenerate_ and never to build. Logo rasters are **photographs of the site's own
  components** from `/og/press-assets`; the SVG is drawn from `mark-geometry.ts`.
- **There is no vector lockup.** The wordmark is live Outfit text and §9.5's dropped work
  must not be reopened. **The light colourway is two token overrides** on a wrapper -
  `--color-white` and `--color-plum-300` - so neither brand component was edited.
- **`src/lib/tokens.ts` exists because hex outside `tokens.css` is banned** and this is the
  first page that _prints_ the palette. **The caller passes the stylesheet text**: Vite's
  `?raw` in Astro, `readFileSync` in Node. Reading it here through `import.meta.url` works
  in `astro dev` and is `ENOENT` in a build, because the module lands in
  `dist/.prerender/chunks/` - **only `npm run build` catches that**.
- **`100vw` is the viewport including a classic scrollbar; the usable width is
  `clientWidth`, which excludes it.** That ~15px is why the owner saw horizontal scroll on
  a page this machine measured clean at every width from 320 to 1600 - macOS draws overlay
  scrollbars unless a mouse is attached. **`body { overflow-x: clip }` in `Base.astro` is
  the floor**, `clip` and never `hidden` (which establishes a scroll container and breaks
  every pin), and `tests/e2e/no-horizontal-scroll.spec.ts` walks every route at four widths.
  **Do not size anything from `100vw`.** `Document.astro`, `blog/index` and
  `blog/tags/[tag]` still do and are carried to 8.12.
- **Astro _inlines_ a small hoisted `<script>`** rather than emitting a file, which the CSP
  without `unsafe-inline` forbids. The knob is `vite.build.assetsInlineLimit`, **not**
  `build.assetsInlineLimit` - the Astro-level key is read by nothing and the first fix
  changed exactly zero bytes of output.
- **Generated rasters are not byte-stable.** A fractional `deviceScaleFactor` makes text
  antialiasing irreproducible: one pixel in 277,504, differing by 21/255, which the OG
  generator's `max <= 16` cap called a change. `scripts/lib/image-compare.mjs` is now shared
  by both generators.
- **Size images from the layout.** The gallery's thumbnails were planned at 720px for a slot
  that is 130px wide - 272 KB to paint 5.5× the pixels needed, and the "properly size
  images" audit that costs Lighthouse 100.

**8.10c (`/brand`) is complete and approved - Gate C APPROVED 2026-09-10 at rev 1**, `npm
run verify` green at **549 tests**. It is an **identity document, not a permissions page**,
and that is measured: seven sites were probed and **almost nobody ships this page** -
superlist has no `/brand`, gsap's is 734 words with no usage rules and no contrast data,
linear's clear-space rule is the sentence "plenty of space", stripe's prints no hex at all,
and cash.app has none (`/design` is a **$cashtag payment page**). The real thing exists only
as a separate property, like mailchimp's seventeen chapters on its own subdomain. **We build
the second kind because the first kind is `/press`** - gsap's and linear's `/brand` are, section
for section, our press page.

- **Never name a class after a Tailwind utility.** `<nav class="contents">` rendered with
  **no box at all**: `.contents { display: contents }` erases the element's box, and
  Tailwind v4 generates utilities **on demand by scanning source**, so _using the name is
  what created the rule that broke it_. A scoped Astro rule out-specifies a bare utility
  **only for the properties it declares** - the danger is the one it leaves unset. **Rename
  ours; never out-specify**, because a name the framework owns can start declaring
  something new without us touching a file. `tests/e2e/utility-collisions.spec.ts` walks
  every route for this and keeps a `KNOWN` list of the two names we share on purpose.
- **Nothing on `/brand` is a number typed by hand**, and that is the page's whole claim.
  Construction figures call `mark-geometry.ts` (which gained `guides()`, since `CX`/`CY` are
  private); the palette comes from `tokens.css` via `src/lib/tokens.ts`'s new `palette()`;
  the **26 pairings** and their ratios are `src/lib/contrast.ts`, shared with
  `npm run contrast` so **the page cannot print a ratio CI does not enforce**. The validator
  **keeps its own hex parser** - it is the _reading_ that must stay independent, not the
  table of what we claim.
- **`npm run contrast` now runs under `--experimental-strip-types`**, matching `brand` and
  `press`, because the shared table is TypeScript.
- **Assert against the build, not the dev server, for anything about shipped bytes.**
  `/brand` ships **zero JavaScript**, but `astro dev` injects an HMR client and a dev
  toolbar - so the claim is checked against `dist/brand/index.html` in the unit suite, not
  against the DOM in an e2e test.
- **The visual suite photographs an atmosphere no visitor sees.** A `fullPage` capture
  resizes the viewport to the document height, and `Document.astro`'s `.atmosphere` is
  `100svh` - so at the shutter it is **14,196px tall on `/brand` instead of 900**. Baselines
  are consistent but not faithful, and on the two tallest pages not even reproducible:
  `/brand` drifts 807 px between runs, `/press` 2,005, both inside `SHOT`'s tolerance.
  Carried to 8.12; the fix is in `tests/visual/support.ts` and would move every baseline.
- **`/logo` is deleted** - it folded in here, which is what removed it. It had drifted three
  ways: still "provisional", still listing the two dropped items as open, and still naming
  the logotype **Satoshi** where `Wordmark.astro` sets Outfit. **`/logo/lab` stays** and
  8.13 must not take it.
- **Two new brand decisions were taken here** because §9.5 defined neither: **clear space of
  one stroke width** (in `PRESET.stroke`, so it scales) and a **20px minimum**.

**8.10d (the PDF) is complete and approved - Gate C APPROVED 2026-09-10 at rev 1**, `npm
run verify` green at **554 tests**. `public/brand/sonaru-brand.pdf` is **24 A4 pages,
810 KB, zero JS**, offered from `/brand` and `/press`.

- **The PDF is `/brand` printed, and there is no second copy of it.** `npm run pdf` drives
  the Chrome Playwright already has; the page's own `@media print` block is the entire
  specification, so **Cmd-P on the route gives the file we ship**. Never add a print-only
  route, a PDF library or a template - that is a second identity document, wrong the first
  day one of them is edited.
- **Chrome rasterises every `position: fixed` layer once per printed page.** That made the
  first render a **12.8 MB** PDF from four layers - the ground's `background-attachment:
fixed`, the noise dither, the fixed header, the bloom - as 132 image objects, 32 of them
  full-page plates. Neutered in print: **810 KB**. If a printed page is inexplicably huge,
  count the fixed layers before anything else.
- **A root background paints the page _box_; the margin band is the canvas**, painted from
  `color-scheme` - so a dark document prints `#0b0a0b` inside a `#121212` frame. Fix is
  `@page { background: var(--ground-solid) }`, and **`var()` resolves inside `@page`**, so
  it stays a token. Diagnose it by forcing `color-scheme: only light` and watching the
  frame turn white.
- **`break-inside: avoid` on a block taller than the page is worse than nothing.** It
  cannot be honoured, so Chrome pushes the block to a fresh sheet and breaks it there
  anyway - five wasted sheets against 18 of content, here. **Measure at the printed column
  width** (A4 less margins is 673×986 at 96dpi), not the viewport's: the type ramp looked
  too tall at 967px and is actually 892px and fits. Tall blocks break between rows, with
  `thead { display: table-header-group }` repeating column heads across the fold.
- **Chrome's paged media is missing two things and no amount of CSS supplies them:**
  `footerTemplate` gets only `pageNumber`/`totalPages`/`title`/`url`/`date` and Blink
  implements **none of CSS Generated Content for Paged Media**, so no `@page {
@bottom-left }` and no `position: running()`; and there is no `target-counter()`, so a
  contents page cannot carry page numbers. Use `outline: true` (plus `tagged: true`) and
  let the reader's bookmark pane be the chapter list.
- **Never write a bare `:global(.foo)`.** `:global(.masthead)` compiles to `.masthead { … }`
  and **`tests/e2e/utility-collisions.spec.ts` failed on it, correctly** - that guard's
  premise is that a scoped rule always carries its attribute selector, and a bare
  `:global()` is how the premise breaks: in the cascade our rule becomes indistinguishable
  from a framework utility. Anchor it (`:global(.document .masthead)`); do **not** add ours
  to `KNOWN`, which is for names Tailwind owns. **The guard reads only bare single-class
  selectors, so grouped ones pass unread** - carried to 8.12, owner's call.
- **`npm run pdf` output is committed and its manifest hashes all eleven inputs**, so
  editing `brand.ts`, `tokens.css` or `motion/tokens.ts` without re-running it is a red
  build. Unlike `press-assets.spec.ts`, this guard can claim everything: no input lives
  outside this repo.

**8.10e (the header navigation) was BUILT AND REJECTED - Gate C, 2026-09-10.** Owner:
_"I don't like the links being in the header. Remove them completely, so they are only on
the footer. Keep the Pricing link removed on the footer."_ The first unit in the project to
be deleted after passing A and B.

- **The header is the mark and one action, permanently. Do not add a nav.** It is the one
  thing on this site that has been built, measured against four references, and turned
  down. `Header.astro`'s comment and `design-system.md` §9's inventory both record the
  rejection - the inventory entry is **struck through rather than deleted**, because an
  absent line reads as a gap and a struck one reads as a decision.
- **~~`/pricing` stays orphaned and is carried to 8.13~~ - closed 2026-09-15/16 by the
  owner**, after the SEO audit found that no built page linked it. It is linked twice now:
  from the home page's "About Sonaru" section, and from **the footer entry itself**, which
  the owner restored as "Pro". **The header's rejection above still stands** - that door is
  the one that stayed shut, and a nav is still not the answer to anything.
- **A closed `<details>` slots its content into a user-agent shadow tree and stops painting
  it.** `display: contents` on the parent does not reach that, so a nav promoted inline
  that way is in the DOM, in the accessibility tree, correctly coloured and **invisible**.
  `::details-content` is the standard hook and is Chrome 131+. If you ever need one list to
  be both inline and disclosed, render two and hide one by media query.
- **`getBoundingClientRect().width > 0` is not a visibility test.** That content keeps
  layout boxes while unpainted, so a box-based probe reports links a visitor cannot see -
  it sent 8.10e chasing a defect that did not exist. Use `checkVisibility()`, Playwright's
  `:visible`, or a screenshot.
- **`innerText`, not `textContent`, in tab-order and accessible-name tests.** `textContent`
  concatenates `display: none` siblings, so a responsive two-label button reads as
  "Join the waitlistWaitlist" while its accessible name is correct.

**8.11 is internationalisation, split into four units** (a extraction · b routing · c Spanish
interface copy · d Spanish long-form). **8.11a (string extraction) is complete - Gate C
APPROVED 2026-09-11 at rev 1**, and **8.11b (locale routing) is complete - Gate C APPROVED
2026-09-11 at rev 4**, `npm run verify` green at **714 tests**. `../specs/lander/gate-log.md`
has the full chain; 8.2 alone took twenty-four Gate C revisions. **Next is 8.11c**, which is
blocked on the native-speaker reviewer `tech-stack.md` §10 records - a **launch blocker in
8.13**, not a formality.

**Every word on the site lives in `copy/<locale>/`, and `copy/config.ts` is the only file a
language is declared in.** One directory per language, one file per surface. `src/i18n/` is
the machinery - `catalogue()`, `hasCatalogue()`, the fallback - and holds no strings.
**Adding a language is three steps and touches nothing else**: copy the directory, declare it,
run `npm run verify`, which reads out every key still missing. No route, no link, no
component. `copy/README.md` is the procedure and `tests/unit/copy-structure.spec.ts` is the
guard. **`LOCALES` and `CATALOGUES` are two lists on purpose** - which languages _route_ and
which have _words_ are different questions, and a locale in the first but not the second is a
supported state, not an unfinished one. It is where `es` sits today: the whole `/es/` tree
builds and is honestly marked as not yet Spanish (canonical at the English twin, no `es`
alternate, out of the Spanish sitemap, `<main lang="en">` so a screen reader switches voice at
the body). `catalogue()`'s fallback is **all-or-nothing and is the only one in the system** -
never add a per-key fallback, which is how a page ships half-translated.

**Internal links are prefixed at build time by `src/middleware.ts`. Do not prefix at a call
site.** `localePath()` having exactly one caller is what shipped a site where switching
language survived one click. The middleware rewrites page-shaped internal `href`s inside `<a>`
tags on prefixed-locale pages only; it skips anything with a file extension, fragments,
`mailto:`, external URLs, and **any anchor carrying `hreflang`** - an anchor that declares its
destination's language has already chosen a locale, which is what keeps the switcher's own way
back intact. It runs during prerendering, so `dist/` ships correct and the visitor pays
nothing. A new link anywhere is correct without anybody remembering the file exists.

**Never select an anchor by tag in a layout.** `Document.astro`'s `.prose :global(a)` gave
`/press`'s download button an underline, because `Button` renders an `<a>` when given an
`href`. It hid for two units: the bar is `scaleX(0)` at rest and only the **reduced-motion**
branch pins it visible, so the defect was shown exclusively to visitors who asked for less
movement while every default-motion baseline passed. The rule is `a:not([class])` - Markdown
emits a classless anchor, a component-rendered one carries its class.
`tests/e2e/prose-decoration.spec.ts` walks every route **in both motion modes** and asserts on
which CSS rules matched rather than on computed style: computed style cannot tell a component
styling itself from a layout reaching in, and the first version of that guard flagged `a.tag`,
which is correct markup. **Check reduced motion whenever a rule has a reduced-motion branch** -
a default-motion-only check passed against this live defect.

**~~A dev server started before a dependency lands serves a stale Vite pre-bundle.~~ ROOT
CAUSE FOUND 2026-09-12, and it is a missing line of config rather than a restart ritual.**
The symptom was described here twice and blamed on the daemon both times: **504 Outdated
Optimize Dep** on `gsap`, `window.gsap` `undefined`, every timeline, scrub and pin on the site
dead, and the built output perfect. The cause is that **Vite never pre-bundles the motion
layer's four dependencies, because nothing it scans imports them.** Its scanner crawls HTML
and what it can reach from there; the only entry into `src/motion/` is an Astro page
`<script>`, which the Astro compiler extracts into a module of its own, and `ScrollTrigger`
and `lenis` sit one level further behind `await import(...)` in `registry.ts`. So all four are
_runtime_ discoveries: the server optimises them mid-run, bumps its browser hash, and every
module already holding the previous `?v=` stops resolving.

**The fix is `optimizeDeps.include` in `astro.config.mjs`'s Vite block**, naming all four.
They are pre-bundled at server start and never re-discovered.

**What it looked like before the fix, so it is recognisable if it ever returns:** 67 tests red
on a completely unmodified tree - act one, act two, the notification and the playlist entirely
red, `hero-lights` **green**. That split is the diagnosis: the hero calls `initMotion()` and
never loads ScrollTrigger, and every red section calls `initScrollMotion()`. **Warming the
server does not fix it** and neither does the restart ritual for longer than one run;
`rm -rf node_modules/.vite` only buys a fresh window. Confirm it in one command rather than by
re-running the suite:

```
curl -s http://localhost:4321/src/motion/registry.ts | grep -oE '/node_modules/\.vite/deps/gsap[^"]*'
```

Three different `?v=` hashes on one line means the graph is mid-re-optimisation. Then check
`node_modules/.vite/deps/_metadata.json`: if its `optimized` list has no `gsap` in it, the
scanner never saw them and `optimizeDeps.include` is missing or wrong.

The old restart sequence is still the right response to the _other_ members of this family
(two daemons on the port, stale scoped styles): `npx astro dev stop`, then
`lsof -ti:4321 | xargs kill -9`, then `rm -rf node_modules/.vite`, then a hard reload, since a
normal one re-serves the failed module.

**And after deleting `node_modules/.vite` - or changing `astro.config.mjs` - load a page and let
the server settle before running the suite.** A config change is the second trigger and it is
easy to miss, because nothing about it looks like a cache operation: the server logs
`Re-optimizing dependencies because vite config has changed` on the next request and reloads
the page with it. Adding two integrations in 8.13 cost one test that way, on a run that was
otherwise 674 green. Vite logs _"Forced re-optimization of dependencies"_ on the first load afterwards
and forces a **full page reload** with it, which destroys whatever execution context is in
flight - one test died that way on an otherwise green 715, with
`page.evaluate: Execution context was destroyed, most likely because of a navigation`. It
passed 3/3 alone on the settled server. A single navigation-shaped failure in a scrubbed
section, right after a cache wipe, is this and not the section.

**`npm run pdf` and `npm run og` have input-hash guards, and they are doing their job when they
go red.** `public/brand/manifest.json` hashes eleven inputs including `Document.astro` and
`copy/en/brand.ts`; both fired during 8.11b - once for the copy move, once for the prose-link
fix - and the answer is to re-run the generator, never to edit the manifest.

**The header is no longer transparent once there is something behind it** (owner, 8.9c Gate
C rev 2). It had been transparent since 8.2 and content always passed under it; the blog is
simply the first route whose content is a 700px image carrying its own white display type,
so a post's hook and the wordmark land at the same size, in the same colour, on the same
pixels. **Padding does not reach this** - at rest the masthead already clears the 92px
header by 36px, and the collision happens while scrolling. `Header.astro::before` is a
gradient (not a bar - a hard strip across the top of the hero is a second horizontal seam)
driven by `animation-timeline: scroll()`, so the blog routes keep their zero-byte JS budget;
the `@supports` fallback leaves it on permanently, which is the safe state. **It has no
reduced-motion override on purpose**: nothing is hidden either way and nothing moves, and
pinning it on repaints the top 122 rows of routes that have nothing behind the header to
darken.

**It is off on `/` (owner, 8.9e's Gate C), and the exception is asserted in both
directions.** The home route is the one page the scrim was never for: 8.9c reasoned about
it entirely from the blog, where it is needed and invisible, and `/` is the site's only
full-bleed composition, so the band reads _as a band_ across the hero and the acts.
`showsScrim` in `Header.astro` derives it from the path the way `showsWaitlistAction`
does. **The visual suite does not cover this** - measured, not assumed: regenerating all
152 baselines after the change produced **0 changed pixels**, because the section suites
capture at scroll offsets where the ground behind the header is already `--ground-solid`
and the scrim composites ground over ground. Sampled across the whole page it is worth up
to **165,827 changed pixels** at the top of the hero. So the guard is
`tests/e2e/header.spec.ts`, which asserts `content: none` on `/` at rest _and_ scrolled,
and `ok` on every other route. **Assert `content`, not opacity**: with the rule gated off
no box is generated, and `getComputedStyle(el, '::before').opacity` still answers `1`.

**Reading copy has its own type token.** `--text-prose` (16 → 20px) and `--measure-prose`
(`calc(35 * var(--text-prose))`, ~80 characters at 1440) are what `Document.astro` sets;
`--text-body` and `--measure` are unchanged and still belong to the hero, the acts,
`/pricing`, `/waitlist` and the footer, all frozen. **Raising `--text-body` instead would
have repainted every one of them** - that separation is the whole reason the token exists
(owner, 8.9c Gate C rev 2, band D). `--measure-prose` is a **length, not an `em` value**:
`em` re-resolves against each element's own font size, and one token capping both the
masthead (16px inherited) and the prose (18px set) produced a 480px title block above a
540px body, i.e. the largest type on the page wrapping in the narrowest column on it.
`--measure-wide` is what code blocks and figures are allowed to use.

**`npm run og` and the blog's visual baselines are one change, not two.** The covers are
rendered by driving a real page, so anything that changes how `BloomField` paints changes
the covers - and 8.9c's reduced-motion specificity fix did exactly that. The generator pins
every animation to `currentTime = 0`; before the fix the orbs froze at the _animation's_
first frame, after it they take the reduced-motion `transform` positions instead. Different
orb placement, 573,539 differing pixels on `/blog` at 1440, entirely inside the three cover
rectangles. **It shipped in `632fcf3` - covers from after the fix, baselines from before
it** - because `SHOT` is `maxDiffPixelRatio: 0.02` against Playwright's default `threshold:
0.2`, and a mean channel delta of 40 across saturated gradients stays inside both. The
staleness manifest could not catch it either: it hashes `hook + act`, and neither changed.
**So: after `npm run og`, regenerate `tests/visual/blog.spec.ts-snapshots` and diff them.**
`scripts/diff-baselines.mjs` is what makes the difference visible; the suite will not.

**Two site-wide defects were found at 8.9c and fixed under `review-gates.md` §4.** The
blooms had been drifting under reduced motion since 8.1 - `animation: none` on `.orb > i`
(0-1-1) losing to `.orb.a > i` (0-2-1), measured at 18 running animations on `/` - and
`freeze()` in the visual suite was setting `animation-delay: -4s`, which **offsets** the
timeline rather than seeking it, so every run froze on a different frame. It seeks with
`animation.currentTime` now and skips scroll-driven animations. The second half of that was
a compositing hint: `Problem.astro` and `Feed.astro` carry a permanent `will-change` on
their scrubbed copy, and Chrome does not rasterise composited text identically between
loads, so `freeze()` drops the hint at screenshot time. Together these close the "act one's
default-motion baselines are not reproducible" finding: **two runs are now pixel-identical,
0 differing pixels against 10,882.** The production `will-change` is worth revisiting on its
own merits and is the owner's call, not a test helper's. **8.5 (act three) restructured the page's back half** (owner, 2026-09-04): notifications
were promoted out of act four into their own act, and the search/follow onboarding story
and catalog-completeness claim were dropped from the page entirely. Act four (8.6) is now
auto-add + "nobody switches services".

**The last two sections run in the reverse of their spec numbers** (owner, 2026-09-04): the
page reads better closing on the notification, so `Playlist` (8.6) is third and `Notify`
(8.5) is fourth and last. The numbers in `phases.md` are work items and were left alone -
in code and in conversation, "act three" and "act four" mean the order a visitor meets them
in. Three things follow, and each is load-bearing:

- **The final CTA lives in `Notify.astro`**, not `Playlist.astro`. It belongs to whatever
  section ends the page.
- **`Notify`'s copy sits at the top of the pin with the phone below it.** The CTA occupies
  the lower half of the frame; the copy would clash with it anywhere else.
- **The page still closes on magenta.** Amber is the notification's cast light, so `Notify`'s
  atmosphere carries two `BloomField`s - an amber room and a magenta send-off - that
  cross-fade across the close. **`Playlist` also uses the magenta `act="cta"` palette** - it
  was assigned there when that act ended the page, and the owner approved it in place anyway
  at 8.6's Gate C, so the page runs magenta → magenta across its last two acts and the act
  name no longer describes where it sits. Settled, not open.

**`Notify`'s phone is a fixed object and everything else works around it** (owner, Gate C
rev 2, 2026-09-05). The device sits at `--device-top: 60svh` with ~57% of it in frame and
**never moves or changes size anywhere in the section** - the owner rejected the receding,
shrinking close outright. That is not a tuning value: a 70svh phone fixed at 60svh leaves no
room beneath it, so the final CTA cannot live at the foot of the frame. The band between the
header and `--device-top` is the only room in the pin, and the claim and the ask take turns
in it - the copy leaves on `--close-scene` over the first 55% of the close, the CTA rises on
`--close-cta` over the last 55%. Before moving anything in this section, check what it does
to that band.

- `--copy-top: 26svh` and `--cta-top: 22svh` are **derived, not chosen**: each is its block
  centred in the band above the phone, which lands on the same value at 1440 and 390. That
  is why the section has no narrow geometry override at all any more. Recompute rather than
  nudge.
- **The clearance guard reads `ctaBottom <= deviceTop`.** It used to be the other way round,
  when the phone got out of the ask's way. Sampled at four points across the close, never at
  the endpoints only - a linear version once put the CTA headline straight across a lit
  phone for the middle third of the track and an endpoint assertion passed anyway. A second
  test asserts the phone's rendered height is constant, which is the owner's instruction
  expressed as something that can fail.
- **Reduced motion has its own composition**, not a snapshot of the close: copy at 11svh,
  CTA at 31svh, phone at 60svh, 27px of clearance. Claim, ask and phone in one frame, which
  the scrubbed close cannot carry now that the words take turns.

**`Playlist`'s atmosphere is masked to the upper ~70svh and the field is lifted to match**
(owner, same gate: "so the circles don't touch the bottom"). Masking alone deleted the third
orb instead of moving it, hence the `.bloom-crop` lift; at ≤767px the field is also scaled
1.3x, because the orbs are sized off the field's _width_ and a narrow viewport otherwise
gets two small discrete discs instead of weather. **`BloomField` itself is untouched and
must stay that way here** - the hero, act one and act two share it and their appearance is
frozen behind their own Gate C, so the same treatment there is its own gate.

**The arriving row carries a plum wash, and it rides `--playlist-row`.** Chosen over an
"Added" chip: a chip is a string to translate at 8.11 and product chrome in a list whose
Gate A failure condition is that it carries none. It has no signal of its own so it cannot
drift from the arrival it marks, and it fades out at both ends of the row because the list
has no container and a full-width block would put a hard rectangle on it.

**Act three's one structural rule:** the wake is scrubbed, the arrival is not. The screen
coming up and the amber cast light are one continuous signal (`--notify-wake`); the
notification banner is a threshold-triggered tween that runs to completion
(`--notify-banner`), the same pattern as act two's feed advance. A scrubbed banner lets a
visitor drag the notification half-in and hold it there, which destroys the only thing the
section says. Do not unify them.

**Notifications are not paywalled** (owner, 2026-09-04) and ship in the beta. The iOS app's
paywall string still advertises them as a Pro unlock and is the thing that is wrong;
`sonaru-frontend-ios` needs its own copy change, and 8.7's Free vs Pro table must put
notifications on the free side.

- **The route is green.** `npm run verify` passes. The 15 stale specs left by the
  2026-09-03 restructure were rewritten on 2026-09-04 and the suite extended to the
  coverage `acceptance-criteria.md` §5 asks for - acts one and two had passed Gate C with
  no snapshot behind them. `phases.md` 8.4 has the full account. **The test layout is now
  one file per section**: `e2e/{hero-lights,problem,feed}.spec.ts` and
  `visual/{hero,problem,feed}.spec.ts`, sharing `tests/visual/support.ts` and
  `tests/motion-ready.ts`.
- **Never trust `networkidle` to mean the motion is running** (`tests/motion-ready.ts`).
  Every scrubbed signal is registered with `@property … initial-value: 0`, so a page whose
  JS has not run yet is indistinguishable from one scrolled to the top - `getComputedStyle`
  returns a plausible `0` either way, and the test fails describing a design bug that does
  not exist. Wait on an **inline** custom property, which only `setProperty` writes. Also
  wait for act one's `.pin-spacer` before reading any `offsetTop` below it: it is 2100px of
  document that does not exist until GSAP creates it.
- **A sticky layer with a negative _bottom_ margin outlives its own pin.** A sticky
  element's constraint rectangle is its containing block inset by the element's **own**
  margins, so the `margin-bottom: -100svh` that overlaps `.atmosphere` with `.pin` pushed
  that rectangle a full viewport below the section - and the bloom stayed screen-fixed for
  900px after the pin released and scrolled away. The owner caught it in act two at 8.5's
  Gate C. **Put the negative margin on the next sibling's `margin-top` instead**: identical
  flow position, identical overlap, both constraint rectangles equal to the section, so the
  layers release on the same pixel. Act two and act three are fixed. **The hero does it on
  purpose** (owner, 2026-09-04) - its `.blackout` and `.atmosphere` are meant to outlive
  its pin as the handover into act one, so do not "fix" them there. The hero/act-one seam
  mismatch deferred since 2026-09-02 is still open and still unexplained. This is also a
  confirmed mechanism for the hard-edged-rectangle artifact: what stands still is the
  bloom's own mask edge.
- **A green visual suite does not mean a small element is unchanged.** `SHOT`'s
  `maxDiffPixelRatio: 0.02` is ~26,000 pixels of tolerance on a 1440x900 frame. The
  notification's 625px app icon was replaced outright and every snapshot still passed;
  the baselines needed `--update-snapshots=all`, not the default `changed`.
- **The fixed header is a no-go band at the top of every pinned section.** `Header.astro`
  is ~92px tall at 1440 and ~76px at 390, and it is above everything. `Playlist.astro`'s
  stage started at `top: 9svh` with a `-5svh` close lift (a close it no longer has, since
  the CTA moved to `Notify.astro`), which put its headline at ~36px -
  behind the wordmark at 390. Any pinned layer that also moves upward has to keep
  `top − lift` clear of that band, not just `top`. Caught by reading the generated
  baselines; no test asserts it.
- **Two dev servers on port 4321 is what "stale scoped styles" actually means.** A style
  change that is in the source, in the SSR'd HTML and in the production CSS but computes to
  nothing in the browser is almost always an old `astro dev` daemon still answering on the
  port. `pkill -f "astro dev"` does **not** match it - use
  `lsof -ti:4321 | xargs kill -9`. This cost two rounds of measurements on 2026-09-03 and
  most of a debugging round in 8.5 before the cause was found. Reach for it first. **It
  recurred in 8.7 with a worse consequence: `--update-snapshots` had already been run
  against the stale server**, so a full set of visual baselines was written from a render
  where the section's scoped styles computed to nothing - and every visual test then passed
  against them. Killing the daemon does not undo that. Regenerate the baselines afterwards
  and look at them. **`lsof -ti:4321 | xargs kill -9` is no longer sufficient on its own**:
  `astro dev` runs as a _daemon_ here (it prints `Stop: astro dev stop` when it starts), and
  killing whatever holds the port leaves it able to come back serving stale modules. In 8.8
  that state failed 66 tests across suites nothing in the change had touched - the hero, act
  one, act two - and read exactly like a broad regression. **Use `npx astro dev stop` first**,
  then the `lsof` kill as the follow-up for anything still holding the port. If a change to
  a handful of files appears to have broken sections it never touched, restart properly
  before believing it.
- **~~The artwork-driven tint is still paused~~ - live since 2026-09-11** (`phases.md` 8.6b).
  The owner supplied twelve artist photographs and six album covers, which is the condition
  the deferral named, and `placeholder-cover.jpg` is gone. **The two-layer crossfade that was
  preserved through 8.2, 8.4 and 8.5 for this was the wrong mechanism** and was replaced
  rather than switched on: it left an untinted plum base underneath and the colour never read.
  What ships is one radial from the release colour to black covering the screen, mirroring the
  app's `ReleaseBackground.swift`. See `src/content/showcase/README.md`.

Six things from 8.2 that bind later work:

- **`docs/adr-0003-hero-lcp.md` - the hero's headline does not animate.** The owner removed
  the kinetic-type brief at Gate A because a masked reveal _defines_ the largest paint,
  which `acceptance-criteria.md` §3 forbids. Entrances on anything large enough to be a
  paint candidate are **transform-only, never opacity**, and
  `tests/e2e/hero-lcp.spec.ts` enforces it - including with JavaScript disabled.
- **ScrollTrigger is not used, and that was measured.** 17,982 B gzipped against a ~31,000 B
  route. The hero pins with `position: sticky` and scrubs with `src/motion/scroll-progress.ts`
  (~0.5 KB). `initScrollMotion()` still exists for 8.3's genuinely-pinned act, which is
  where the library earns its weight - but that is a Gate B decision to make there, not an
  assumption to inherit.
- **The phone is dragged; the feed is paged.** The device growth is a pure function of
  scroll offset with _no smoothing_ - a lerp desynchronises it from the natively-scrolling
  copy beside it, and the owner rejected that. The feed is the opposite: threshold-triggered
  tweens that run to completion and queue, because a wheel delivers offset in lumps far
  larger than the gesture it represents, and scrubbing it directly skipped whole releases.
  `tests/e2e/feed.spec.ts` guards both properties. Do not unify them.
- **Never use `overflow: hidden` to contain anything in a pinned section.** It establishes
  a scroll container, and a sticky element positions against its nearest scrollport - so it
  fixes the overflow and silently breaks the pin. `overflow-x: clip` does not.
- **Scroll offsets in a pinned section are measured from the top of the stage, not from the
  end of the fold**, because the pin is stuck from the very first pixel. The travel spacers
  sit after the fold in the document, so linking to one scrolls a whole viewport too far.
  _Superseded in the specific: the hero's `#how` marker is gone with the device. Act one's
  CTA resolves at `#feed`, act two's section id, which needs no marker at all because act
  two's growth runs on the section's **approach** and is complete the instant its top
  reaches the viewport's - so the plain anchor lands on a composed frame._
- **The app's feed is a scrolling feed** - the owner corrected the 8.0 study at Gate A, and
  `reference-study.md` CORRECTION 4 records it against `FeedView.swift`. Full-screen
  releases, snapped one per swipe, transport controls acting only within a multi-track
  release. `src/components/device/` mirrors that structure and naming.

**The showcase artwork is a placeholder, and two consequences are load-bearing.** Every
release points at one cover supplied by the owner, with deliberately fictional artist and
release names. So: the feed is **capped at three releases** (`src/components/device/showcase.ts`
owns the cap and act two's scroll budget is derived from it - they must not become two
facts), and **the artwork-driven tint is paused**: the phone's ground is brand plum as a
radial behind the artwork, while the per-release colour stays in the manifest and the
crossfade layers stay intact. It was deferred from 8.2 to 8.4 and **has now passed 8.4 too**

- blocked on artwork rather than on code, since all eight entries share one cover and the
  identical tint, so it makes no visible difference until real covers exist. It is deferred,
  not dropped, and must land in the same change that supplies them.
  `src/content/showcase/README.md` is the procedure.

**The logo is FINAL as of 2026-09-08** (owner, asked directly). It was provisional from
8.1 until then. The owner supplied a full parameter block from `/logo/lab` and it is in
`PRESET`; the logotype was already settled (Outfit 600, −0.03em).

**The optical-correction work this file used to list is dropped, not done.** The mark is
still exact circular arcs - joins unteased, stroke unmodulated, terminals uncut - and the
wordmark is still live text rather than outlines. That was the open list while the mark was
provisional; "final" retires the list. Do not reopen it as cleanup.

**The construction changed with that decision and the module's own header was rewritten to
match.** `sonarOffset` is **0**, so the sonar is concentric with the C and, being the
larger radius, **crosses the S's stroke** - `minGap` returns **−1.75** where every earlier
preset kept it positive. That is deliberate and paired with `sonarOpacity: 0.34`: at the
old 0.85 the overlap read as a bar drawn across the mark, at 0.34 it reads as a wave
passing behind it. `/brand`'s construction chapter documents an **intersection**, not a clearance - it prints the number `minGap()` returns and says the wave crosses. `/logo/lab` stays
in the repo regardless - 8.13 must not remove it - but it is now a tool for a settled mark
rather than an unfinished one.

**8.8 shipped `/waitlist`, and the route is allowed to require JavaScript.** Its appearance
is frozen behind Gate C as of 2026-09-07. The specs asked
for both a Turnstile-protected form and one that converts with JavaScript off; Turnstile
cannot issue a token without JavaScript, so those could not both be true. The owner resolved
it toward protection at Gate B - _"use any and all required methods to catch bad entries and
bots"_ - and `tech-stack.md` §6, `acceptance-criteria.md` §9 and `phases.md` 8.8 carry the
struck-through requirement rather than a quiet edit. **It is scoped to this one route**; do
not generalise it. A `<noscript>` explains, so nobody meets a form that cannot submit.

- **`functions/api/` is three files on purpose.** `_core.ts` holds every rule behind three
  injected ports and knows nothing about HTTP or Cloudflare; `_handler.ts` is the transport
  guards; `waitlist.ts` names the bindings. **`astro dev` does not run Pages Functions**, so
  `scripts/dev-waitlist-endpoint.mjs` mounts the same `_handler` under the dev server with
  in-memory ports - which is the only reason Gate C is still "start the dev server and look
  at it" for this section. What no local run can exercise is `waitlist.ts` itself; it is
  deliberately the smallest file of the three.
- **The island was `client:only`, and that broke Turnstile in a way that only failed
  sometimes.** Turnstile's implicit mode scans for `.cf-turnstile` when its script runs; on
  a warm load the cached script runs before the island hydrates, finds nothing, and no
  challenge is ever rendered - so the form waits for a token that cannot arrive. The widget
  is therefore rendered **explicitly** by the island once it is mounted. **It is
  `client:load` since 8.14** (owner: the form appeared a second after the page and shoved
  the layout). `client:only` had been chosen because a server-rendered form is a dead form
  for the visitors the `<noscript>` was written for; that is now handled by
  `@media (scripting: none)` hiding the island, and `method="dialog"` makes a submit before
  hydration a no-op. The Turnstile box sits **below** the button with its 65px reserved, so
  its late arrival moves nothing.
- **`?state=` is read inside the island, not in the page's frontmatter.** The route is
  prerendered and Astro strips search params from `Astro.url` on a prerendered route, so the
  frontmatter version silently returned `idle` for every state. Nothing failed - the visual
  baselines just quietly showed the idle form five times, and only looking at them caught it.
- **Focus on success is a Svelte action, not `bind:this` plus an effect.** A component-level
  effect can run before a child's binding is assigned, and the first version focused nothing.
- **Turnstile's token arrives a second or two after the widget**, so a fast typist submits
  with an empty one. The form waits for it (up to 10s) rather than refusing - an error
  message for something about to fix itself is not an error.
- The route costs **~18 KB gzipped** (Svelte runtime 14.8, the island 2.7, the renderer 0.5)
  and imports **no GSAP, ScrollTrigger or Lenis** - 8.12's finding about `/pricing` applied
  while writing rather than after. A test asserts the motion stack is absent.
- **The IP is never stored.** `_core` only ever sees a salted SHA-256 of it, computed in the
  adapter. That is what lets the site rate-limit without holding an identifier, and it is
  checkable by reading one file.

**The header and the footer both exist now.** `design-system.md` §9 listed a nav all along
and `phases.md` scheduled neither - the gap was caught by the owner at 8.2's Gate C.
`src/components/Header.astro` is fixed, corner-anchored, and still has **no navigation** -
8.7 built a `Pricing` link into it and the owner removed it, confirming the removal was
deliberate: _"pricing link should not be there up until we decide that we want to add
it."_ The file is back to its pre-8.7 state and the home page's tab order is back to four
stops. **The header still has no nav, and that is permanent** - do not add one back. The
route's other door did open: `/pricing` was linked from nowhere until 2026-09-15, and the
owner then restored the **footer's** Product entry as "Pro" and linked it from the home
page's About section (SEO audit H2). **And the header drops "Join the
waitlist" on `/waitlist` itself** (owner, 8.8's Gate C): a corner link to the page you are
already on is a second control competing with the form for the same click. It is derived
from `Astro.url.pathname` inside the component rather than passed as a prop, because every
route renders the header through `Base.astro` and a prop is a thing the next route forgets.
`tests/e2e/waitlist.spec.ts` asserts it in both directions.

**The footer shipped in 8.9a and is frozen behind its Gate C (2026-09-07, approved at rev
1 - the only section so far to pass without a change round).** `Base.astro` renders it on
every route, `/waitlist` included, where it is now the only way out. It is **not a
surface**: no border-top, no card, no bloom, the ground simply continues. That is the take
from superlist.com, measured at 8.9a's Gate A and recorded in `reference-study.md` §3 -
along with what was refused, which is most of it.

- **`src/data/nav.ts` is the inventory, and six of its eight destinations do not exist
  yet.** A pending entry renders as **inert text, not a link** (owner, Gate B), so the
  footer's shape is complete and nothing 404s. **The `live` flag is asserted in both
  directions**: a live entry with no route fails, and - the one that matters - a pending
  entry whose route now _exists_ fails too. **So 8.9b, 8.9c, 8.9e and 8.10 each flip their
  own entries as part of their own work.** That is not cleanup; it is how the route becomes
  reachable at all, and forgetting it is a red build rather than a link nobody notices.
- **Pending text is deliberately not dimmed.** `--mute-400` at reduced opacity composites
  to roughly 2:1 against `--plum-900` - below AA for text a visitor reads. It sits at the
  validated colour and separates from a link by _behaviour_: no underline draw, no lift, no
  pointer. Do not "improve" it back to an opacity.
- **`Link` has a `muted` variant**; the footer does not author its own anchor style, per
  `design-system.md` §9. Nothing in the footer animates - the underline draw is `Link`'s,
  and its reduced-motion variant is inherited rather than written again.
- **Group labels are not headings.** Three `<h2>`s per page purely for footer grouping
  would land in every document's outline, so the grouping is announced through
  `aria-labelledby`. A test pins it, along with there being exactly one `contentinfo`
  landmark - `ReleaseCard.astro` also uses `<footer>`, but inside `<article>` and inside an
  `aria-hidden` subtree, so it is scoped rather than a landmark.
- **The bottom bar carries the album-artwork attribution and the takedown contact**
  (`design-system.md` §7.4). That is 8.9a's argued divergence: no reference has anything
  like it, and the bar on every page is where a rights holder looks before they find
  `/support`.

**The hard horizontal edge the footer revealed is CLOSED as of 2026-09-08, and the lesson
is worth more than the fix.** It was never a `BloomField` defect: `Hero`, `Feed`, `Notify`
and `Playlist` have always masked their own `.atmosphere` with a radial gradient that takes
the light to zero _inside_ the frame, so it dissolves rather than being cut by the layer's
edge. Three routes had never adopted it - `Document.astro` took it up in 8.9b, and
`PricingHero.astro` and `waitlist.astro` followed on the owner's instruction. `BloomField`
was never touched, so nothing needed re-gating. **The claim that the seam was on `/` was
wrong** - the home route's every section masks - and 8.9a's gate row said so for a day.
**When the site looks broken in a way a shared component would explain, check whether the
sections that look right are doing something the broken one isn't.**

**`fullPage` baselines grow when something is appended to every page.** 8.9a's footer
failed 19 `pricing` and `waitlist` snapshots for exactly that reason. The discipline that
made regenerating them safe was checking _first_: a pixel diff showed **zero changed pixels
above the appended region** in all 19, each page taller by precisely the footer's height.
Do that before `--update-snapshots`, never after - CLAUDE.md's own warning about baselines
written from a stale server is the same failure from the other direction.

**`overflow-x: auto` gives you a vertical scrollbar you did not ask for, and on macOS you
cannot measure it by width.** Setting either overflow axis to anything but `visible`
promotes the _other_ axis from `visible` to `auto`. The pricing page's comparison table
scrolls horizontally at narrow widths, and its entrance leaves the last row 16px low until
it lands - so the box overflowed vertically by exactly that, and Chrome drew a scrollbar
beside a section with nothing to scroll to, for 42 frames out of 60. The owner caught it at
8.7's Gate C. Pin the other axis explicitly (`overflow-y: hidden`) and give the entrance's
rise its room back as padding. **The second half is the part that bites twice**: the first
regression test asserted `clientWidth < offsetWidth`, since a scrollbar narrows the content
box - and it passed against the live bug, because macOS draws _overlay_ scrollbars that
take no layout space. Assert `scrollHeight > clientHeight`, the scrollable overflow that
causes the scrollbar, and verify any such guard by reverting the fix and watching it fail.

**The pricing page opens on a claim, not on display type, and `reference-study.md`'s
"display type as the decorative element" is not used there.** The take is real but it does
not survive our layout: superlist can spend a screen on a giant label because their pricing
is three short cards, and ours is two tall cards and a toggle, so the same move put every
price below the fold. The band is now an eyebrow (`PRICING`), an `h1` carrying the claim at
`--text-2xl` - the act-headline step the home page's four acts use, and a scale already
proven from 390 to 1440 - and a lede. `tests/e2e/pricing.spec.ts` asserts a price is inside
the first viewport at 390x844 and 1440x900, so the band cannot grow back into a screen
without failing. **The heading structure is the one thing that survived both rewrites**:
superlist's `h1` is a 10px eyebrow with the giant word unheaded, which the study marked
"Don't take", and ours has always been the inverse.

**The pricing route costs ~70 KB of gzipped JavaScript, and it shipped that way.** Measured
from the build: GSAP core 34.2 KB pulled eagerly through the `src/motion` barrel,
ScrollTrigger 17.4 KB and Lenis 5.4 KB from `initScrollMotion`, and the Svelte runtime plus
the toggle island 14.9 KB - to run three fade-ins and flip one attribute. Gate B estimated
the island at 3–6 KB and did not account for the motion stack on this route at all. The
precedent above is exact: ScrollTrigger was measured and rejected for the hero at 18 KB.
Raised at all three Gate C revisions and passed over each time; the route was approved with
it in place, and it is now tracked in `phases.md` 8.12 alongside the comparison table's
sideways scroll at ≤640px. **Do not refactor it away unilaterally** - the Svelte island is
what `phases.md` 8.7 asks for and what Gate B approved, so replacing it is a gate, not a
cleanup. One smaller note in the same area: the barrel means every route imports every
timeline. (The Svelte linters were wired on 2026-09-08 - `PlanToggle.svelte` and
`WaitlistForm.svelte` are both linted and formatted now, verified by injecting an `any` and
watching the build go red rather than by trusting a clean run.)

**`--blackout` (0–1) is a page-level signal, not a hero detail.** The hero drives it across
its own travel; each layer decides for itself how far it goes. It is registered with
`@property` and defaults to 0, so any component can answer it and `/kit` keeps its shadow
without knowing the hero exists. _Act two no longer drives it at all - its cover layer was
removed on 2026-09-03, so the device there simply reads the inherited 0 and keeps its
shadow._

### Design tool routes

| Route       | Purpose                                                            | Fate                                                                |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `/logo/lab` | Every mark parameter as a slider; accepts a pasted parameter block | **Permanent** until the logo is finished. Do **not** remove in 8.13 |
| `/kit`      | Every primitive and the bloom field                                | Removed in 8.13                                                     |
| `/specimen` | The approved type system; hosts the zero-CLS fallback test         | Removed in 8.13                                                     |

`src/components/brand/mark-geometry.ts` is the single source of the mark's geometry. The
rendered mark, the lab and `npm run brand` all call it, so refining the mark regenerates
the favicon, app icons and OG card. Never inline path data for the mark anywhere else.

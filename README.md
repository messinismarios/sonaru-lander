# sonaru.app

The marketing site for [Sonaru](https://sonaru.app) - an iOS app that tells you when the
artists you follow release something, in order, without an algorithm deciding what you see.

**Astro 7 · TypeScript 6 · Tailwind 4 · GSAP · Svelte islands · Cloudflare Pages**

A seventeen-route content site with four scroll-driven acts, a blog and changelog engine, a
brand document that prints itself to PDF, two locales' worth of routing machinery, and 672
tests. Fourteen of the seventeen routes ship **zero JavaScript**.

## Running it

```bash
npm install
npm run dev            # http://localhost:4321
npm run dev:host       # LAN URL, for checking on a real phone
```

```bash
npm run verify         # typecheck, lint, format, contrast, build, and the full suite
```

`astro dev` runs as a daemon here. `npm run stop` ends it, and starting a second one on a
busy port is the cause of most "impossible" local failures - see `CLAUDE.md`.

## How it is put together

```
src/
  pages/[...locale]/   Every shipping route, emitted once per published locale
  components/
    sections/          One file per act of the home page
    device/            The phone: real DOM, not video
    primitives/        Button, Link, Badge, PriceCard, SectionHeader
  motion/              The whole animation layer (see below)
  content/             Blog, changelog, legal, and the showcase artwork manifest
  styles/tokens.css    Every colour on the site, and the only place one may be defined
copy/                  One directory per language, one file per surface
scripts/               Build hooks and the asset pipelines
tests/                 unit · e2e · visual (the suite that freezes approved designs)
```

### The motion layer

`src/motion/` is a small closed system, and the constraint is the interesting part:
**a section never imports `gsap`, never calls `registerPlugin`, and never authors a tween
inline.** It asks a factory in `motion/timelines/` for a named, composed timeline.

- `tokens.ts` - durations, easings, stagger and scrub values as named constants. The same
  numbers `/brand`'s motion chapter prints.
- `registry.ts` - the one place plugins are registered and Lenis is wired to GSAP's ticker,
  so ScrollTrigger and Lenis share a single rAF loop. Two loops is the classic source of
  scroll jitter, and it looks exactly like a performance problem while being a
  synchronisation problem.
- `reduced-motion.ts` - `defineTimeline()` takes a full timeline and its reduced variant
  together, so a section cannot ship one without the other.

ScrollTrigger and Lenis arrive through a dynamic `import()`, so the thirteen routes with no
scrubbed motion download neither.

### Reduced motion is a designed state, not a fallback

Scrubbed timelines are replaced by their final state, entrances become fades or nothing,
bloom drift stops and the blooms stay, and Lenis is not initialised at all. Every visual
baseline exists in both modes, and the accessibility suite's **blocking** matrix runs under
`prefers-reduced-motion` because it is the only state on the site that is deterministic.

Two real defects have hidden in that branch and both were found late, which is the argument
for treating it as a first-class mode.

### Performance

- **Zero JavaScript on fourteen of seventeen routes.** Interactivity is a decision, not a
  default: `/pricing` and `/waitlist` are the only pages in the build with an inline script.
- **The LCP element does not animate and does not wait on a font.** The hero's headline is
  static by design - see [`docs/adr-0003-hero-lcp.md`](docs/adr-0003-hero-lcp.md) - and a
  metrics-matched fallback paints it immediately with zero layout shift.
- **Fonts are subset and self-hosted**, 27.2 KB for the whole Latin-1 range, which is why
  Spanish needed no second font request.
- **Animation targets composited properties only.** No animating `width`, `top`, `filter` or
  `box-shadow` in a scrubbed timeline.
- **The blooms are drifting CSS gradients**, not an image, a canvas or an SVG filter - see
  [`docs/adr-0007-bloom-architecture.md`](docs/adr-0007-bloom-architecture.md).

### Accessibility

Zero WCAG 2.2 A/AA violations on every route, at three widths, in both motion modes, checked
on every build. [`docs/accessibility-pass.md`](docs/accessibility-pass.md) records the manual
pass - keyboard traversal, focus order, focus visibility - and is explicit about the part that
is still owed to a person with a screen reader.

### Tests

`npm run verify` runs 672 of them. The three kinds do different jobs:

- **unit** - inventories and guards. The interesting ones assert things a compiler cannot see:
  that every copy key exists in every locale, that no withheld locale reaches the build, that
  the CSP still describes the bytes being shipped, that no dev-only route is published.
- **e2e** - behaviour, including the scrubbed acts. "A release holds still, then the next one
  arrives and lands squarely." That is testable only because the device is real DOM.
- **visual** - 172 baselines at 390/768/1440 in both motion modes. This is the mechanism that
  freezes an approved design: a section cannot be quietly "improved" after it has been
  approved.

## The asset pipelines

Nothing in `public/` that could be generated is drawn by hand.

| Command            | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| `npm run showcase` | Derives each album cover's tint and writes it back to the manifest         |
| `npm run og`       | Photographs `PostCover.astro` for every post's social card                 |
| `npm run press`    | Builds the press kit: logo files, screenshots, the zip                     |
| `npm run brand`    | The brand mark's SVG files, drawn from `mark-geometry.ts`                  |
| `npm run pdf`      | Prints `/brand` to a 24-page PDF through the same Chrome Playwright drives |
| `npm run contrast` | Scores all 26 declared colour pairings and fails the build                 |
| `npm run fonts`    | Subsets the two typefaces                                                  |

Each one guards its own inputs with a hash, so a stale artefact is a red build rather than a
file nobody notices is out of date.

## Decisions

Architecture decisions are in [`docs/`](docs/), written when the decision was taken:

|                                                   |                                                         |
| ------------------------------------------------- | ------------------------------------------------------- |
| [0001](docs/adr-0001-typescript-6.md)             | TypeScript 6, not 7, and what 7 silently stops checking |
| [0002](docs/adr-0002-no-ch-for-measure.md)        | Why `ch` is the wrong unit for a reading measure        |
| [0003](docs/adr-0003-hero-lcp.md)                 | The hero's headline does not animate                    |
| [0004](docs/adr-0004-astro-over-next.md)          | Astro over Next, and Astro 7 over Astro 5               |
| [0005](docs/adr-0005-real-dom-mockups.md)         | The app is shown as real DOM, not as video              |
| [0006](docs/adr-0006-derived-plum-ramp.md)        | The derived plum ramp, and one place for colour         |
| [0007](docs/adr-0007-bloom-architecture.md)       | The blooms are drifting CSS gradients                   |
| [0008](docs/adr-0008-lenis-and-reduced-motion.md) | Lenis on GSAP's ticker, absent under reduced motion     |
| [0009](docs/adr-0009-artwork-risk.md)             | Real artwork, the accepted risk, and its mitigations    |

## How it was built

Every design decision on this site passed a three-gate review - concept, plan, then the owner
running it and looking at it - and every gate is recorded in the spec set with what was
approved, what was rejected, and why. A section that passes its visual gate is frozen, and the
visual suite is what enforces that mechanically.

## Licences

Typeface licences are in [`public/fonts/LICENSES.md`](public/fonts/LICENSES.md). Album artwork
and artist photography are the property of their rights holders; the takedown contact and the
one-file removal procedure are described in
[`src/content/showcase/README.md`](src/content/showcase/README.md) and in ADR 0009.

# ADR 0006 - The plum ramp is derived, and no colour is defined outside `tokens.css`

**Status:** accepted · **Date:** 2026-08-31 · **Decided by:** the owner, at 8.1's Gate C

## Context

The brand colour comes from the iOS app: `Theme.swift`'s gradient, black through `#14000D`.
A marketing site needs far more than a background - text on five different grounds, an
interactive accent, a rim on a button, a divider, a wave inside the logo - and the usual way
that goes is that someone eyedroppers a shade, likes it, and pastes it into a component.

The site's own contrast requirement makes that a real problem rather than an untidy one:
**26 declared pairings, each scored against WCAG 2.2**, and a colour defined inside a
component is a colour the validator never sees.

## Decision

Two rules, and the second is what makes the first hold.

1. **One ramp, derived.** The plum scale is generated at constant hue and stepped lightness
   rather than picked shade by shade, and it was desaturated at 8.1 so the accent reads as
   wine rather than as hot pink - the owner's words at that gate.
2. **No colour is defined outside `src/styles/tokens.css`.** `npm run contrast` parses that
   file, scores all 26 pairings, and fails the build. A hex anywhere else is a colour nothing
   checks.

## The exceptions, and why they are exceptions

- **`tint` in `src/content/showcase/releases.json`.** Derived from each cover by
  `npm run showcase` and written back into the manifest. It is not a design decision at all:
  in the app the same value arrives from the API as `releaseColor`, data attached to a release.
  It never sits behind text, and nothing checks it because nothing needs to.
- **Shiki's syntax-highlighting palette.** The blog's code blocks are on `github-dark` and sit
  on **its** ground rather than ours, so `npm run contrast` cannot see a single pairing inside
  one. 8.12a fixed the one scope that failed AA by measurement; making the code block our own
  ink is recorded as outstanding design work in `specs/lander/phases.md` 8.12.

## Consequences

- **The palette can be printed, because it is data.** `/brand`'s colour chapter reads
  `tokens.css` and calls the same scoring function the build gate calls, so the ratios on that
  page cannot disagree with the ratios in CI. Nothing on it is a number typed by hand.
- **A pairing has a _level_, not just a ratio**, and that turned out to matter. Of the 26, 21
  are `AA`, one is `AA-large`, three are `non-text` and one is `tracked` - the divider, at about
  1.3:1, recorded precisely so that nobody sets text in it. In 8.12a the specimen chips were
  found to be setting text in exactly that colour while the paragraph underneath warned against
  it; they now render by level.
- **The rule has already caught a real defect.** `/press` needed to print the palette and its
  first attempt read `tokens.css` through `import.meta.url`, which works under `astro dev` and
  is `ENOENT` in a build - so only `npm run build` would ever have caught it.

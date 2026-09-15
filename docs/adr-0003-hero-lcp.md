# ADR 0003 - The hero's headline does not animate

**Status:** accepted · **Date:** 2026-09-01 · **Decided by:** the owner, at 8.2's Gate A

## Context

Phase 8.2's brief, as written in `phases.md`, asked for two things that turn out to be in
direct conflict:

> - Headline animated with **GSAP SplitText** - per-character masked reveal with a tight
>   stagger […]
> - **LCP element identified and optimised.** The hero's largest paint must not be
>   animation-dependent and must not wait on the font.

And `acceptance-criteria.md` §3 states it as a launch condition:

> The LCP element is not animation-dependent and does not wait on a font or on JS.

A per-character masked reveal begins with the characters clipped or transparent. Browsers
do not treat an element as painted until it is actually visible, so an animated headline
is not merely _at risk_ of moving the Largest Contentful Paint - it **defines** LCP as the
moment the animation reveals enough of it. Add the script that must parse and run before
the reveal can start, and the largest paint on the site's most-judged route is waiting on
all three things the criterion forbids.

The font half of the problem was already solved in 8.1: the metrics-matched fallback
(`docs/adr-0002-no-ch-for-measure.md`, `scripts/build-fonts.mjs`) paints the headline
immediately in Arial at Satoshi's metrics and swaps with zero shift. The animation half is
a design decision, not an engineering one, so it went to the owner.

## Options considered

**A - The headline is static; the device carries the motion.** Clears the criterion
outright, with nothing to measure or defend. Costs the kinetic type the brief asked for.

**B - Build the brief as written, and move LCP to the artwork.** Enlarge the device until
the cover is reliably the largest paint, so the animated headline never holds the
measurement. Viable, but it makes a hard performance guarantee depend on an art-direction
accident that has to hold at every viewport, and it inverts the composition: the type
stops being the biggest thing on a page whose job is to make one sentence land.

**C - Split the headline.** The first line paints instantly and is the largest text; the
second, carrying the accent, does the per-character reveal a beat later. Keeps visible
kinetic type. Relies on the browser's text-candidate grouping behaving the way we expect,
which is subtle and not something to build a launch condition on.

## Decision

**Option A.** The owner chose it at Gate A with the words "no text animation above the
fold, let's keep it simple."

The hero's headline is plain, static, server-rendered text. Everything that moves in the
hero belongs to the device: it rises into place on a transform, and its feed advances
through the showcase releases with the screen's tint travelling to each cover's colour.

## Consequences

- **SplitText is not used in the hero, and is not loaded.** If no later act uses it, the
  `acceptance-criteria.md` §4 line about SplitText exposing the intact original string to
  screen readers becomes not-applicable, and must be marked so at 8.12 rather than
  quietly passing. The reference citation in `phases.md` 8.2 was withdrawn with it.

- **The hero needs no scroll machinery at all.** With nothing scrubbed and nothing pinned,
  its timeline is time-based. `initScrollMotion()` in `src/motion/registry.ts` now loads
  ScrollTrigger and Lenis through a dynamic `import()`, so the home route ships GSAP core
  and nothing else - roughly 20 KB gzipped and a permanent rAF loop that the most-judged
  page on the site simply does not pay for. The first act that genuinely scrubs (8.3)
  brings them in.

- **Entrances are transform-only, never opacity.** A translated element is still painted
  and stays LCP-eligible; a transparent one does not. This is now the rule for any
  element large enough to be a paint candidate, and it is why the device enters on
  `--device-enter-y` rather than fading in.

- **The guarantee is tested, not asserted.** `tests/e2e/hero-lcp.spec.ts` checks it two
  ways: that the winning LCP element is one of the two server-rendered candidates at both
  390 and 1440, and that with **JavaScript disabled entirely** both are fully opaque and
  painted. The second check is the one that matters - an opacity-0 entrance would pass the
  first and fail the second.

## What would reopen this

A later act wanting kinetic type is not blocked by this decision: below the fold, nothing
is an LCP candidate, and the technique is free to be used there. This ADR is about the
first viewport only.

If the hero's composition ever changes so that an image is unambiguously the largest paint
at every breakpoint, option B becomes available again - but it would need a new Gate A,
because it changes what the owner approved.

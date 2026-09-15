# ADR 0004 - Astro over Next, and Astro 7 over Astro 5

**Status:** accepted · **Date:** 2026-08-31 · **Decided by:** the owner, during scoping

## Context

The brief named "astro + typescript", so the framework was not an open question. It is
recorded anyway, because the reasoning is what makes the rest of this repository legible and
because the obvious alternative - Next, which is what a marketing site is usually built in -
would have produced a different site rather than the same site built differently.

The site is seventeen routes of content with four genuinely interactive elements: a pricing
toggle, a waitlist form, a language switcher and a set of copy buttons on `/press`. Everything
else is text, images and scroll-driven motion. The launch bar is Lighthouse 100 on mobile
throttling with LCP under 1.5s.

## Decision

**Astro 7.2.9, with Svelte islands for the four interactive parts.**

## Why not Next

Next renders React, and React is the thing that would have to be justified. On this site it
would ship a runtime to every route so that four of them could be interactive, and the
hydration it performs is work that fourteen of our seventeen routes do not need at all. The
App Router's server components narrow that but do not remove it; the floor is still a
framework runtime on a page whose job is to paint a headline quickly.

Astro's default is the opposite: **zero JavaScript unless a component asks for it.** Fourteen
routes ship none. `/pricing` and `/waitlist` ship a Svelte island each, and those two are the
only pages in the build with an inline script - which is how `adr-0004`'s sibling decisions and the Content Security Policy
came to need script hashes at all, and is a good measure of how little client code exists.

Two secondary reasons, both of which turned out to matter more than expected:

- **Content collections.** The blog, the changelog, the legal documents and the showcase
  artwork manifest are all Zod-typed collections. A mistyped frontmatter key is a build error.
- **File-based i18n routing.** Every page lives under `src/pages/[...locale]/` and is emitted
  once per locale from one file. Adding a language is a directory of copy and one entry in a
  list; no route is duplicated. See `copy/README.md`.

## Why Astro 7 and not Astro 5

The brief's expectation formed when 5 was current. Shipping a two-major-old framework on a site
whose stated requirement is "the latest technology" would have been a quiet contradiction, so
the change was made and recorded rather than assumed either way.

The same reasoning does **not** extend to TypeScript: 6.0.3 is deliberate and 7 is refused, for
reasons that are specific and measured. See `adr-0001-typescript-6.md`.

## Consequences

- **Interactivity is a decision, not a default.** Adding a stateful component means adding an
  island and paying for it visibly. `tests/e2e/pricing.spec.ts` asserts a JavaScript budget per
  route for exactly this reason.
- **The motion layer is hand-written**, because there is no component framework to hang it on.
  `src/motion/` is the whole of it: one barrel, one registry, one timeline factory per section.
  That is more code than a React animation library would have been, and it is the reason the
  site can run GSAP on four scrubbed acts while thirteen other routes download none of it.
- **A known cost, recorded rather than hidden:** the motion barrel means every route that
  imports any timeline imports all of them. `/pricing` spends ~70 KB gzipped on three fade-ins
  and one attribute flip. It is written up in `specs/lander/phases.md` 8.12 and deferred past
  launch by the owner.

# ADR 0005 - The app is shown as real DOM, not as video

**Status:** accepted · **Date:** 2026-09-01 · **Decided by:** the owner, at 8.2's Gate A

## Context

Four of the home page's five acts are about the app: a feed that pages one release per scroll,
a lock screen receiving a notification, a playlist gaining a row. The obvious way to show an
app doing something is to record it doing it, and it is what most of the reference set does -
`reference-study.md` §6 records superlist's hero as a **500x272 GIF painted at 1440x900**,
upscaled about 2.9x, and it is licensed pop-culture footage.

## Decision

**Every device on this site is real DOM: HTML, CSS custom properties and GSAP.** There is no
video, no GIF, no image of a screen. `src/components/device/` builds the phone, and each act's
timeline drives it.

## Why

- **It scrubs.** A video can be seeked, but it cannot be _driven_ - the feed advancing exactly
  one release per unit of scroll, reversing cleanly when you scroll back up, and holding its
  last frame through a trailing rest. Act two's whole argument is that the order is
  chronological and nothing is hidden; a visitor who scrolls back and watches it un-advance is
  being shown that, not told it.
- **It weighs almost nothing.** The device is a few KB of markup and CSS. The 2.9x-upscaled
  GIF the reference ships would have been the largest asset on the page and the LCP candidate
  on the one route where `adr-0003-hero-lcp.md` forbids exactly that.
- **It is legible to assistive technology by being illegible to it.** Every device is inside an
  `aria-hidden` subtree with nothing focusable in it, and the claim it illustrates is in real
  text beside it. A video would have needed the same treatment plus captions for a thing that
  says nothing.
- **It survives a content change.** The releases and artists come from
  `src/content/showcase/`, so swapping the entire set - including to original art if a rights
  holder objects - is a change to one manifest. See `adr-0009-artwork-risk.md`. With video it
  would be a reshoot.
- **It is the same design language as the site.** A recording of the real app would carry iOS's
  own type, spacing and colour into a page that has spent a phase establishing its own.

## Consequences

- **The mockups must be kept honest by hand.** They are a rendering of the app, not the app, so
  they can drift from it. Two places are wired deliberately: the release tint mirrors
  `ReleaseBackground.swift`'s radial, and the lock screen's banner truncates the way iOS
  truncates. Where they differ it is recorded - "Recommended for You" sits at our secondary
  grey rather than the app's `SonaruColor.checkBg`, because here it is decoration and magenta
  is this site's call-to-action colour.
- **Scrubbed motion needs a test vocabulary that does not exist for video.** `tests/e2e/`
  asserts things like "a release holds still, then the next one arrives and lands squarely" and
  "the date in the margin never disagrees with the release on screen". That is possible only
  because the state is in the DOM.
- **The visual suite photographs states, not frames**, and those photographs are what freeze an
  approved design - `review-gates.md` §3.5.

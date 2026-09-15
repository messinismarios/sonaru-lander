# ADR 0007 - The blooms are drifting CSS gradients, not a painted field

**Status:** accepted · **Date:** 2026-08-31 · **Decided by:** the owner, at 8.1's Gate A

## Context

The look the owner asked for was superlist's: large, soft, coloured light behind a near-black
page. It is the single highest-value technical question in `reference-study.md`, and the study
exists partly to answer it - _how is that actually rendered, and what does it cost on a
mid-range device?_

Three approaches were built and shown:

1. **CSS radial gradients, drifting** - a few large `radial-gradient` layers, animated slowly.
2. **A painted static field** - one authored image, sharp and exactly as designed, and dead.
3. **A turbulence-mask hybrid** - SVG filters for organic edges, which is the technically
   interesting one and which I recommended.

## Decision

**Panel 2 of the concept board: CSS radial gradients, drifting.** The owner chose it over the
hybrid I had recommended, and slowed the drift to a 24-second cycle at Gate C.

## Why it is the right answer, in hindsight as well as at the gate

- **It costs nothing to download.** No image, no SVG filter, no canvas. The field is a handful
  of gradient stops in a stylesheet.
- **SVG turbulence is a filter, and filters are the thing to avoid here.** `design-system.md`
  §6 allows animating composited properties only - `transform` and `opacity`. A `feTurbulence`
  mask animated at 60fps is per-frame rasterisation on the largest surface on the page, which
  is precisely the mid-range-device cost the study set out to measure.
- **Each act gets its own temperature for free.** The bloom colours are the only values on the
  site that are never text, never a fill and never a border, so they are unconstrained by
  contrast and can carry the emotional register of a section - cyan for the chronological feed,
  violet for the cooling light of act one.
- **It degrades correctly rather than disappearing.** Under `prefers-reduced-motion` the drift
  stops and the blooms remain. A video or a canvas would have had to be replaced by something
  else; this is the same field, still.

## Consequences

- **A bloom must be masked by whatever contains it.** The field is full-bleed, so without a
  mask its light leaks past the bottom of its section. `Hero`, `Feed`, `Notify` and `Playlist`
  each mask their own `.atmosphere` so the light dies inside the frame; three later routes had
  simply never adopted it and were fixed at 8.9. `BloomField` itself was never the defect.
- **Full-bleed layers and the viewport width do not agree.** `100vw` includes a classic
  scrollbar and the usable width does not, so every full-bleed atmosphere is about 15px too
  wide wherever scrollbars take space. `body { overflow-x: clip }` is the floor under that,
  and it is a floor rather than a licence - new work sizes from the real client width.
- **A `fullPage` screenshot does not photograph a viewport-relative layer the way a visitor
  meets it.** `Document.astro`'s atmosphere is `100svh`, and the shutter resizes the viewport
  to the document's height first - so on `/brand` it is photographed 14,196px tall instead of 900. It is mostly invisible because it is consistent, and on the two tallest pages it stops
  being reproducible. Recorded in `specs/lander/phases.md` 8.12 with two related capture
  defects.

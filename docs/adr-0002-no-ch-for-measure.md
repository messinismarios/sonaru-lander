# ADR 0002 - Text measure is set in `em`, never `ch`

**Status:** accepted · **Date:** 2026-08-31

## Context

`acceptance-criteria.md` §3 requires **zero layout shift from the font swap**, verified
against a metrics-matched fallback, inside a total CLS budget of 0.01.

The fallback (`scripts/build-fonts.mjs`) matches Arial's advance width, ascent, descent
and line gap to Satoshi's. After tuning, a sentence of body copy renders within **0.02%**
of the same width in either face, and single-line blocks have identical heights.

The document still shifted **77px**. The cause was not the font metrics. It was `ch`.

`1ch` is the advance width of the digit `0` **in the font currently in use**. Satoshi is a
geometric grotesk with wide figures; Arial's are comparatively narrow. Measured on the
running page:

| Declared       | Satoshi | Fallback | Difference |
| -------------- | ------- | -------- | ---------- |
| `68ch` at 18px | 878.8px | 678.5px  | **−22.8%** |
| `22ch` at 44px | 695.0px | 530.2px  | **−23.7%** |

So every paragraph capped at `68ch` was laid out in a container a fifth narrower while the
webfont was loading, wrapped an extra line, and moved everything below it.

No `size-adjust` value can fix this. `size-adjust` scales a face uniformly, but the defect
is a _ratio_ difference - figure-width relative to sentence-width - between two different
typefaces. Matching one necessarily unmatches the other.

## Decision

**Text measure is expressed in `em`. `ch` is not used for any width that affects layout.**

`em` keeps the thing `ch` was chosen for - a measure that scales with type size - while
depending only on the font size, which both faces share by construction.

Conversion, for this typeface: `1ch` = `0.7179em` in Satoshi. The `em` values in the
codebase are the `ch` values the design was authored at, multiplied by that.

## Consequences

- `ch` remains fine for things with no layout consequence.
- A future typeface change re-derives the constant above; the `em` values then need
  rescaling. This is one of the costs of changing the typeface, and it belongs in that
  gate's Gate B submission.
- `tests/visual/font-fallback.spec.ts` asserts the zero-shift property mechanically, so
  a regression fails CI rather than waiting to be noticed.

## Addendum - 2026-09-07 (8.9b): `ch` was never characters either

The conversion above is faithful, and that is the problem worth recording.

`1ch` is the advance of the digit `0`. In Satoshi the digit is **~63% wider than the
average letter** - 12.9px against a measured 7.9px at 18px - so a measure authored as
`68ch` was never 68 characters of prose. It is **111**.

`--measure: 48.8em` therefore caps text at 878px at `--text-body`. Nobody noticed for six
sections because everything it caps is a lede of two or three lines, where 111 characters
never occur on a line and the cap is doing nothing but stopping a paragraph from spanning
a 1200px grid. 8.9b was the first document on the site, and a document is where it stops
being invisible.

**`--measure` is unchanged** - every element it caps is frozen behind an approved Gate C,
and its behaviour there is correct. 8.9b added `--measure-prose: 30em`, which is 540px at
18px and **measured** at 68 characters of Satoshi rather than converted from a unit that
sounds like characters.

The lesson generalises past `ch`: a measure is verified by rendering the typeface and
counting, not by arithmetic on a unit whose name describes something else.

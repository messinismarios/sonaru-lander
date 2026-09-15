# Accessibility pass - 8.12a

The written record `phases.md` 8.12 asks for. It says what was checked, **by what means**,
and what is still owed to a person. Dated 2026-09-12, against the site as of `8.12a`.

## The bar

WCAG 2.2 level AA, every shipping route. English only - 8.11e keeps `/es/` out of the
published build, so there is one locale to check and it will be two the day 8.11c lands.

## What is mechanical, and therefore is not in this document

`tests/e2e/axe.spec.ts` is the guard and it runs on every build:

- **Reduced motion, every shipping route, at 1280 / 768 / 390.** Blocking.
- **Default motion, every shipping route, after the page has been scrolled** so every
  entrance has played. Blocking.
- `best-practice` rules are measured and printed, never blocking. The bar is WCAG 2.2 AA and
  that rule set moves between axe releases.

**69 checks, zero violations**, and stable across repeated runs - which took three attempts
to achieve and is written up in that file's header. The short version: a fixed pause fails on
a different route each run, an opacity-settle check alone makes the failure reproducible
while measuring a page whose JavaScript has not run, and only the two together are honest.

## What was fixed to get there

Six defects, found by measuring rather than by reading:

| Route                         | Rule                          | Was                                                                                          |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `/blog/mirroring-musicbrainz` | `color-contrast`              | Code comments at **3.04:1** - Astro's default `github-dark`, never configured                |
| `/brand`                      | `aria-hidden-focus`           | Four motion demos both `aria-hidden` and `tabindex="0"` - tab stops that announce nothing    |
| `/brand`                      | `color-contrast`              | Palette chips setting `Aa` in pairings that are not for text - **1.32:1** on the divider row |
| `/brand`, `/pricing`          | `scrollable-region-focusable` | Tables that scroll at 390 and cannot be scrolled by keyboard                                 |
| `/pricing`                    | `heading-order`               | `<h1>` straight to `<h3>`                                                                    |

## The manual pass

### Keyboard traversal - done, all 17 routes

Every route walked with `Tab` to exhaustion, recording each stop's tag, accessible name,
focus style, visibility and whether it sits inside an `aria-hidden` subtree.

**No defects.** Stop counts run from 14 (`/`, `/404`, `/privacy`) to 42 (`/press`). Nothing
is focusable while invisible, zero-sized, or inside an `aria-hidden` subtree - which is the
class of defect 8.10e found the hard way, where a closed `<details>` held a nav that was in
the DOM, in the accessibility tree, and not painted.

Two things were flagged by the first pass and **both were the probe being wrong**, recorded
here because the same mistake is easy to repeat:

- `/press`'s five screenshot links look nameless if you read `textContent`. Their accessible
  name comes from the `alt` on the image inside them, and every one is a real description.
- `/waitlist`'s email input has no inline text. It has a `<label>` reading _Email address_.

**An accessible name is computed, not read off the element**, and a probe that checks
`textContent` plus `aria-label` will report both of these as violations forever.

### Focus visibility - done, all 17 routes

Every stop was checked for an `outline` or a `box-shadow`. Every one has a focus style.

### Focus order through the pinned sections - done

The home route's four scrubbed acts hold their devices in `aria-hidden` subtrees with nothing
focusable inside them, so the tab order runs skip link → header → the page's own links and
never enters a mockup. `tests/e2e/hero-a11y.spec.ts` has asserted this for the hero since 8.2;
the traversal above confirms it for acts one through four.

### No content reachable only by animation - done

`tests/e2e/reduced-motion.spec.ts` walks every route and asserts nothing is driven by the
clock, and the axe matrix above runs the whole site **in reduced motion** as its blocking
pass - so every route is checked in the state where no entrance has run at all. A section
whose content only exists after a scroll would fail there.

## What is still owed to a person

**A screen reader has not been run against this site.** This pass is keyboard, focus,
semantics and automated rules - it is not a screen-reader pass, and nothing in it substitutes
for one. Stating it plainly because the distinction is easy to blur: axe checks that a name
_exists_, not that the name is _useful_, and no automated rule can tell you that a page reads
badly aloud.

Two sittings are owed, and neither can be done from a terminal:

- **VoiceOver on macOS**, across the four scrubbed acts and both forms. In scope at 8.12a's
  Gate A, not delivered.
- **VoiceOver on iOS.** The owner ruled on 2026-09-12 that this does not block launch. It is
  carried to 8.13 as a known gap.

`/waitlist` also embeds Cloudflare Turnstile, whose widget is third-party markup inside an
iframe. It is not covered by the guard and is not ours to fix.

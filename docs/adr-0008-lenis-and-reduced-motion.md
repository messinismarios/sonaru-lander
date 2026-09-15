# ADR 0008 - Lenis rides GSAP's ticker, and does not exist under reduced motion

**Status:** accepted · **Date:** 2026-08-31 · **Decided by:** the owner, at 8.1

## Context

Four acts of this site are scrubbed: their state is a function of scroll position. Native
scrolling on a trackpad is already smooth; on a mouse wheel it is a series of jumps, and a
timeline driven directly by it looks like a series of jumps too.

Smooth-scroll libraries have a deservedly bad reputation, and it is not mainly about taste.
They hijack an input that the browser has spent thirty years making work - find-in-page,
`Home` and `End`, anchor links, scroll restoration on back/forward, and the screen reader's own
navigation all move the scroll position, and a library that does not cooperate breaks them
silently.

## Decision

**Lenis 1.3.26, driven from GSAP's ticker**, and **not initialised at all** when
`prefers-reduced-motion: reduce` is set.

## Why the ticker matters

Lenis and ScrollTrigger each want a `requestAnimationFrame` loop. Left to themselves they run
two, and the timeline is then sampling a scroll position that is being written by a different
loop on a different frame boundary. **Two rAF loops is the classic source of scroll jitter**, and
it looks exactly like a performance problem while being a synchronisation problem.

`src/motion/registry.ts` is the one place this is wired: it registers the plugins, drives Lenis
from GSAP's ticker, and hands back a runtime. Nothing else in the codebase imports `gsap`
directly, calls `registerPlugin`, or constructs a Lenis instance.

## Why reduced motion turns it off entirely

`design-system.md` §6 makes the rule stronger than the name suggests: reduced motion is a
**designed** experience, not a kill switch. Scrubbed timelines are replaced by their final
state, so nothing is unreachable or invisible; entrances become opacity fades or nothing; bloom
drift stops and the blooms stay.

Inertial scrolling is the one piece with no reduced version worth having. Smoothing _is_ the
motion; a gentler easing is still a page that does not stop when you stop. So it is absent, and
the browser's own scrolling - which the visitor has already configured to their liking - is
what they get.

## Consequences

- **The rule is "if smooth scrolling breaks the browser, smooth scrolling loses."** It is
  written into `design-system.md` §6 as a deliverable rather than an aspiration.
- **Reduced motion is the site's only deterministic state, and that became load-bearing.**
  8.12a's accessibility guard runs its blocking matrix under `prefers-reduced-motion` for
  exactly this reason: with no entrance in flight, two runs cannot disagree. Under default
  motion there is nothing to wait on, because GSAP is bundled as a module and never reaches
  `window`.
- **Two defects have hidden in the reduced branch and both were found late**, which is the
  argument for testing it as a first-class mode rather than as a fallback: a prose underline
  that only the reduced branch pinned visible, and a 38px baseline signature that appears only
  in reduced variants.
- **Routes that do not scrub never download it.** `initScrollMotion()` reaches ScrollTrigger
  and Lenis through a dynamic import, so the thirteen content routes pay nothing. That same
  dynamic import is why the four motion dependencies have to be named in Vite's
  `optimizeDeps.include` - nothing the scanner can see imports them, so they were discovered at
  runtime and re-optimised mid-test-run, which failed 67 tests on an unmodified tree.

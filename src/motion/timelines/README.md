# `src/motion/timelines/`

One exported factory per scroll act. A factory returns a composed, named GSAP timeline;
sections call the factory and never author tweens themselves.

Empty until 8.2 - the hero is the first act with choreography, and
`phases.md` 8.1 is explicit that this layer ships with no timelines in it yet.

Every factory:

- takes its durations, easings and staggers from `../tokens`, never a literal;
- is defined through `defineTimeline` from `../reduced-motion`, so its reduced-motion
  variant is written alongside it and cannot be omitted;
- returns a teardown, and leaks nothing on navigation.

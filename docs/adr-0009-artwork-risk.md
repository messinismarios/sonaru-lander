# ADR 0009 - Real artists and real album covers, with the risk accepted and made cheap to reverse

**Status:** accepted · **Date:** 2026-08-31, extended to photography 2026-09-11 ·
**Decided by:** the owner, during scoping and again when supplying the files

## Context

The site's whole argument is a feed of releases by artists you follow. A mockup filled with
invented bands demonstrates the mechanism and proves nothing about the feeling, which is
recognition - seeing an artist you actually follow, and a cover you actually know.

The cost of that is third-party intellectual property on a commercial site. Album artwork is
the label's; an artist photograph carries **two** rights, the photographer's in the image and
the artist's in their likeness; and promotional use is not clearly covered by nominative fair
use in every jurisdiction.

## Decision

**Real artists, real covers, and - since 2026-09-11 - real artist photography.** The owner
accepted the risk explicitly, twice: at scoping for the covers, and again when supplying twelve
photographs for act one's field.

The decision is only defensible because of what comes with it. `design-system.md` §7 states six
mitigations as deliverables rather than suggestions, and the first one is the one that matters:

1. **The artwork set is data, not markup.** Every cover and photograph is named in
   `src/content/showcase/`, and nothing else in the repository mentions any of them. Swapping
   the entire set - including to original or fictional art - is a change to one file, never a
   redesign.
2. Covers are served at the smallest size the layout needs, in modern formats, never as
   standalone full-resolution downloads.
3. **No implied endorsement.** No artist is presented as a partner, user or endorser; no
   testimonial, no "trusted by", no artist or label logo. A photograph never appears beside a
   claim about that artist, and every one is `aria-hidden` decoration with empty `alt`.
4. A takedown contact is published on `/support`, with a documented one-file removal procedure
   in `src/content/showcase/README.md`.
5. Attribution - artist and release name - is visible wherever a cover appears, which is natural
   because the mockup is showing a music feed.
6. **`credit` is `null` throughout**, and the limit of that is stated rather than implied:
   naming the artist attributes the _subject_ of a photograph, not the photographer who owns
   it. Mitigation 4 is the answer to a photographer exactly as it is to a label.

## Consequences

- **Mitigation 1 is load-bearing and is enforced by the shape of the code, not by discipline.**
  `getFeedReleases`, `getShowcaseArtists` and `Problem.astro`'s chips all read the manifests;
  no component holds an artist name.
- **The mitigation list is a living document and was wrong once.** §7.3 read "no artist
  photography" until 2026-09-12 - written at 8.1, when no section used one - while the site
  shipped twelve. It was rewritten rather than left contradicting the code: a recorded
  mitigation that the code silently overrides is worse than one that was never written.
- **Two manifest rules exist because the data bit back.** Membership of act one's field is an
  explicit `field` flag rather than "the first eight with a photograph", because the implicit
  rule silently reshuffled three chips in a Gate-C-frozen composition when four artists were
  added. And `getShowcaseArtists` sorts explicitly, because `getCollection` is not stable
  between runs and two baseline regenerations produced two different arrangements.
- **Release dates are the albums' real dates and nothing reorders them.** An earlier pass staged
  them to force an order and it was reversed the same day: strict reverse-chronological order
  with nothing hidden is the claim the whole page makes, and a staged date is that claim being
  broken inside the mockup built to demonstrate it.

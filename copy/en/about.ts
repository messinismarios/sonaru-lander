/**
 * `/about` - why Sonaru exists and who makes it (SEO audit M4, Gate A 2026-09-18).
 *
 * **The owner's own reason, lightly smoothed and nothing added.** The heading states the
 * reason rather than the maker: the owner asked for neither the name nor the city in it,
 * so both live in the closing paragraph, where they are still on the page for a reader and
 * for the `Person` the route's markup names.
 *
 * **The person is here, not in `src/data/founder.ts`**, because a place name is a word a
 * translation changes - Athens is Atenas in Spanish - and the name travels with it so the
 * three stay together. The post byline and the home page's `Organization` read `founder`
 * from here too, through `founderPerson()`.
 */
export const about = {
  /** Who makes Sonaru (owner, 2026-09-18). No `sameAs` yet - no public profiles (M10). */
  founder: {
    name: 'Marios',
    locality: 'Athens',
    country: 'Greece',
  },

  eyebrow: 'About',
  title: 'Built with a purpose, with music lovers in mind.',
  lede: 'I got tired of missing songs from my favorite artists. Spotify never did a good enough job of telling me, so I built the app that does.',

  what: 'Sonaru watches every artist you follow and tells you when they release something: every album, EP and single, in one feed, newest first. It works alongside Spotify and Apple Music, so nobody has to switch.',

  /** Split around the one link, for the reason `waitlistPage.noscript` gives. */
  when: {
    before: 'Sonaru is coming soon to iPhone and Android.',
    link: 'Join the waitlist',
    after: 'to hear the day it lands.',
  },

  /** `{name}` and `{place}` are `founder` above, filled by the page. */
  madeBy: 'Sonaru is made by {name}, in {place}.',
  /** Each is followed by its address, rendered as a `mailto:` link. */
  contactAnything: 'Anything at all:',
  contactPress: 'Writing about Sonaru:',
} as const;

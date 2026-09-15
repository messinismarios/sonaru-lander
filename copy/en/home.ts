/**
 * The home page's four acts, plus the site's claim and the two screens the device draws.
 *
 * **Every act here is frozen behind its own Gate C** (8.2 through 8.6) and the copy is
 * approved wording, not draft. 8.11a moves it without changing a character; changing one
 * needs a new gate, and `tests/visual/` will say so.
 *
 * The lengths matter more here than anywhere else on the site. `Hero.astro` pins its copy
 * and measures the settle from real layout, and `Problem.astro` staggers one `<span>` per
 * word - so Spanish running 15–25% longer is act one's Gate C question at 8.11c, not a
 * detail. Nothing here may be translated by length alone.
 */
export const home = {
  /**
   * The site's claim - one sentence, in one place, on the footer, act three's CTA and the
   * social card every route unfurls with.
   *
   * **It is hashed.** `npm run og` records a hash of what the site card was generated from
   * and `tests/unit/blog-inventory.spec.ts` recomputes it, so editing this without
   * re-running the generator fails the build rather than leaving a stale picture in
   * somebody's timeline. A hash can only guard a string it can read, which is why this is
   * a plain value in a module plain Node can import.
   */
  claim: 'Never miss a release again.',

  hero: {
    /**
     * Two keys and not a lines array, unlike `problem.sub` below: these are two `<span>`s
     * with two classes doing two jobs. `.turn` is the promise - it outlives the rest of
     * the copy on a black screen (owner, 2026-09-03) - and `.headline` is the LCP element
     * under `docs/adr-0003-hero-lcp.md`, so neither span may be merged away.
     */
    drop: 'They dropped it',
    turn: 'You always catch it',
    sub: "Hearing from all your favorite artists doesn't need to be complicated. No more missed releases, no more endlessly searching around. It's this simple.",
  },

  problem: {
    /**
     * Split to one `<span>` per word by `Problem.astro`, not stored pre-split, so a Spanish
     * sentence with a different word count needs no timeline edit - `problem.ts` reads
     * `[data-word]` from the DOM and staggers by an amount rather than a per-item delay.
     */
    headline: 'You follow more artists than any feed can keep up with.',
    /**
     * Rendered joined by `<br />`. One element would mean no break, so a translation picks
     * its own break point or declines to have one - this line's break is tuned to where
     * the English wraps and nothing about that transfers.
     */
    sub: [
      "Algorithms guess and weekly playlists just can't fit everything. Somewhere in there,",
      "something you'd love just didn't make the cut.",
    ],
    action: 'See how it works',
  },

  feed: {
    headline: 'Every release. In order. Nothing hidden.',
    sub: 'No algorithm decides what you see. All of your favorite artists, all in one place. Integrates with Spotify, Apple Music, and more (soon).',
  },

  playlist: {
    headline: 'Already in your playlist.',
    sub: 'Automatically add new releases to a playlist in your favorite streaming service. Separate by genre, vibes, or put them all together. Your pick.',
  },

  notify: {
    headline: "You don't go looking around. The release comes to you.",
    sub: "Per artist notifications the moment they drop. For the artists you'd drop everything for - the rest can stay quiet.",
    /** The page's closing ask. Its headline is `claim` above. */
    ctaSub: 'Sonaru is coming soon to an App Store near you. Want to be the first to know?',
    ctaAction: 'Join the waitlist',
  },

  /**
   * Text inside the device mockups.
   *
   * `design-system.md` §6 reserves the device frame for real app UI, so these are the
   * app's words rather than the site's - and at 8.11c they are the one place on this site
   * where the Spanish must match what the iOS app actually says, rather than reading well.
   */
  device: {
    lockScreen: {
      /**
       * The app name in the iOS notification banner. **Not translated**: it is the name on
       * the home screen, and iOS shows that verbatim in every locale.
       */
      appName: 'Sonaru',
      /**
       * The banner's body, by release kind. `{title}` is the record and `{kind}` the word
       * the manifest carries - "album", "EP". Two forms because English needs an article
       * before the kind and none before a bare title; a language that needs neither, or
       * needs agreement, changes these two strings rather than the component.
       */
      bodySingle: 'just released {title}',
      //   bodyOther: 'just released the {kind} {title}',
      bodyOther: 'just released {title}',
    },
    feedScreen: {
      /** The app's own section label, mirrored. */
      recommended: 'Recommended for You',
    },
  },
} as const;

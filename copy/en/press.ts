/**
 * `/press` - the boilerplate, the asset labels, and the address.
 *
 * **The boilerplate is the deliverable.** 8.10b wrote it at three lengths because a
 * journalist on a deadline wants a paragraph at the length their piece has room for, and
 * the last sentence of the long one - that Sonaru has not launched - was argued for and
 * approved at Gate B. **It must survive translation intact**: it is the one paragraph on
 * this site that gets pasted verbatim into print, and dropping that sentence in Spanish
 * would put an unshipped product into a newspaper as a shipped one.
 *
 * Filenames, byte weights, page counts and the address itself stay in
 * `src/data/press.ts`, where `tests/unit/press-assets.spec.ts` walks them against
 * `public/press/manifest.json` in both directions.
 */
export const press = {
  title: 'Press',
  eyebrow: 'Press',
  lede: 'Everything you need to know when writing about Sonaru: the logo, the colours, the app itself.',

  /** `{weight}` is the zip's size, read from the manifest. */
  kitDownload: 'Download the kit · {weight}',

  boilerplate: {
    heading: 'Boilerplate',
    intro:
      'Three lengths, depending on how much room the piece has. All three are current as of today and none of them needs approval before use.',
    /** The copy button's accessible name. `{length}` is the entry's own label, lowercased. */
    copyLabel: 'Copy the {length} description',
    /** Keyed by `Boilerplate.id`. The label names the length, not a clever thing. */
    entries: {
      'one-line': {
        label: 'One line',
        text: 'Sonaru is an app that notifies you of every new release from your favorite artists, the moment they drop.',
      },
      short: {
        label: 'About 50 words',
        text: 'Sonaru is an app for people who follow more artists than any streaming service will keep them current on. It watches every artist you care about and tells you the day they release anything - a single, an album, a feature - and can drop it straight into a playlist you choose.',
      },
      long: {
        label: 'About 100 words',
        text: 'Sonaru is an app for people who follow more artists than any streaming service will keep them current on. It watches every artist you care about and tells you the day they release anything - a single, an album, a feature - and can drop it straight into a playlist you choose. Every new release from a followed artist appears in your chronological feed with no editorial curation. Follows, likes and history live in Sonaru while Spotify and Apple Music handle streaming, so nobody has to switch services. Sonaru has not launched yet, so sonaru.app is taking waitlist signups for the mobile app.',
      },
    },
  },

  logo: {
    heading: 'Logo',
    intro:
      "The mark is an S that is also a sonar wave. Don't redraw it, recolour it beyond the two colourways below, or set the wordmark in another typeface.",
    /** Keyed by `Colourway.id`. */
    ways: {
      dark: {
        label: 'On dark',
        note: "The site's own colourway. Use it on anything darker than the mid-greys.",
      },
      light: {
        label: 'On light',
        note: 'For white and near-white grounds, where the pink wave disappears.',
      },
    },
    /**
     * Download labels, keyed by `LogoFile.file`. The byte weight is appended by the page
     * from the manifest, never written here.
     */
    files: {
      mark: 'Mark, SVG',
      'mark-512': 'Mark, PNG 512',
      'mark-1024': 'Mark, PNG 1024',
      'lockup-1024': 'Lockup, PNG 1024',
      'lockup-2048': 'Lockup, PNG 2048',
    },
    /** **Not an omission** - design-system.md §9.5 dropped outlining the wordmark, deliberately. */
    aside:
      "There is no vector lockup. The wordmark is live text rather than outlines, so an SVG of it would render in whatever typeface the reader's machine reached for. The mark on its own is geometry, and that one is SVG.",
  },

  /**
   * One sentence broken by two links, in reading order.
   *
   * Split rather than carried as markup in a single string: `set:html` on copy would
   * defeat the type system and open an injection surface, and reading these five keys top
   * to bottom is the whole sentence, which is what a translator needs.
   */
  brandDoc: {
    before: 'Working with the identity itself?',
    docLink: 'The brand document · PDF · {weight} · {pages} pages',
    middle:
      'covers construction, clear space, the full palette with its measured contrast, type, motion and voice. It reads on',
    pageLink: 'the brand page',
    after: 'too.',
  },

  colour: {
    heading: 'Colour',
    intro: 'The six worth having. Used on the website and application.',
    /** The copy button's accessible name. */
    copyLabel: 'Copy {hex}, {role}',
    /** What each swatch is for, keyed by its token name in `tokens.css`. */
    roles: {
      'plum-900': 'Brand ground',
      'plum-700': 'Primary fill',
      'plum-500': 'Edges and borders',
      'plum-300': "Links, and the mark's wave",
      'ink-950': 'Page ground',
      white: 'Primary text',
    },
  },

  screenshots: {
    heading: 'Screenshots',
    intro:
      'Five screens from the mobile app, at the resolution they were captured. Click one for the full-size file, or take all five from the kit above.',
    /**
     * Keyed by `Screen.id`. **`alt` describes the screen to someone who cannot see it and
     * never says "screenshot"** - the word names the file, not the thing in it.
     */
    screens: {
      welcome: {
        title: 'Signing in',
        alt: 'The opening screen, offering sign-in with Spotify, Apple Music, or an email address.',
      },
      feed: {
        title: 'The feed',
        alt: 'A chronological feed of new releases from followed artists, newest first, each with its cover and the day it came out.',
      },
      search: {
        title: 'Finding an artist',
        alt: 'The search screen, with live results for artists as the name is typed.',
      },
      'auto-add': {
        title: 'Auto-add to a playlist',
        alt: 'Auto-Add settings, showing the destination playlist and a list of excluded artists.',
      },
      pro: {
        title: 'Sonaru Pro',
        alt: 'The Sonaru Pro screen, showing subscription status, the renewal date, and a link to manage it.',
      },
    },
  },

  contact: {
    heading: 'Get in touch',
    /** Around the address and the `/support` link, in reading order. */
    before: 'Press enquiries:',
    middle: '. Reaches a real person, but not our support. If something is wrong with the app,',
    after: 'is the faster door.',
  },
} as const;

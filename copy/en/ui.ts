/**
 * Chrome, page metadata, and the routes that are mostly one screen of copy.
 *
 * The home page's five acts are in `./home.ts`; `/pricing`, `/press` and `/brand` have
 * their own files. Everything else is here, because splitting a four-string route into its
 * own module buys nothing and costs a translator a file to find.
 *
 * **Page titles and descriptions are copy, not configuration.** `Base.astro` builds the
 * whole `og:`/`twitter:`/canonical block from them (8.10a), so a route whose title is not
 * translated unfurls in English in a Spanish visitor's timeline - which is the one place
 * a missing translation is seen by people who never visited the page.
 */
export const ui = {
  /** The first thing a keyboard visitor meets on every route. */
  skipToContent: 'Skip to content',

  /** The lockup's link, on both the header and the footer. */
  homeLabel: 'Sonaru - home',

  header: {
    /**
     * The header's one action, and the only thing on the site that makes `/waitlist`
     * reachable - 8.10e removed the navigation and did not put it back. Absent on
     * `/waitlist` itself.
     */
    action: 'Join the waitlist',
  },

  footer: {
    /** Names the footer's `<nav>`, which is not a heading - see `Footer.astro`. */
    label: 'Footer',
    /**
     * Group labels, keyed by `NavGroup.id`.
     *
     * Keyed rather than positional because `Footer.astro` derives each group's DOM `id`
     * from this key: deriving it from the label, as it did before 8.11a, makes
     * `aria-labelledby` a function of the translation, so the Spanish footer would have
     * pointed at ids that did not exist.
     */
    groups: {
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
    },
    /** Destination labels, keyed by `NavItem.id`. Sentence case, matching each page's own title. */
    items: {
      waitlist: 'Join the waitlist',
      changelog: 'Changelog',
      blog: 'Blog',
      press: 'Press',
      brand: 'Brand',
      privacy: 'Privacy',
      terms: 'Terms',
      support: 'Support',
      takedown: 'Request a takedown',
    },
    /**
     * The bottom bar's rights line, one line from the takedown link it depends on.
     *
     * **It names photography as well as artwork, and that is the correction 8.13 carried.**
     * It read "Album artwork is the property of its rights holders." from 8.9a until launch,
     * while the site shipped twelve artist photographs whose rights holders are photographers
     * rather than labels - `design-system.md` §7 was rewritten on 2026-09-12 to say so and
     * this sentence was not. **"Respective rights holders" is `terms.md`'s phrase**, chosen
     * over a near-identical one so the footer and the legal document state the same thing.
     *
     * It was hardcoded in `Footer.astro` until then, the one footer string 8.11a's extraction
     * missed - invisible because `/es/` is out of the published build.
     */
    artwork:
      'Music metadata provided by MusicBrainz. Album artwork and artist photography are the property of their respective rights holders.',
  },

  /** The App Store link's accessible name. The badge itself is an image with no text. */
  appStoreBadge: 'Download Sonaru on the App Store',

  /**
   * The copy buttons on `/press` and `/brand`.
   *
   * **These reach the browser as `data-` attributes, not as an import.** `copy-buttons.ts`
   * runs client-side, so importing the catalogue there would ship every locale's copy of
   * these to every visitor - the same rule the two islands follow, and `CopyBlock.astro`
   * already passed its accessible label down this way.
   */
  copyButton: {
    idle: 'Copy',
    done: 'Copied',
    /**
     * Shown when `navigator.clipboard.writeText` is refused - Safari does this when the
     * click is not trusted. Saying "Copied" anyway would be a lie about what is on the
     * visitor's clipboard.
     */
    manual: 'Press ⌘C to copy',
  },

  /** What `Base.astro` puts in `<title>` and `<meta name="description">`, per route. */
  meta: {
    home: {
      title: 'Sonaru - Your new music friend.',
      description:
        "Meet the app that makes sure you hear from your favorite artists. Notifications the moment they drop, a feed that doesn't skip songs, playlist auto-adds.",
    },
    pricing: {
      title: 'Pricing · Sonaru',
      description:
        "Meet the app that makes sure you hear from your favorite artists. Notifications the moment they drop, a feed that doesn't skip songs, playlist auto-adds.",
    },
    waitlist: {
      title: 'Be the first to know · Sonaru',
      description:
        "Coming soon to an App Store near you. Leave your email and we'll tell you the day it lands.",
    },
    notFound: {
      title: 'Page not found · Sonaru',
      description: "That page isn't here. The link may be old, or the address mistyped.",
    },
    blog: {
      title: 'Blog · Sonaru',
      description:
        'Notes on release tracking, the engineering behind Sonaru, and the craft of building it.',
    },
    changelog: {
      title: "What's new · Sonaru",
      description: 'Every Sonaru release, what shipped in it, and when.',
    },
    press: {
      title: 'Press · Sonaru',
      description: 'Logos, colours, screenshots and boilerplate for anyone writing about Sonaru.',
    },
    brand: {
      title: 'Brand · Sonaru',
      description:
        "Sonaru's identity: the mark and how it is built, the colour system, the type, the motion language.",
    },
    documents: {
      privacy: {
        title: 'Privacy Policy · Sonaru',
        description: 'What Sonaru collects, why, and how you can control it.',
      },
      terms: {
        title: 'Terms of Service · Sonaru',
        description: 'The terms you agree to when you use the Sonaru app, or this website.',
      },
      support: {
        title: 'Support · Sonaru',
        description:
          'Have a question? Talk to support, request account deletion, and artwork takedown requests.',
      },
    },
    tags: {
      product: {
        title: 'Product · Sonaru',
        description: 'What Sonaru does, and the problem it was built to fix.',
      },
      engineering: {
        title: 'Engineering · Sonaru',
        description: 'How we built Sonaru, and all the nerdy details.',
      },
      craft: {
        title: 'Craft · Sonaru',
        description: 'Design, motion, and the decisions behind how Sonaru looks.',
      },
    },
  },

  notFound: {
    eyebrow: 'Error 404',
    headline: "This page isn't here.",
    lede: 'The link may be old, or the address mistyped. Everything the site has is below.',
    action: 'Go to the home page',
  },

  changelog: {
    title: "What's new in Sonaru",
    eyebrow: 'Changelog',
    lede: 'News about our releases, what was added or changed, and any important info.',
    /** Prefixes the version number in the meta line. */
    version: 'Version',
    /**
     * **The honest state, not a placeholder.** Sonaru has never shipped, so 1.0 has no
     * date - 8.9e chose this over printing one that had not happened.
     */
    unreleased: 'Not yet released',
  },

  waitlistPage: {
    eyebrow: 'The waitlist',
    headline: 'Sonaru is coming soon.',
    lede: "Leave your email and we'll tell you the day it lands.",
    /** Shown instead of the form once `LAUNCH_STAGE` flips to general availability. */
    gaNote: 'Free to download. Everything in the feed is free.',
    /**
     * The `<noscript>` paragraph, split around the one mailto link in it.
     *
     * Three keys rather than one string with markup in it: `set:html` on copy would defeat
     * the type system and open an injection surface, and a translator needs to see the
     * whole sentence, which reading these three in order gives them.
     */
    noscript: {
      before:
        'This page needs JavaScript, which is unusual for this site and deliberate here: the form is protected by a bot check that cannot run without it. Every other page reads fine with JavaScript off. If you’d rather not turn it on, email',
      after: "and we'll add you by hand.",
    },
  },

  blog: {
    eyebrow: 'Blog',
    headline: 'Notes from building the music app that refuses to skip anything.',
    lede: 'For those who want to know more about us, or how we build and maintain Sonaru.',
    /** The RSS `<link>`'s title, and the feed's own. */
    feedTitle: 'Sonaru',
    backToIndex: '← All posts',
    emptyTag: 'Nothing here yet. There will be.',
    /**
     * **A plural rule, not a suffix.** English has two forms and so does Spanish, but a
     * language with three would need a third key here rather than a string concatenation
     * at the call site - which is why the count is interpolated into a whole sentence
     * instead of being glued to a noun.
     */
    postCount: {
      one: '1 post',
      other: '{count} posts',
    },
    /** Tag labels and blurbs, keyed by `Tag.slug`. */
    tags: {
      product: {
        label: 'Product',
        description: 'What Sonaru does, and the problem it was built to fix.',
      },
      engineering: {
        label: 'Engineering',
        description: 'How we built Sonaru, and all the nerdy details.',
      },
      craft: {
        label: 'Craft',
        description: 'Design, motion, and the decisions behind how Sonaru looks.',
      },
    },
  },
} as const;

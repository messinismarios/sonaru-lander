/**
 * `/brand` - the identity document's words, tabular and running both.
 *
 * **The running prose is split around its own inline markup**, the same pattern
 * `press.ts`'s `brandDoc` and `ui.ts`'s `waitlistPage.noscript` already use: `set:html` on
 * copy would defeat the type system and open an injection surface, so a sentence broken by
 * an `<em>` or a `<strong>` is stored as the fragments either side of it plus the
 * emphasised words themselves, and the page's own markup does the wrapping. A code token
 * that names a CSS variable, a file, or a command (`--color-plum-300`, `tokens.css`,
 * `npm run contrast`) is not prose and stays written directly in the page - translating it
 * would make it stop being the thing it names.
 *
 * Everything tabular and labelled was already here: the chapters, the rules, the misuse
 * and voice tables, the colour groups, and the contrast table's own words. Numbers still
 * are not - every figure on that page is read from the file that owns it (`PRESET`,
 * `PAIRINGS`, `DURATION`, `tokens.css`), which is the property the page is built on and the
 * reason it cannot disagree with the product.
 */
export const brand = {
  title: 'Brand',
  eyebrow: 'Brand',
  lede: 'How Sonaru is drawn, coloured, set, moved and written.',

  /** The contents rail's accessible name and its visible label. */
  contents: 'Contents',

  /** The printed-only cover's download line. `{weight}` and `{pages}` come from the manifest. */
  download: {
    label: 'Download this document',
    format: 'PDF',
    pagesSuffix: 'pages',
  },

  /** Keyed by `Chapter.id`. Order is the page's order and the PDF's. */
  chapters: {
    mark: 'The mark',
    'mark-description':
      'The mark is an S that is also a sonar wave: a C whose trajectory the wavefront shares, flowing into a second bowl that curls outward. The S is the letter and the wave is the signal - two colours doing two jobs, which is the one thing to understand before using it.',
    construction: 'Construction',
    'clear-space': 'Clear space, size and misuse',
    colour: 'Colour',
    type: 'Type',
    motion: 'Motion',
    artwork: 'Artwork',
  },

  /** The wordmark paragraph. */
  wordmark: 'The wordmark sets the name in Outfit at 600, tracked −0.03em:',
  sideBySide: 'Side by side:',

  /** The aside pointing at /press, split around its one link. */
  pressAside: {
    before: 'Logo files, in both colourways and as a zip, are on',
    link: 'the press page',
    after: 'This document is how the identity works.',
  },

  construction: {
    intro:
      "Two tangent circles on a horizontal axis. The stroke runs most of the way round the large one - the C, and the wavefront's trajectory - crosses the tangent point, then runs most of the way round the small one in the opposite rotational direction. Reversing the bend at the tangent is what makes it an S rather than a C with a hook.",
  },

  /** The three figure captions, split around their code tokens and emphasis. */
  figureCaptions: {
    bowls: {
      before: 'Tangency fixes the second centre at',
      middle: 'from the first, so shrinking the tail moves it',
      emphasis: 'left',
      after: 'as well as making it smaller.',
    },
    sonar: {
      before: 'The sonar is a separate arc on the',
      sameCentre: 'same centre',
      middle: 'as the C and a',
      largerRadius: 'larger radius',
      after: 'It is a wider arc on the same origin, not a tighter one held at a distance.',
    },
    overlap: {
      before: "Because it is larger and concentric, the wave's inner edge passes",
      through: 'through',
      middle: "the S's stroke. The clearance is",
      negative: 'negative, so it is an overlap of',
      middle2: 'rather than a gap. That is deliberate, and it is why the wave is set at',
      after:
        'opacity: at full strength the crossing reads as a bar drawn across the mark, and at this strength it reads as a wave passing behind it.',
    },
  },

  /** The plain aside closing the construction chapter - the mark is final, not unfinished. */
  markAside:
    'The mark is exact circular arcs with no optical correction - joins unteased, stroke unmodulated where the curve tightens, terminals uncut.',

  /** Figure captions, which are `title` attributes on the SVGs. */
  figures: {
    mark: 'The Sonaru mark',
    bowls: 'The two tangent circles the S is built from',
    sonar: 'The sonar’s circle, concentric with the C',
    overlap: 'Where the wave crosses the S',
  },

  /** How the name is written. Four rules, in the order the chapter says them. */
  naming: {
    heading: 'Writing the name',
    rules: [
      'Sonaru, one word, capital S and nothing else capitalised. Never SONARU, never sonaru, never Sonaru.app in prose.',
      'The product is an application, so “Sonaru” is a thing you open rather than a company you deal with.',
      'The site is sonaru.app. Lower case, including at the start of a sentence - rewrite the sentence rather than capitalise the domain.',
      'The wave in the mark is the sonar return / a soundwave. You can use both when describing it.',
    ],
  },

  /** The number of strokes is in `src/data/brand.ts`; this explains why it is that number. */
  clearSpace: {
    heading: 'Clear space',
    note: 'One stroke width on every side, measured from the mark’s outermost ink - which on the left is the sonar’s arc, not the S. The stroke is the only measurement inside the mark that a reader can see without being told where to look, so the rule can be checked by eye at any size.',
  },

  /** The 20px figure and the 16/20/24 comparison are data; this is the argument for them. */
  minimumSize: {
    heading: 'Minimum size',
    note: 'Below this the wave stops being a wave. It is set at 0.34 opacity so that it reads as passing behind the S rather than as a bar drawn across it, and that is exactly the quality that fails first as the mark shrinks.',
  },

  misuse: {
    heading: 'Misuse',
    intro: 'Six things not to do. Each panel is the real mark with the mistake applied.',
    /** Prefixes each panel's accessible label - `aria-label="{dontPrefix}: the mark recoloured"`. */
    dontPrefix: 'Don’t',
    /** Keyed by `Misuse.id`. */
    items: {
      recolour: {
        label: 'The mark recoloured',
        reason:
          'The S is white and the wave is --color-plum-300. They are two colours doing two jobs: the S is the letter and the wave is the signal. A single-colour mark is available and is the light colourway - use that rather than tinting this one.',
      },
      opacity: {
        label: 'The wave at full opacity',
        reason:
          'The wave crosses the S’s stroke. At full strength that overlap reads as a bar drawn across the mark; the low opacity is what makes it read as depth. This is the single easiest way to make the mark look broken.',
      },
      stretch: {
        label: 'The mark stretched',
        reason:
          'It is built from circles. Scaling the axes independently turns every one of them into an ellipse, and the stroke weight stops being constant around the curve - which is visible long before the distortion itself is.',
      },
      rotate: {
        label: 'The mark rotated',
        reason:
          'The two bowls sit on a horizontal axis and that is what keeps the S level and the curl outward. Rotating the logo ruins how it is perceived.',
      },
      busy: {
        label: 'The mark on a busy ground',
        reason:
          'The wave is the first thing to disappear. On artwork or photography, use the ground the mark is drawn for - or the light colourway on a plain light one.',
      },
      reface: {
        label: 'The wordmark reset in another face',
        reason:
          'The logotype is Outfit at 600, tracked −0.03em. It should not be altered or swapped.',
      },
    },
  },

  colour: {
    /** The intro paragraph, split around the one code token it names. */
    intro:
      'Twenty tokens in four groups. Every value is used in different ways, for different things.',
    /** Keyed by `ColourGroup.id`. The token lists themselves stay in `src/data/brand.ts`. */
    groups: {
      ink: {
        label: 'Ink',
        note: 'The ground and the surfaces on it. Nothing here is ever text - --color-ink-700 is a divider and is the one pairing in the contrast table with no minimum.',
      },
      text: {
        label: 'Text',
        note: 'Three levels and no more. Primary, secondary, and the muted level meta lines are set in - every one of them scored against every ground it is allowed on.',
      },
      plum: {
        label: 'Plum',
        note: 'The brand ramp. The lower half is ground and fills, the upper half is interactive colour and the mark’s wave. Desaturated at constant hue so the accent reads as wine rather than as hot pink.',
      },
      bloom: {
        label: 'Bloom',
        note: 'Colors used in the website, not part of the brand. They are painted at low opacity behind everything and are the reason each act has its own temperature. Useful if you need variety - not to be used for main elements.',
      },
    },
    usageHeading: 'Usage, and what it measures',
    columns: {
      pairing: 'Pairing',
      usedFor: 'Used for',
      level: 'Level',
      ratio: 'Ratio',
    },
    /** The usage paragraph, split around its emphasis and the command it names. */
    usageNote:
      'Our palette is always measured and checked for readability. Every colour needs to pass our metrics based on its use, background, etc.',
    /** The pairings table's caption, split around the count it prints. */
    pairingsCaption: {
      before: 'All',
      after: 'declared pairings, measured against WCAG 2.2.',
    },
    /** The aside on the one pairing with no minimum, split around its code token. */
    dividerAside: {
      before: 'One row has no minimum.',
      after:
        'on the ground is about 1.3:1. That one is a divider, and it is tracked here precisely so that nobody sets text in it (as it would render it unreadable).',
    },
  },

  /**
   * The contrast table's words.
   *
   * **`scripts/check-contrast.mjs` prints these too**, which is why they live in a module
   * plain Node can import and why the script reads English specifically: its output is a
   * developer's console, not a page. `PAIRINGS` - the tokens and the WCAG thresholds -
   * stays in `src/lib/contrast.ts`, where a translator cannot reach it.
   */
  contrast: {
    /** Keyed by `Level`. */
    levels: {
      AA: 'AA, body text',
      'AA-large': 'AA, large text',
      'non-text': 'AA, non-text',
      tracked: 'decorative - tracked only',
    },
    /** What each pairing is for, keyed by `Pairing.id`. */
    uses: {
      'primary-on-ground': 'Primary text on the page ground',
      'primary-on-raised': 'Primary text on a raised surface',
      'primary-on-inset': 'Primary text on an inset surface',
      'primary-on-brand': 'Primary text over the brand ground',
      'primary-on-wash': 'Primary text over a section wash',
      'secondary-on-ground': 'Secondary body text',
      'secondary-on-raised': 'Secondary body text, raised',
      'secondary-on-brand': 'Secondary body over brand ground',
      'muted-on-ground': 'Muted / meta text',
      'muted-on-raised': 'Muted / meta text, raised',
      'link-on-ground': 'Links, hover, focus ring',
      'link-on-raised': 'Links on a raised surface',
      'interactive-on-ground': 'Primary interactive colour, as text',
      'button-label': 'Button label on the primary fill',
      'button-label-hover': 'Button label, primary hover',
      'button-border-on-ground': 'Primary button border vs ground',
      'button-border-on-top-stop': 'Primary button border vs top stop',
      'display-accent': 'Display-size accent type (>=24px)',
      'focus-indicator': 'Focus indicator against the ground',
      divider: 'Decorative divider - never text',
      'primary-on-mid-stop': 'Primary text, mid ground stop',
      'secondary-on-mid-stop': 'Secondary text, mid ground stop',
      'muted-on-mid-stop': 'Muted text, mid ground stop',
      'muted-on-top-stop': 'Muted text, worst-case top stop',
      'link-on-top-stop': 'Links over the top stop',
      'interactive-on-top-stop': 'Interactive colour over the top stop',
    },
  },

  /**
   * The type ramp, keyed by its token's suffix. The **samples are real site copy** rather
   * than filler, so the specimen shows the face doing the job it actually does - and in
   * Spanish they should be the Spanish site's own lines, not these translated.
   */
  type: {
    /** The chapter's opening paragraph, split around its two typeface names. */
    intro: {
      satoshi: 'Satoshi',
      afterSatoshi: 'sets everything, at weights 300–900.',
      outfit: 'Outfit',
      after:
        'sets one word - the logotype - and is subset to its six letters, about 2 KB. It falls back to Satoshi rather than to a system font, so a failed load still degrades to something recognisably Sonaru.',
    },
    /** The display/reading-copy paragraph, split around its four CSS tokens. */
    displayType: {
      before: 'Display type is set at',
      lineHeight: '1.05 line height, −0.03em',
      afterLineHeight: 'Reading copy is its own pair:',
      afterProseToken: 'runs 16px to 20px and',
      afterMeasureToken:
        'is derived from it, holding the line to about 80 characters at any width.',
    },
    ramp: {
      '3xl': { role: 'Hero', sample: 'Never miss a release again.' },
      '2xl': { role: 'Act headline', sample: 'The feed that stays in order' },
      xl: { role: 'Card title', sample: 'Follow an artist once' },
      lg: { role: 'Lede', sample: 'It watches every artist you care about.' },
      prose: { role: 'Reading copy', sample: 'A paragraph of a long document.' },
      body: { role: 'Body', sample: 'Copy inside a section.' },
      sm: { role: 'Meta', sample: '9 September 2026 · 4 min read' },
      xs: { role: 'Eyebrow', sample: 'PRESS' },
    },
  },

  motion: {
    intro:
      'Four durations, two curves, three staggers. Nothing on this site invents a timing: a component that needs one calls a timeline factory, and the numbers live in one file.',
    tableCaption: 'The duration scale, in seconds.',
    columns: {
      name: 'Name',
      seconds: 'Seconds',
      usedFor: 'Used for',
      hoverToRun: 'Hover to run',
    },
    /** Keyed by the duration token's name. The seconds come from `src/motion/tokens`. */
    durations: {
      micro: 'Hover, focus, a toggle flipping',
      ui: 'A control changing state',
      section: 'A section entering',
      hero: 'The largest move on the page',
    },
    /** The curves-and-staggers paragraph, split around its four code tokens. */
    curves: {
      before: 'The two curves are',
      afterOut: 'for anything entering or settling, and',
      afterInOut: 'for something that leaves and returns. Staggers are',
      afterCharacter: 's between characters,',
      afterWord: 's between words and',
      afterSequence: 's between the steps of a sequence.',
    },
    /** The scrub paragraph, split around its two dynamic values. */
    scrub: {
      before: 'Scroll-linked sections use a smoothed scrub of',
      afterSeconds: 'second and start at',
      after:
        'The scrub is never raw: tying a timeline to the scroll position frame for frame exposes every dropped frame the device has.',
    },
    reducedHeading: 'Reduced motion is a designed state, not a kill switch.',
    reducedNote:
      'Every timeline is defined inside a media context so its reduced variant is written beside it and cannot be forgotten - the scrubbed sections resolve to a composed frame that says the same thing without moving, rather than to their own last frame. This page is the mild case: nothing here moves unless you hover or focus it, so reduced motion has almost nothing to switch off, and the demonstrations above simply hold their end state.',
  },

  artwork: {
    /** The opening paragraph, split around its one emphasis. */
    intro: {
      before: 'The artwork on this site is',
      emphasis: 'album covers we do not own',
      after:
        'Album artwork and artist photography are the property of their respective rights holders.',
    },
    /** The treatment paragraph, split around its one emphasis. */
    treatment: {
      before: 'So the direction is a',
      emphasis: 'treatment',
      after:
        "rather than a look. Covers appear inside the device mockups at the size and crop the app itself uses. The colour behind them is the brand plum as a radial, and the app's own artwork-driven tint stays present throughout.",
    },
  },

  appAndWeb: {
    heading: 'The app and the site',
    rules: [
      'The app is the product and the site is an argument for it. Where the two disagree about what Sonaru does, the app is right and the site is out of date.',
      'The site never shows a screen the app does not have. The device mockups on the home page are real DOM built from the app’s own structure, not video and not illustration, so a screen that changes in the app is a change here too rather than a render nobody re-exported.',
      'Both grounds are the same plum. The site’s --color-ground-mid is the app’s Theme.swift gradient, not a colour picked to match it.',
      'The site is dark because the app is dark. There is no light mode on either, and the light logo colourway exists for other people’s documents rather than for a theme we ship.',
    ],
  },
} as const;

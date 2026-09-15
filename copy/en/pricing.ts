/**
 * `/pricing` - the hero, the two cards, the comparison table and the FAQ.
 *
 * **No number is in here.** Cents, the yearly total, the derived discount and the
 * indicative-pricing flag all stay in `src/data/pricing.ts`, which is where
 * `tests/unit/pricing-data.spec.ts` checks them against `specs/mission.md`. A translator
 * cannot change a price from this file, which is the point of the split.
 *
 * The FAQ moved here whole rather than splitting like the plans and the comparison rows
 * did: a question and its answer carry no structural data at all, so leaving an id-only
 * husk behind in the data module would have been a file that exists to be joined to
 * this one.
 */
export const pricing = {
  hero: {
    eyebrow: 'Pricing',
    headline: 'Everything you came for is free.',
    lede: 'Pro is for what you do with it afterwards.',
  },

  /** Names the plans section, which has no visible heading of its own. */
  plansLabel: 'Plans',

  toggle: {
    /** The control's accessible name. */
    label: 'Billing period',
    monthly: 'Monthly',
    /** `{discount}` is computed from the prices - never written, so it cannot outlive one. */
    yearly: 'Yearly - {discount}% off',
  },

  card: {
    /** The badge on the featured card. */
    featured: 'Most complete',
    /** Under a monthly or annualised figure. */
    perMonth: 'per month',
    /** The free card prints these two instead of a figure and a unit. */
    freeAmount: 'Free',
    freeUnit: 'and staying that way',
    /** `{amount}` arrives already formatted, with its currency symbol. */
    yearlyNote: 'That’s {amount} billed yearly.',
    /** Shown while `PRICING_IS_INDICATIVE`. 8.13 turns it off by flipping that flag. */
    indicative: 'Indicative beta pricing - confirmed before launch.',
  },

  /** Keyed by `Plan.id`. The cents and the `featured` flag stay in `src/data/pricing.ts`. */
  plans: {
    free: {
      name: 'Free',
      tagline: 'The whole promise, at no cost.',
      includes: [
        'Every release from every artist you follow',
        'Chronological feed - nothing curated away',
        'Instant per-artist notifications',
        'Auto-add to one playlist per connected service',
        'Genre-based recommendations',
        'Follow friends and share',
      ],
      cta: 'Join the waitlist',
    },
    pro: {
      name: 'Pro',
      tagline: 'For the way you actually file music.',
      includes: [
        'Everything in Free',
        'Multiple auto-add playlists, with rules per genre or artist',
        'Recommendations down to the song and album',
        'Collaborative filtering, not just genre',
        'Advanced sharing and social',
      ],
      cta: 'Join the waitlist',
    },
  },

  compare: {
    eyebrow: 'Line by line',
    headline: 'What each tier actually gives you',
    columns: {
      feature: 'Feature',
      free: 'Free',
      pro: 'Pro',
    },
    /** Printed instead of the Pro cell where `sameAsFree` - the UI marks it, never repeats it. */
    same: 'Same',
    /**
     * Keyed by `ComparisonRow.id`. **Which side of the line each feature falls on is the
     * product's decision, not this file's** - `sameAsFree` lives in `src/data/pricing.ts`
     * and `tests/unit/pricing-data.spec.ts` guards it against `specs/mission.md`. A
     * translation can reword a row; it cannot move one.
     */
    rows: {
      feed: {
        feature: 'Feed',
        free: 'Full chronological feed',
        pro: 'Full chronological feed',
      },
      notifications: {
        feature: 'Notifications',
        free: 'Per-artist toggle, instant delivery',
        pro: 'Per-artist toggle, instant delivery',
      },
      autoAdd: {
        feature: 'Auto-add',
        free: 'One playlist per connected streaming service',
        pro: 'Multiple playlists with rules - per genre, per artist',
      },
      recommendations: {
        feature: 'Recommendations',
        free: 'Genre-based',
        pro: 'Genre-based, collaborative filtering, song and album level',
      },
      social: {
        feature: 'Social',
        free: 'Follow friends, share',
        pro: 'Follow friends, share, plus advanced sharing',
      },
    },
  },

  faq: {
    eyebrow: 'Questions',
    headline: 'Before you decide',
    /**
     * Order is the page's order and the `FAQPage` structured data's. Adding one here adds
     * it to both.
     */
    entries: [
      {
        question: 'Is Sonaru free?',
        answer:
          'Yes. The complete chronological feed, instant per-artist notifications, and auto-add to one playlist per connected service are all free, and stay free. Pro adds power on top of that rather than unlocking the basics.',
      },
      {
        question: 'Do I need Spotify or Apple Music?',
        answer:
          'Yes. Sonaru is not a streaming service - it tells you what came out and then plays it at full quality through the subscription you already have, using the Spotify SDK or Apple MusicKit.',
      },
      {
        question: 'How quickly will I hear about a new release?',
        answer:
          'Within about an hour of it landing. Sonaru mirrors release data continuously rather than waiting for a weekly refresh, which is the difference between hearing about a record on the day and hearing about it on Friday.',
      },
      {
        question: 'Are notifications part of Pro?',
        answer:
          'No. Instant per-artist notifications are on the free side and ship in the beta. Being told the day a release lands is the thing Sonaru is for, so it is not the thing we charge for.',
      },
      {
        question: 'Is this pricing final?',
        answer:
          'Not yet. The figures above are indicative while Sonaru is in beta. Final Pro pricing is confirmed before launch, and everyone on the waitlist hears it first.',
      },
    ],
  },
} as const;

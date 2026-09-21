/**
 * The waitlist island's strings.
 *
 * **Its own namespace because these are the only strings on the site that cross the wire.**
 * `WaitlistForm.svelte` is a hydrated component: if it imported the catalogue, every
 * visitor would download every locale's copy of it. So `waitlist.astro` passes this object
 * in as one typed prop and the island imports nothing from `src/i18n/`. Keeping it in a
 * file of its own is what makes that budget rule visible rather than a comment somebody
 * has to remember - see `src/i18n/index.ts`.
 *
 * **The refusal messages are the most-read copy on the site that nobody plans for.** They
 * are what a person sees at the moment the thing they tried did not work, and 8.8's rule
 * was that a message naming an internal reason code would be true and useless. A
 * translation that turns them back into `error_invalid_email` has undone the unit.
 */
export const waitlist = {
  /**
   * Keyed by the server's refusal reason. **Anything the server sends that is not listed
   * here gets `generic`** - that fallback is deliberate, because an unrecognised code is
   * our fault rather than the visitor's.
   */
  errors: {
    'malformed-email': "That doesn't look like an email address. Mind checking it?",
    'undeliverable-domain': "We can't find a mail server for that domain. Is it spelled right?",
    'disposable-domain': 'That looks like a temporary address - we need one that will still work.',
    'rate-limited': "That's a few tries in a row. Give it an hour and try again.",
    'failed-challenge': "The bot check didn't pass. Reload the page and try once more.",
    'missing-token': 'The bot check has not finished loading yet. Give it a second.',
    'too-fast': 'That was quick. Try that once more.',
    /** Ours, not theirs. */
    generic: "Something went wrong on our end. Try again in a moment - it's not you.",
    /** The request never arrived anywhere. */
    network: "We couldn't reach the server. Check your connection and try again.",
  },

  field: {
    label: 'Email address',
    /** A real-looking address, not an instruction. The visible label does the instructing. */
    placeholder: 'you@example.com',
  },

  /** The honeypot's label. Hidden from sight and from assistive technology, and never read. */
  honeypot: 'Company website',

  submit: {
    idle: 'Join the waitlist',
    loading: 'Adding you…',
  },

  /** The polite live region, announced while the request is in flight. */
  loadingStatus: 'Adding you to the waitlist',

  /** Around the guessed address, which is a `<button>`. */
  suggestion: {
    before: 'Did you mean',
    after: '?',
  },

  note: {
    text: 'One email, when it launches. Nothing else, ever.',
    link: 'Privacy policy',
  },

  success: {
    heading: "You're on the list.",
    body: "We'll email you the day Sonaru is on the App Store and Google Play. That's the only email you'll get.",
  },

  duplicate: {
    heading: "You're already on the list.",
    body: "Nothing to do - we have your address and we'll be in touch the day it lands.",
  },
} as const;

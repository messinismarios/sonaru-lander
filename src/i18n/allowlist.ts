/**
 * What `tests/unit/i18n-catalogue.spec.ts` is allowed to find in `src/`.
 *
 * The copy itself lives in `copy/<locale>/` since 8.11b - see `copy/README.md`. This list is
 * the set of places in `src/` that are allowed to hold a sentence anyway.
 *
 * The guard scans every component, page and data module for a user-visible string that
 * did not come from the catalogue, and fails on anything it finds. **Every exemption is
 * listed here with a reason**, because an allowlist without reasons becomes the place
 * strings go to be forgotten - which is the failure this whole unit exists to remove.
 *
 * The guard is a test rather than an ESLint rule (owner, 8.11a Gate B). It is the fifth
 * inventory spec of its kind, after `blog-inventory`, `brand-inventory`, `nav-inventory`
 * and `press-assets`, and it fails the build through the same `npm run verify`.
 */

/** A whole file the scanner does not read, and why. */
export interface ExemptFile {
  readonly file: string;
  readonly reason: string;
}

/**
 * **Two kinds of exemption and no third.** The test asserts this list exactly, so a
 * blanket exemption cannot be added without the assertion being edited too - which is a
 * change a reviewer sees.
 */
export const EXEMPT_FILES: readonly ExemptFile[] = [
  {
    file: 'src/pages/kit.astro',
    reason: 'Development-only route. 8.13 deletes it; nobody outside this repo reads it.',
  },
  {
    file: 'src/pages/specimen.astro',
    reason: 'Development-only route. 8.13 deletes it.',
  },
  {
    file: 'src/pages/blog/lab.astro',
    reason: 'Development-only route. 8.13 deletes it.',
  },
  {
    file: 'src/pages/og/press-assets.astro',
    reason:
      'A build tool, not a route anyone visits: `npm run press` photographs it to make the ' +
      'kit’s contact sheet. Its labels name files for a journalist’s zip, and 8.13 leaves ' +
      'it out of the site.',
  },
  {
    file: 'src/pages/logo/lab.astro',
    reason:
      'The logo lab, which 8.13 keeps - the owner reserved it for finishing the mark. It ' +
      'is a tool for one person and is never linked from the site.',
  },
];

/** A single string the scanner may meet anywhere, and why it is not copy. */
export interface ExemptString {
  readonly value: string;
  readonly reason: string;
}

export const EXEMPT_STRINGS: readonly ExemptString[] = [
  {
    value: 'Sonaru',
    reason:
      'The product’s name. It is the same word in every language - iOS shows it verbatim ' +
      'in the notification banner, and og:site_name and the JSON-LD Organization both name ' +
      'the thing rather than describe it.',
  },
  {
    value: 'width=device-width, initial-scale=1',
    reason: 'The viewport meta’s value. A directive to the browser, not words to a reader.',
  },
  {
    value: 'noopener noreferrer',
    reason: 'HTML `rel` keywords, defined by the specification rather than written by us.',
  },
  {
    value: 'ZTG62MH2XQ',
    reason:
      'Cloudflare’s published Turnstile test site key, used until 8.13 provisions the real ' +
      'one. An opaque credential, not a word.',
  },
  {
    value: 'AA-large',
    reason:
      'A `Level` in `src/lib/contrast.ts` - the key the WCAG threshold is stored under. Its ' +
      'visible label is `brand.contrast.levels`, which is in the catalogue.',
  },
  {
    value: 'ScrollTrigger',
    reason: 'The GSAP plugin’s registered name. An identifier the library looks itself up by.',
  },
  {
    value: 'npm run contrast',
    reason:
      "`/brand`'s colour chapter names the script that checks its own table, inside a " +
      '<code> tag. A terminal command, not prose - translating it would make it stop ' +
      'running.',
  },
  {
    value: 'radius + tailRadius',
    reason:
      "`/brand`'s construction chapter names the two `mark-geometry.ts` fields a tangent " +
      'point is computed from, inside a <code> tag. A code expression, not prose.',
  },
  {
    value: 'top top',
    reason:
      'A ScrollTrigger `start` position - two keywords in GSAP’s own grammar, describing ' +
      'where an element meets the viewport.',
  },
  {
    value: '(prefers-reduced-motion: reduce) and (min-width: 768px)',
    reason: 'A CSS media query, passed to `matchMedia`. Syntax, not language.',
  },
  {
    value: '(prefers-reduced-motion: no-preference), (max-width: 767px)',
    reason: 'A CSS media query, passed to `matchMedia`. Syntax, not language.',
  },
  {
    value: 'M0,0 C0.34,1.56 0.64,1 1,1',
    reason: 'An SVG path describing an easing curve. Coordinates, not words.',
  },
  {
    value: 'expected YYYY-MM-DD',
    reason:
      'A Zod message shown to whoever is writing a post, at build time, in a terminal. ' +
      'Authoring diagnostics are for us; a visitor never reaches one.',
  },
  {
    value: 'expected YYYY-MM-DDTHH:MM:SSZ',
    reason: 'A build-time Zod message, as above - read by an author, never by a visitor.',
  },
  {
    value: 'expected a lowercase 6-digit hex',
    reason: 'A build-time Zod message, as above - read by an author, never by a visitor.',
  },
  {
    value: 'expected a version like 1.0 or 1.1.2',
    reason: 'A build-time Zod message, as above - read by an author, never by a visitor.',
  },
  /*
   * schema.org `@type` names. Identifiers in a published vocabulary, never rendered to
   * anyone, and **translating one would silently invalidate the structured data it
   * labels** - a Spanish `BlogPosting` is not a type Google knows, and the failure is a
   * rich result that stops appearing rather than an error anybody sees.
   */
  { value: 'BlogPosting', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'Organization', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'BreadcrumbList', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'ListItem', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'FAQPage', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'Question', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'Answer', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'WebSite', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'ContactPoint', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'Person', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'PostalAddress', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'AboutPage', reason: 'A schema.org @type name. See the note above this group.' },
  { value: 'ImageObject', reason: 'A schema.org @type name. See the note above this group.' },
  {
    value: 'customer support',
    reason: 'A schema.org contactType value, read by search engines and never shown. SEO H1.',
  },
  {
    value: 'Sonaru app',
    reason:
      'The WebSite alternateName - the product’s name plus a category word, not copy. SEO H1.',
  },
  /*
   * 8.14c's viewport branches. Each timeline hands `gsap.matchMedia()` a media query and a
   * few selectors and ScrollTrigger positions; the heuristic reads them as two-word prose.
   * They are addressed to the browser and to GSAP, and translating one would break the
   * branch it names.
   */
  { value: '(min-width: 768px)', reason: 'A media query for gsap.matchMedia(). See above.' },
  { value: '(max-width: 767px)', reason: 'A media query for gsap.matchMedia(). See above.' },
  { value: '.notify .device-slot', reason: 'A CSS selector. See the note above this group.' },
  { value: 'top bottom', reason: 'A ScrollTrigger start/end position. See above.' },
  { value: 'bottom top', reason: 'A ScrollTrigger start/end position. See above.' },
];

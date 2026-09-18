/**
 * Who makes Sonaru, as structured data - SEO audit M4 (owner, 2026-09-18).
 *
 * One `Person`, because three things name the same person and must never disagree:
 * `/about`, the byline on every post, and `founder` on the home page's `Organization`.
 *
 * **The words are not here.** The name and the place are `about.founder` in the catalogue,
 * since a place name is something a translation changes; this module holds only what is not
 * copy - where the person is introduced and the country code - and assembles the markup.
 *
 * **No `sameAs`** - no public profiles to link yet (M10). Add them here and every `Person`
 * on the site carries them.
 */
import type { Catalogue } from '../i18n';

/** The page that introduces them, and where the byline links. */
export const FOUNDER_HREF = '/about';

/** ISO 3166-1 alpha-2, for `addressCountry`. Greece. */
const COUNTRY_CODE = 'GR';

/** The same `Person` everywhere it appears, so the markup cannot drift between pages. */
export function founderPerson(t: Catalogue, site: URL | undefined) {
  return {
    '@type': 'Person',
    '@id': new URL(`${FOUNDER_HREF}#person`, site).href,
    name: t.about.founder.name,
    url: new URL(FOUNDER_HREF, site).href,
    address: {
      '@type': 'PostalAddress',
      addressLocality: t.about.founder.locality,
      addressCountry: COUNTRY_CODE,
    },
  } as const;
}

/**
 * Sonaru's own public profiles - SEO audit M10 (owner, 2026-09-18: `@sonaruapp` registered
 * on Instagram, X, TikTok and Reddit; a Spotify profile added the same day).
 *
 * One list, read in three places that must agree: the `sameAs` of the home page's
 * `Organization` (the list that tells a search engine these accounts and this site are one
 * entity - what a brand search's knowledge panel is assembled from), the footer's icon row,
 * and `twitter:site`. **Add a profile here once it exists and is Sonaru's**, never before: a
 * `sameAs` pointing at an unclaimed or someone else's handle attaches their account to ours.
 *
 * **The glyphs are `src/assets/social/<id>.svg`**, the platforms' own marks unmodified, as
 * their brand guidelines require: the single-colour versions from Simple Icons 15.22.0
 * (CC0-1.0), on a 24-unit grid, painted with `currentColor` so the footer sets them in its
 * own muted ink - what every platform permits for a monochrome glyph. Files rather than
 * strings here, because this module is imported by the tests under plain Node and path data
 * reads to the copy guard as prose. The accessible names are copy, in `ui.footer.social`.
 */
export interface SocialProfile {
  /** The key into `ui.footer.social` for the link's accessible name. */
  readonly id: 'instagram' | 'x' | 'tiktok' | 'reddit' | 'spotify';
  readonly href: string;
}

export const PROFILES: readonly SocialProfile[] = [
  {
    id: 'instagram',
    href: 'https://www.instagram.com/sonaruapp/',
  },
  {
    id: 'x',
    href: 'https://x.com/sonaruapp',
  },
  {
    id: 'tiktok',
    href: 'https://www.tiktok.com/@sonaruapp',
  },
  {
    id: 'reddit',
    href: 'https://www.reddit.com/user/sonaruapp/',
  },
  {
    id: 'spotify',
    href: 'https://open.spotify.com/user/31vpolundsj2rqrkvqffv75u7hmi',
  },
];

/** The `sameAs` list. */
export const SOCIAL_PROFILES: readonly string[] = PROFILES.map((profile) => profile.href);

/** `twitter:site` - the account a shared card is attributed to. */
export const X_HANDLE = '@sonaruapp';

/**
 * The one flag that swaps the site's primary call to action.
 *
 * The owner's phased-CTA decision (`tech-stack.md` §6): the waitlist converts now, the
 * App Store converts at general availability, and the change between them is a config
 * edit rather than a redesign. Both states are built and gated together at 8.8 so that
 * the flip is never the first time anyone sees the second one.
 */

export type LaunchStage = 'waitlist' | 'ga';

/** Flip to `'ga'` the day the listing is live. Nothing else needs editing. */
export const LAUNCH_STAGE: LaunchStage = 'waitlist';

/**
 * The App Store's numeric id for the app - the thing an `apple-itunes-app` meta tag and
 * every store URL are built from.
 *
 * **It is `null` because it does not exist yet.** The app is unpublished, so there is no
 * id to write, and a plausible-looking placeholder here would render a Smart App Banner
 * pointing at somebody else's app. `tests/e2e/waitlist.spec.ts` asserts the banner is
 * absent while this is null, so the number cannot be faked into existence by accident.
 */
export const APP_STORE_APP_ID: string | null = null;

export function appStoreUrl(): string | null {
  return APP_STORE_APP_ID === null ? null : `https://apps.apple.com/app/id${APP_STORE_APP_ID}`;
}

/** From the iOS project: `DEVELOPMENT_TEAM` and `PRODUCT_BUNDLE_IDENTIFIER`. */
export const APP_ID_PREFIX = 'ZTG62MH2XQ';
export const BUNDLE_ID = 'app.sonaru.Sonaru';

/**
 * Turnstile's site key is public by design - it identifies the widget, and the secret
 * that verifies its tokens lives only in the worker's environment.
 *
 * The fallback is Cloudflare's documented always-passing **test** key, which is what runs
 * in dev and in CI. There is no Cloudflare project yet (8.13), so the real key does not
 * exist either; a wrong production key is therefore a failure mode nothing before deploy
 * can catch, which is recorded in `gate-log.md` rather than left to be discovered.
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export function turnstileSiteKey(): string {
  const configured = import.meta.env['PUBLIC_TURNSTILE_SITE_KEY'];
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : TURNSTILE_TEST_SITE_KEY;
}

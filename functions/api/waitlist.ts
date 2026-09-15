/**
 * `POST /api/waitlist` - the Cloudflare Pages Function.
 *
 * All this file does is name the bindings and build the three ports. The guards live in
 * `_handler.ts` and the rules in `_core.ts`, both of which run identically under
 * `astro dev` through the mount in `astro.config.mjs`.
 *
 * **This is the one piece of 8.8 that Gate C cannot exercise**, and it is deliberately
 * the smallest piece: `astro dev` does not run Pages Functions, so what stays unverified
 * until the first deploy (8.13) is the binding names and the two lines that read the
 * request's IP. Recorded in `gate-log.md` rather than implied to be covered.
 */
import { d1Store, dnsDomains, hashIp, turnstile, type WaitlistEnv } from './_cloudflare';
import { respond } from './_handler';

interface RequestContext {
  readonly request: Request;
  readonly env: WaitlistEnv;
}

export async function onRequest(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') ?? '';

  return respond(request, {
    store: d1Store(env.WAITLIST_DB),
    challenge: turnstile(env.TURNSTILE_SECRET_KEY, ip),
    domains: dnsDomains(),
    ipHash: await hashIp(ip, env.IP_HASH_SALT),
    now: Date.now(),
  });
}

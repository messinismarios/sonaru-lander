/**
 * `POST /api/waitlist` under `astro dev`.
 *
 * **Why this exists.** `astro dev` does not run Cloudflare Pages Functions, and
 * `review-gates.md` Gate C is "the owner starts the dev server and looks at it". Without
 * this the waitlist would be the one section of the site that cannot be reviewed the way
 * every other section was - or Gate C would have to move to `wrangler pages dev` against
 * a build, losing HMR on the five states the owner has to iterate over.
 *
 * **What is real and what is not.** The guards (`_handler.ts`) and every rule
 * (`_core.ts`) are the production code, loaded from source. Only the three ports are
 * substituted: an in-memory store, a challenge that accepts any non-empty token because
 * dev runs Turnstile's always-passing test keys, and a DNS check that resolves everything
 * except one domain kept unresolvable so the state is demonstrable.
 *
 * Dev only - Vite's `apply: 'serve'` keeps it out of every build.
 */

/** Seeded so the duplicate state can be seen at Gate C without signing up twice. */
const SEEDED = 'already@sonaru.app';

/** Any address at this domain exercises the undeliverable-domain refusal. */
const UNRESOLVABLE = 'nowhere.invalid';

function devPorts(state, source) {
  return {
    ipHash: source,
    now: Date.now(),
    store: {
      countAttempts: async (ipHash, since) =>
        (state.attempts.get(ipHash) ?? []).filter((at) => at >= since).length,
      recordAttempt: async (ipHash, at) => {
        state.attempts.set(ipHash, [...(state.attempts.get(ipHash) ?? []), at]);
      },
      insert: async (row) => {
        if (state.emails.has(row.email)) return 'duplicate';
        state.emails.add(row.email);
        return 'inserted';
      },
    },
    challenge: { verify: async (token) => token.length > 0 },
    domains: { hasMx: async (domain) => domain !== UNRESOLVABLE },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export function devWaitlistEndpoint() {
  const state = { emails: new Set([SEEDED]), attempts: new Map() };

  return {
    name: 'sonaru:dev-waitlist-endpoint',
    apply: 'serve',
    configureServer(server) {
      /*
       * Every method is handled here, not just POST: letting a GET fall through to Astro
       * would answer 404 in dev and 405 in production, and a divergence between the two
       * is exactly what this mount exists to avoid.
       */
      server.middlewares.use('/api/waitlist', async (req, res) => {
        try {
          const { respond } = await server.ssrLoadModule('/functions/api/_handler.ts');
          const origin = `http://${req.headers.host ?? 'localhost:4321'}`;
          const method = req.method ?? 'GET';
          const request = new Request(`${origin}/api/waitlist`, {
            method,
            headers: { ...req.headers, origin: req.headers.origin ?? origin },
            ...(method === 'POST' ? { body: await readBody(req) } : {}),
          });

          /*
           * In production the source is `cf-connecting-ip`. Locally every caller is the
           * same loopback address, which would make one shared hourly limit for the whole
           * machine - every parallel test after the fifth would be rate-limited by the
           * ones before it. `x-dev-source` lets a caller name its own bucket; nothing but
           * this dev-only file reads it, and the production worker has no such door.
           */
          const source = req.headers['x-dev-source'] ?? req.socket.remoteAddress ?? 'dev';
          const response = await respond(request, devPorts(state, String(source)));
          res.statusCode = response.status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(await response.text());
        } catch (error) {
          /*
           * Loud rather than quiet. A dev mount that fails silently would look exactly
           * like a form bug, and the owner would be reviewing the wrong thing.
           */
          console.error('[dev-waitlist-endpoint]', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ state: 'error', reason: 'dev-mount-failed' }));
        }
      });
    },
  };
}

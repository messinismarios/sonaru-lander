/**
 * Request in, response out - the transport half of the waitlist endpoint.
 *
 * It sits between `waitlist.ts` (which knows about Cloudflare bindings and nothing else)
 * and `_core.ts` (which knows the rules and nothing about HTTP). Both the deployed worker
 * and the `astro dev` mount call this, so the guards below - method, origin, content
 * type, malformed body - are written once and are the same in the browser the owner
 * reviews in as in production.
 */
import { decide, type Ports, type Submission } from './_core';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Nothing here is cacheable, and a cached "duplicate" would be a lie to the next caller.
      'cache-control': 'no-store',
    },
  });
}

/**
 * A browser sends `Origin` on every cross-origin POST, and a same-origin `fetch` from our
 * own page sends it too. Anything that disagrees with the site's own origin is not our
 * form, whatever it claims to be.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export async function respond(request: Request, ports: Ports): Promise<Response> {
  if (request.method !== 'POST') return json({ state: 'error', reason: 'method-not-allowed' }, 405);
  if (!sameOrigin(request)) return json({ state: 'error', reason: 'bad-origin' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ state: 'error', reason: 'bad-content-type' }, 415);
  }

  let submission: Submission;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) throw new Error('not an object');
    const fields = body as Record<string, unknown>;
    submission = {
      email: fields['email'],
      locale: fields['locale'],
      token: fields['token'],
      trap: fields['trap'],
      elapsedMs: fields['elapsedMs'],
    };
  } catch {
    return json({ state: 'error', reason: 'malformed-body' }, 400);
  }

  const decision = await decide(submission, ports);

  /*
   * Duplicate answers 200, not 409: it is a designed outcome the page renders as its own
   * state, not a failure the client has to interpret. Only a refusal gets a 4xx.
   */
  return json(decision, decision.state === 'error' ? 400 : 200);
}

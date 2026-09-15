import { expect, test } from '@playwright/test';
import {
  MAX_ATTEMPTS_PER_HOUR,
  MIN_TIME_ON_FORM_MS,
  decide,
  normaliseEmail,
  type Ports,
  type Submission,
} from '../../functions/api/_core';

/**
 * The waitlist's decision code, tested without Cloudflare.
 *
 * `_core` exists precisely so this file can exist: `astro dev` does not run Pages
 * Functions, so if the rules lived in the worker they would be reachable only from a
 * deployed environment. Everything the endpoint decides is here, behind three injected
 * ports, and the worker is the adapter that supplies them.
 *
 * The stack under test is the one the owner asked for at Gate B - *"any and all required
 * methods to catch bad entries and bots"* - after `/waitlist` was allowed to require
 * JavaScript, which is what let Turnstile become mandatory rather than best-effort.
 */

interface Recorded {
  readonly emails: Set<string>;
  attempts: number;
  inserted: string[];
  verified: string[];
  mxLookups: string[];
}

function ports(overrides: Partial<Ports> = {}, recorded?: Recorded): Ports {
  const seen = recorded ?? {
    emails: new Set<string>(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  return {
    now: 1_757_000_000_000,
    ipHash: 'ip-hash-under-test',
    store: {
      countAttempts: async () => seen.attempts,
      recordAttempt: async () => {
        seen.attempts += 1;
      },
      insert: async (row) => {
        if (seen.emails.has(row.email)) return 'duplicate';
        seen.emails.add(row.email);
        seen.inserted.push(row.email);
        return 'inserted';
      },
    },
    challenge: {
      verify: async (token) => {
        seen.verified.push(token);
        return token === 'good-token';
      },
    },
    domains: {
      hasMx: async (domain) => {
        seen.mxLookups.push(domain);
        return domain !== 'no-mx-here.example';
      },
    },
    ...overrides,
  };
}

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    email: 'listener@example.com',
    locale: 'en',
    token: 'good-token',
    trap: '',
    elapsedMs: 4000,
    ...overrides,
  };
}

test('a good submission is stored once and reported as success', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission(), ports({}, seen));

  expect(result.state).toBe('success');
  expect(seen.inserted).toEqual(['listener@example.com']);
});

test('the same address a second time is duplicate, not error and not success', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const p = ports({}, seen);

  await decide(submission(), p);
  const second = await decide(submission(), p);

  expect(second.state).toBe('duplicate');
  expect(seen.inserted).toEqual(['listener@example.com']);
});

/**
 * The address is the key, so the shape it is stored in decides whether two spellings of
 * one person are one row or two. Casing and surrounding space are noise; nothing else is
 * touched, because stripping dots or plus-tags would be us deciding that two addresses a
 * mail server considers different are the same person.
 */
test('addresses are normalised to lower case and trimmed, and nothing else', () => {
  expect(normaliseEmail('  Listener@Example.COM ')).toBe('listener@example.com');
  expect(normaliseEmail('a.b+sonaru@example.com')).toBe('a.b+sonaru@example.com');
});

test('casing and stray space do not create a second row', async () => {
  const p = ports();
  await decide(submission(), p);
  const again = await decide(submission({ email: '  LISTENER@example.com  ' }), p);

  expect(again.state).toBe('duplicate');
});

/**
 * Turnstile is mandatory as of the owner's Gate B decision. Before that the plan had a
 * token-less path defended by a honeypot and a stricter rate limit; there is no such path
 * now, and this is the test that says so.
 */
test('a submission without a Turnstile token never reaches the store', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission({ token: '' }), ports({}, seen));

  expect(result.state).toBe('error');
  expect(result.reason).toBe('missing-token');
  expect(seen.inserted).toEqual([]);
});

test('a Turnstile token the server rejects is not taken on trust', async () => {
  const result = await decide(submission({ token: 'forged' }), ports());

  expect(result.state).toBe('error');
  expect(result.reason).toBe('failed-challenge');
});

/**
 * Order matters for cost, not only for correctness: the two ports that make network
 * calls are the challenge and the MX lookup, and neither should be spent on a submission
 * the cheap local checks already rejected.
 */
test('malformed input is rejected before any network call is made', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  await decide(submission({ email: 'not-an-address' }), ports({}, seen));

  expect(seen.verified).toEqual([]);
  expect(seen.mxLookups).toEqual([]);
});

for (const bad of [
  '',
  '   ',
  'no-at-sign',
  'two@@example.com',
  'trailing@example',
  'spaced address@example.com',
  'unicode@exam ple.com',
  `${'a'.repeat(250)}@example.com`,
]) {
  test(`"${bad}" is not accepted as an address`, async () => {
    const result = await decide(submission({ email: bad }), ports());
    expect(result.state).toBe('error');
  });
}

test('a domain with no MX record is caught rather than stored', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission({ email: 'someone@no-mx-here.example' }), ports({}, seen));

  expect(result.state).toBe('error');
  expect(result.reason).toBe('undeliverable-domain');
  expect(seen.inserted).toEqual([]);
});

test('a disposable domain is refused without a lookup', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission({ email: 'burner@mailinator.com' }), ports({}, seen));

  expect(result.state).toBe('error');
  expect(result.reason).toBe('disposable-domain');
  expect(seen.mxLookups).toEqual([]);
});

/**
 * The honeypot fails loudly rather than answering "success" to a submission it discards.
 * A silent success is indistinguishable from a real one to the person in front of it, and
 * the field is invisible enough that the only humans who ever trip it are the ones whose
 * password manager filled it - exactly the people who must not be told they signed up
 * when they did not.
 */
test('a filled honeypot is an error, not a lie about success', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission({ trap: 'https://spam.example' }), ports({}, seen));

  expect(result.state).toBe('error');
  expect(result.reason).toBe('honeypot');
  expect(seen.inserted).toEqual([]);
});

test('a form submitted faster than a person can read it is refused', async () => {
  const result = await decide(submission({ elapsedMs: MIN_TIME_ON_FORM_MS - 1 }), ports());

  expect(result.state).toBe('error');
  expect(result.reason).toBe('too-fast');
});

test('a missing or nonsensical elapsed time is treated as too fast, not as valid', async () => {
  for (const elapsed of [undefined, null, -1, 'ages', Number.NaN]) {
    const result = await decide(
      submission({ elapsedMs: elapsed as Submission['elapsedMs'] }),
      ports(),
    );
    expect(result.reason).toBe('too-fast');
  }
});

test('an address is rate-limited once the hour has had enough attempts from one source', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: MAX_ATTEMPTS_PER_HOUR,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  const result = await decide(submission(), ports({}, seen));

  expect(result.state).toBe('error');
  expect(result.reason).toBe('rate-limited');
  expect(seen.inserted).toEqual([]);
});

test('the attempt is recorded even when the submission is refused, or the limit never bites', async () => {
  const seen: Recorded = {
    emails: new Set(),
    attempts: 0,
    inserted: [],
    verified: [],
    mxLookups: [],
  };
  await decide(submission({ email: 'not-an-address' }), ports({}, seen));

  expect(seen.attempts).toBe(1);
});

/**
 * The raw IP never enters this module, let alone the database. What arrives is already a
 * salted hash, which is what lets the site keep counting attempts per source without
 * holding an identifier it would then have to disclose.
 */
test('what is stored carries the hashed source, the locale, and no address for the visitor', async () => {
  let stored: Record<string, unknown> | undefined;
  const p = ports({
    store: {
      countAttempts: async () => 0,
      recordAttempt: async () => {},
      insert: async (row) => {
        stored = { ...row };
        return 'inserted';
      },
    },
  });

  await decide(submission({ locale: 'es' }), p);

  expect(stored).toMatchObject({
    email: 'listener@example.com',
    locale: 'es',
    ipHash: 'ip-hash-under-test',
    createdAt: 1_757_000_000_000,
  });
  expect(Object.keys(stored ?? {}).sort()).toEqual(['createdAt', 'email', 'ipHash', 'locale']);
});

/**
 * A storage failure is the one outcome that is genuinely our fault, and it must not be
 * dressed up as anything else - least of all as a success the person will wait on.
 */
test('a store that throws surfaces as an error, not as a success', async () => {
  const p = ports({
    store: {
      countAttempts: async () => 0,
      recordAttempt: async () => {},
      insert: async () => {
        throw new Error('D1 unavailable');
      },
    },
  });

  const result = await decide(submission(), p);

  expect(result.state).toBe('error');
  expect(result.reason).toBe('storage-failed');
});

test('an unknown locale falls back to en rather than being stored as given', async () => {
  let stored: Record<string, unknown> | undefined;
  const p = ports({
    store: {
      countAttempts: async () => 0,
      recordAttempt: async () => {},
      insert: async (row) => {
        stored = { ...row };
        return 'inserted';
      },
    },
  });

  await decide(submission({ locale: 'klingon' }), p);

  expect(stored?.['locale']).toBe('en');
});

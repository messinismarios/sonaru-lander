/**
 * The waitlist's decision code - everything the endpoint decides, and nothing about
 * where it runs.
 *
 * **Why this file is separate from the worker.** `astro dev` does not execute Cloudflare
 * Pages Functions, so rules written inside the worker would be reachable only from a
 * deployed environment: unrunnable at Gate C and untestable in CI. `_core` therefore
 * holds the rules behind three injected ports, and two thin adapters supply them - the
 * Pages Function in production, a dev middleware under `astro dev`. Both call the code
 * below, so the endpoint the owner reviews locally behaves as the deployed one does.
 *
 * **Why the checks are this thorough.** At 8.8's Gate B the owner allowed `/waitlist` to
 * require JavaScript - *"use any and all required methods to catch bad entries and
 * bots"* - which is what makes Turnstile mandatory rather than best-effort. Before that
 * decision a token-less path had to exist and had to be defended with weaker tools. It
 * does not exist now, and `missing-token` is a hard refusal.
 *
 * The checks run cheapest-first, and the two ports that cost a network round trip - the
 * challenge and the MX lookup - are the last two things reached.
 */

/** How long a person must plausibly have spent on the form. Forgeable by design. */
export const MIN_TIME_ON_FORM_MS = 1500;

/** Attempts allowed from one hashed source per hour, successful or not. */
export const MAX_ATTEMPTS_PER_HOUR = 5;

const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

/** RFC 5321's limit on a path. Anything longer is not an address someone typed. */
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;

const LOCALES = ['en', 'es'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * Deliberately conservative: one `@`, no whitespace or address-list punctuation in the
 * local part, and a domain of dot-separated LDH labels with a real TLD. It rejects
 * addresses that are technically legal (quoted local parts, bare-hostname domains) and
 * that is the intended trade - those are never what a person types into a waitlist, and
 * every one we accept is one we would later fail to deliver to.
 */
const EMAIL = /^[^\s@,;:<>"'()[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/**
 * Not a blocklist anyone maintains - the long ones are thousands of entries, go stale,
 * and start refusing real people. These are the handful common enough to be worth one
 * string comparison, and the MX check behind them catches the invented rest.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'yopmail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
]);

export type WaitlistState = 'success' | 'duplicate' | 'error';

export type Rejection =
  | 'honeypot'
  | 'too-fast'
  | 'rate-limited'
  | 'missing-token'
  | 'failed-challenge'
  | 'malformed-email'
  | 'disposable-domain'
  | 'undeliverable-domain'
  | 'storage-failed';

/** What arrives from the client. Every field is untrusted, hence `unknown`. */
export interface Submission {
  readonly email: unknown;
  readonly locale: unknown;
  readonly token: unknown;
  /** The honeypot. A person never fills this; a naive bot fills everything. */
  readonly trap: unknown;
  /** Milliseconds the client says the form was on screen before submitting. */
  readonly elapsedMs: unknown;
}

export interface SignupRow {
  readonly email: string;
  readonly locale: Locale;
  readonly ipHash: string;
  readonly createdAt: number;
}

export interface SignupStore {
  countAttempts(ipHash: string, since: number): Promise<number>;
  recordAttempt(ipHash: string, at: number): Promise<void>;
  insert(row: SignupRow): Promise<'inserted' | 'duplicate'>;
}

export interface ChallengeVerifier {
  /*
   * Takes only the token. Turnstile's `remoteip` is genuinely useful to it, but the raw
   * address is the adapter's business: it never crosses into this module, which is what
   * makes "the IP is not stored" checkable by reading one file rather than four.
   */
  verify(token: string): Promise<boolean>;
}

export interface DomainChecker {
  hasMx(domain: string): Promise<boolean>;
}

export interface Ports {
  readonly store: SignupStore;
  readonly challenge: ChallengeVerifier;
  readonly domains: DomainChecker;
  /** A salted hash of the caller's IP. The raw address never reaches this module. */
  readonly ipHash: string;
  readonly now: number;
}

export interface Decision {
  readonly state: WaitlistState;
  readonly reason?: Rejection;
}

/**
 * Case and surrounding space are noise and are removed. Nothing else is: stripping dots
 * or plus-tags would be us deciding that two addresses a mail server treats as different
 * belong to one person.
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function refuse(reason: Rejection): Decision {
  return { state: 'error', reason };
}

function asLocale(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1);
}

function isWellFormed(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  if (email.indexOf('@') !== email.lastIndexOf('@')) return false;
  if (email.slice(0, email.indexOf('@')).length > MAX_LOCAL_LENGTH) return false;
  return EMAIL.test(email);
}

export async function decide(submission: Submission, ports: Ports): Promise<Decision> {
  const { store, challenge, domains, ipHash, now } = ports;

  /*
   * Accounting first, so that a refused submission still costs its source an attempt.
   * A limiter that only counts successes is a limiter a bot never meets.
   */
  const recent = await store.countAttempts(ipHash, now - ATTEMPT_WINDOW_MS);
  await store.recordAttempt(ipHash, now);
  if (recent >= MAX_ATTEMPTS_PER_HOUR) return refuse('rate-limited');

  if (typeof submission.trap === 'string' && submission.trap.trim().length > 0) {
    /*
     * Refused visibly rather than answered with a false success. Telling a bot it
     * succeeded is the conventional move, but the only humans who ever trip this field
     * are the ones whose password manager filled it - and those are exactly the people
     * who must not be told they joined a list they are not on.
     */
    return refuse('honeypot');
  }

  const elapsed = typeof submission.elapsedMs === 'number' ? submission.elapsedMs : Number.NaN;
  if (!Number.isFinite(elapsed) || elapsed < MIN_TIME_ON_FORM_MS) return refuse('too-fast');

  const token = typeof submission.token === 'string' ? submission.token.trim() : '';
  if (token.length === 0) return refuse('missing-token');

  const email = normaliseEmail(typeof submission.email === 'string' ? submission.email : '');
  if (!isWellFormed(email)) return refuse('malformed-email');

  const domain = domainOf(email);
  if (DISPOSABLE_DOMAINS.has(domain)) return refuse('disposable-domain');

  // Everything above is local. Below this line each check costs a round trip.
  if (!(await challenge.verify(token))) return refuse('failed-challenge');
  if (!(await domains.hasMx(domain))) return refuse('undeliverable-domain');

  try {
    const outcome = await store.insert({
      email,
      locale: asLocale(submission.locale),
      ipHash,
      createdAt: now,
    });
    return { state: outcome === 'duplicate' ? 'duplicate' : 'success' };
  } catch {
    /*
     * The one outcome that is our fault rather than the caller's. It is reported as an
     * error and never as a success, because a person told "you're on the list" when the
     * write failed will never find out otherwise.
     */
    return refuse('storage-failed');
  }
}

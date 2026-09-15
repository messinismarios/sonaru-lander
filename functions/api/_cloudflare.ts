/**
 * The Cloudflare side of the waitlist: bindings, and the three ports `_core` asks for.
 *
 * Nothing here decides anything. If a rule is in this file it is in the wrong file - the
 * point of the split is that `tests/unit/waitlist-core.spec.ts` can exercise every rule
 * without a worker runtime, and that what runs at Gate C under `astro dev` runs the same
 * rules as production.
 *
 * **The binding types are hand-written.** `@cloudflare/workers-types` is not a dependency
 * yet because `wrangler` is not either - deployment is 8.13. These are the three shapes
 * this file actually touches; the package replaces them when 8.13 brings the toolchain.
 */
import type { ChallengeVerifier, DomainChecker, SignupRow, SignupStore } from './_core';

interface D1PreparedStatement {
  bind(...values: readonly (string | number | null)[]): D1PreparedStatement;
  first<T>(column: string): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface WaitlistEnv {
  readonly WAITLIST_DB: D1Database;
  readonly TURNSTILE_SECRET_KEY: string;
  /**
   * Rotating this salt makes every stored hash unlinkable to any future address, which is
   * the property that lets us keep rate-limiting without keeping identifiers.
   */
  readonly IP_HASH_SALT: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DOH_URL = 'https://cloudflare-dns.com/dns-query';

/** Numeric DNS record types, from RFC 1035. */
const MX = 15;
const A = 1;

/**
 * A salted SHA-256 of the caller's address, computed at the edge and never stored beside
 * anything that would reverse it. The raw IP does not leave this function.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function d1Store(db: D1Database): SignupStore {
  return {
    async countAttempts(ipHash, since) {
      const row = await db
        .prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip_hash = ?1 AND created_at >= ?2')
        .bind(ipHash, since)
        .first<number>('n');
      return row ?? 0;
    },

    async recordAttempt(ipHash, at) {
      await db
        .prepare('INSERT INTO attempts (ip_hash, created_at) VALUES (?1, ?2)')
        .bind(ipHash, at)
        .run();
    },

    /*
     * The duplicate answer comes from the UNIQUE constraint rather than from a preceding
     * SELECT: a read-then-write races itself, and this is the one state the design treats
     * as distinct from both success and failure, so it has to be right.
     */
    async insert(row: SignupRow) {
      const inserted = await db
        .prepare(
          `INSERT INTO signups (email, locale, ip_hash, created_at)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT (email) DO NOTHING
           RETURNING email`,
        )
        .bind(row.email, row.locale, row.ipHash, row.createdAt)
        .first<string>('email');
      return inserted === null ? 'duplicate' : 'inserted';
    },
  };
}

export function turnstile(secret: string, remoteIp: string): ChallengeVerifier {
  return {
    async verify(token) {
      const body = new FormData();
      body.append('secret', secret);
      body.append('response', token);
      body.append('remoteip', remoteIp);

      const response = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
      if (!response.ok) return false;

      const outcome: unknown = await response.json();
      return (
        typeof outcome === 'object' &&
        outcome !== null &&
        (outcome as { success?: unknown }).success === true
      );
    },
  };
}

async function resolves(domain: string, type: number): Promise<boolean> {
  const url = `${DOH_URL}?name=${encodeURIComponent(domain)}&type=${type}`;
  const response = await fetch(url, { headers: { accept: 'application/dns-json' } });
  if (!response.ok) throw new Error(`DNS lookup failed: ${response.status}`);

  const answer: unknown = await response.json();
  const records = (answer as { Answer?: readonly { type?: number }[] }).Answer ?? [];
  return records.some((record) => record.type === type);
}

/**
 * An MX record, or an A record as the fallback - a domain with only an address record
 * still accepts mail by RFC 5321's implicit-MX rule, and rejecting those would turn a
 * spam control into a bug report from a real person.
 *
 * **It fails open.** A DNS hiccup returns "deliverable" rather than refusing a signup we
 * have no evidence against; the submission has already cleared Turnstile by the time this
 * runs, so the thing failing open is the weakest check in the stack rather than its gate.
 */
export function dnsDomains(): DomainChecker {
  return {
    async hasMx(domain) {
      try {
        return (await resolves(domain, MX)) || (await resolves(domain, A));
      } catch {
        return true;
      }
    },
  };
}

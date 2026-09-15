import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `public/_headers` and the build agree with each other - phases.md 8.12b.
 *
 * **What this can and cannot do.** No header here is real until Cloudflare Pages serves it,
 * which is the same class of thing as the Turnstile secret and the 404 status code, and 8.13
 * carries the item that reads them back off the live site. What a build *can* check is
 * internal consistency: that the policy still describes the bytes being shipped. Every
 * assertion below is of that kind, and each one has a failure it was written for.
 */

const ROOT = new URL('../../', import.meta.url);
const DIST = new URL('dist/', ROOT);

/**
 * **`dist/_headers`, not `public/_headers`** - the built policy is the deployed one.
 *
 * `public/_headers` ships a `__INLINE_SCRIPT_HASHES__` placeholder that `scripts/csp-hashes.mjs`
 * fills in at `astro:build:done` with the hash of every inline script the build emitted. Reading
 * the template would test a policy nobody is served, and would miss the whole failure this
 * file exists for.
 */
const headers = readFileSync(fileURLToPath(new URL('_headers', DIST)), 'utf8');

/** The `Header-Name: value` lines, comments and the path pattern stripped. */
function header(name: string): string {
  const line = headers
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  if (!line) throw new Error(`_headers has no ${name}`);
  return line.slice(name.length + 1).trim();
}

function builtFiles(ext: string, dir = DIST): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...builtFiles(ext, new URL(`${entry.name}/`, dir)));
    else if (entry.name.endsWith(ext)) out.push(fileURLToPath(new URL(entry.name, dir)));
  }
  return out;
}

test('the CSP was completed at build time, and ships no placeholder', () => {
  /*
   * If the build hook does not run, the placeholder ships and every inline script is blocked -
   * loud and wrong rather than quiet and wrong, which is the failure direction to prefer. This
   * asserts it never gets that far.
   */
  expect(headers, 'the csp-hashes build hook did not run').not.toContain(
    '__INLINE_SCRIPT_HASHES__',
  );
});

test('every inline script the build emits is allowed by hash', () => {
  /*
   * **The assertion that caught this unit's own Gate B being wrong.** That gate recorded "not
   * one inline script in the build", measured on `dist/index.html` alone. There are four, on
   * the two island routes, because Astro inlines its hydration runtime. Shipped as planned,
   * `/pricing`'s plan toggle and `/waitlist`'s entire form would have been dead in production
   * and nowhere else.
   */
  const csp = header('Content-Security-Policy');
  const missing: string[] = [];
  for (const file of builtFiles('.html')) {
    const html = readFileSync(file, 'utf8').replace(
      /<script[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/g,
      '',
    );
    for (const [, body] of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (!body?.trim()) continue;
      const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`;
      if (!csp.includes(hash)) missing.push(`${file}: ${hash}`);
    }
  }
  expect(missing, 'inline scripts the CSP will block').toEqual([]);
});

test('every security header the acceptance criteria names is present', () => {
  for (const name of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Content-Type-Options',
  ]) {
    expect(() => header(name), name).not.toThrow();
  }
});

test('the CSP hash still matches the inline style the build emits', () => {
  /*
   * **The assertion this file exists for.** The single inline `<style>` in the site is
   * Astro's own island rule, and the CSP allows it by hash. An Astro upgrade that changes
   * those 75 bytes would otherwise ship two pages - `/pricing` and `/waitlist` - whose
   * islands are unstyled, with no error anywhere except a browser console nobody is reading.
   */
  const blocks = new Set<string>();
  for (const file of builtFiles('.html')) {
    for (const [, css] of readFileSync(file, 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      blocks.add(css ?? '');
    }
  }

  const csp = header('Content-Security-Policy');
  for (const css of blocks) {
    const hash = `sha256-${createHash('sha256').update(css).digest('base64')}`;
    expect(csp, `an inline <style> the CSP does not allow: ${css.slice(0, 60)}`).toContain(hash);
  }

  /*
   * And the reverse: a hash left behind for a block nothing emits any more is dead policy.
   *
   * **Scoped to `style-src`**, because the CSP also carries script hashes now and the first
   * version of this read every `sha256-` in the whole header - so it reported the three
   * inline-script hashes as styles nothing emits. Each directive owns its own hashes.
   */
  const styleSrc =
    csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('style-src ')) ?? '';
  for (const [, hash] of styleSrc.matchAll(/'(sha256-[^']+)'/g)) {
    const live = [...blocks].some(
      (css) => `sha256-${createHash('sha256').update(css).digest('base64')}` === hash,
    );
    expect(live, `${hash} allows an inline style nothing emits`).toBe(true);
  }
});

test('no script or style element may be inlined without a hash', () => {
  const csp = header('Content-Security-Policy');
  const directive = (name: string) =>
    csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? '';

  expect(directive('script-src'), 'script-src').not.toContain("'unsafe-inline'");
  expect(directive('script-src'), 'script-src').not.toContain("'unsafe-eval'");
  /* `style-src-attr` is the one documented allowance - owner, 8.12b Gate B - and it is a
   * different directive, so this assertion stays absolute for the element one. */
  expect(directive('style-src'), 'style-src').not.toContain("'unsafe-inline'");

  /* Inline scripts are allowed by hash instead - see the test above. */
});

test('every external origin the build references is allowed by the CSP', () => {
  /*
   * The guard against the quiet version of this failure: somebody adds a third-party embed,
   * it works in `astro dev` where no CSP is served, and it is blocked in production.
   * `schema.org` is excluded because it is a JSON-LD `@context` string and is never fetched.
   */
  const csp = header('Content-Security-Policy');
  const origins = new Set<string>();

  /*
   * **Only what is actually fetched.** The first version of this scanned every URL in every
   * built file and reported `tailwindcss.com`, `svelte.dev` and `gsap.com` - all of them
   * inside library banner comments in the bundles, none of them a request. A guard that
   * reports a comment teaches people to add exceptions to it.
   *
   * So: `src` on any element, `href` on `<link>`, and `url()` in CSS. Those are requests; a
   * string in a comment is not - and neither is an `<a href>`, which is a navigation CSP does
   * not govern. That distinction arrived with the footer's MusicBrainz credit (2026-09-15),
   * the site's first outbound link, which the earlier `src|href` pattern reported as an
   * origin missing from the policy.
   */
  const FETCHED = [
    /\ssrc="(https?:\/\/[^"]+)"/gi,
    /<link\s[^>]*href="(https?:\/\/[^"]+)"/gi,
    /url\(["']?(https?:\/\/[^"')]+)/gi,
  ];
  for (const file of [...builtFiles('.html'), ...builtFiles('.css')]) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of FETCHED) {
      for (const [, url] of text.matchAll(pattern)) {
        const host = new URL(url ?? '').hostname.toLowerCase();
        if (host !== 'sonaru.app') origins.add(host);
      }
    }
  }

  const unlisted = [...origins].filter((origin) => !csp.includes(origin));
  expect(unlisted, 'referenced by the build and absent from the CSP').toEqual([]);
});

/** The header lines under one exact path pattern, up to the next unindented line. */
function rule(path: string): string {
  const lines = headers.split('\n');
  const start = lines.indexOf(path);
  if (start === -1) throw new Error(`_headers has no ${path} rule`);
  const end = lines.findIndex((l, i) => i > start && l !== '' && !/^\s/.test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

test('hashed assets are cached for a year, and unhashed fonts are not', () => {
  /*
   * SEO audit M2. `immutable` is only true of a file whose name changes with its bytes, which
   * Vite guarantees under `_astro/` and nothing guarantees under `fonts/`.
   */
  expect(rule('/_astro/*')).toContain('Cache-Control: public, max-age=31536000, immutable');
  expect(headers).not.toMatch(/^\/fonts\//m);
});

test('the app site association is served as JSON', () => {
  /* SEO audit L3: Pages served the extensionless file as `application/octet-stream`. */
  expect(rule('/.well-known/apple-app-site-association')).toContain(
    'Content-Type: application/json',
  );
});

test('HSTS is two years and is not preloaded', () => {
  /*
   * `includeSubDomains` binds `api.sonaru.app`; `preload` is a submission to a browser-vendor
   * list rather than a header we control, and is deliberately absent - 8.12b's Gate B.
   */
  const hsts = header('Strict-Transport-Security');
  expect(hsts).toContain('max-age=63072000');
  expect(hsts).toContain('includeSubDomains');
  expect(hsts, 'preload is not ours to undo').not.toContain('preload');
});

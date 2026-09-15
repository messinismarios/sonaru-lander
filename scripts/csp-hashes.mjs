import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Substitutes real `sha256-` hashes into the CSP - phases.md 8.12b.
 *
 * **Why this exists, and it is a correction to 8.12b's own Gate B.** That gate stated there
 * was not one inline `<script>` in the build, and the measurement behind it only looked at
 * `dist/index.html`. There are four, on the two island routes: Astro inlines its hydration
 * runtime - the `astro-island` custom element, 4,380 bytes, plus each `client:` directive's
 * loader - and `assetsInlineLimit: 0` does not touch them, because they are Astro's own
 * emission rather than a bundled chunk. A `script-src 'self'` shipped as planned would have
 * blocked all four, and the symptom would have been `/pricing`'s plan toggle dead and
 * `/waitlist`'s form absent, in production only, with nothing failing at build time. The
 * guard in `tests/unit/security-headers.spec.ts` caught it; nothing else would have.
 *
 * **Hashes rather than `'unsafe-inline'`**, because the alternative is to give up the one
 * thing `acceptance-criteria.md` §10 actually asks for. They are computed from the shipped
 * bytes on every build, so a new island, a removed one, or an Astro upgrade all update the
 * policy without anybody remembering this file exists.
 *
 * **`public/_headers` carries the placeholder and this rewrites `dist/_headers`.** The file
 * stays readable in one place, at the path Pages expects. If this hook ever fails to run, the
 * placeholder ships and every inline script is blocked - which is loud and wrong rather than
 * quiet and wrong, and is the failure direction to prefer. The guard asserts no placeholder
 * survives into `dist/`.
 */
const PLACEHOLDER = '__INLINE_SCRIPT_HASHES__';

/** JSON-LD is data, not script: the CSP never has to allow it and hashing it would be noise. */
const LD_JSON = /<script[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/g;
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

export function cspHashes() {
  return {
    name: 'sonaru:csp-hashes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const hashes = new Set();

        for (const file of await htmlFiles(root)) {
          const html = (await readFile(file, 'utf8')).replace(LD_JSON, '');
          for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
            if (body?.trim()) {
              hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
            }
          }
        }

        const headers = `${root}/_headers`;
        const source = await readFile(headers, 'utf8');
        if (!source.includes(PLACEHOLDER)) {
          throw new Error(`_headers has no ${PLACEHOLDER} - the CSP cannot be completed.`);
        }

        await writeFile(headers, source.replace(PLACEHOLDER, [...hashes].sort().join(' ')));
        logger.info(`CSP: ${hashes.size} inline script hash(es) written into _headers`);
      },
    },
  };
}

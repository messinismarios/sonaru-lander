import { spawnSync } from 'node:child_process';
import vnu from 'vnu-jar';

/**
 * Validates every page in `dist/` with the Nu HTML Checker - SEO audit H7 (2026-09-15),
 * `acceptance-criteria.md` §7 "HTML validates".
 *
 *     npm run build && npm run validate:html
 *
 * **Why it exists.** The build was putting each page's module script after `</html>`, and
 * the validator treats that as fatal and stops reading the page - so for as long as nobody
 * ran it, nothing else on `/`, `/pricing` or `/waitlist` was being checked at all. A browser
 * recovers from all of it silently, which is exactly why only a validator finds it.
 *
 * **It needs Java 11 or newer**, because `vnu.jar` is a Java program. CI's Ubuntu runner
 * has one; on a Mac, `brew install openjdk@17`. It is part of `npm run verify` by the
 * owner's choice (2026-09-15), so an old Java fails `verify` with the message below rather
 * than with a JVM stack trace.
 *
 * **Two messages are filtered, each on purpose, and nothing else is.**
 */
const FILTERED = [
  /*
   * `Compare.astro`'s explicit table roles (8.12a). Below 668px the table is restacked with
   * `display: block`, which removes it from the accessibility tree; writing out each part's
   * implicit role is what keeps a screen reader on a table. The validator calls the roles
   * redundant, which they are - above the breakpoint. The owner kept them over the validator.
   */
  'The “role” attribute must not be used on a “(?:td|th|tr)” element which has a “table” ancestor',
  /*
   * Astro's own island rule, `astro-island,astro-slot,astro-static-slot{display:contents}`,
   * which it emits inline at the first hydrated island rather than in `<head>`. Framework
   * output with no option to move it; `public/_headers` already hashes it for the CSP.
   * **The prefix only**: vnu does not match its own full sentence for this message (measured
   * against `dist/pricing.html` - the whole-sentence pattern filtered nothing).
   */
  'Element “style” not allowed',
];

const probe = spawnSync('java', ['-version'], { encoding: 'utf8' });
const version = /version "(\d+)(?:\.(\d+))?/.exec(probe.stderr ?? '');
const major =
  version === null ? 0 : Number(version[1]) === 1 ? Number(version[2]) : Number(version[1]);
if (probe.error !== undefined || major < 11) {
  process.stderr.write(
    `validate:html needs Java 11 or newer on PATH (found ${version?.[0] ?? 'none'}).\n` +
      'On macOS: brew install openjdk@17, then follow the caveat it prints to put it on PATH.\n',
  );
  process.exit(1);
}

const result = spawnSync(
  'java',
  [
    '-jar',
    String(vnu),
    '--skip-non-html',
    '--errors-only',
    '--filterpattern',
    `.*(?:${FILTERED.join('|')}).*`,
    'dist',
  ],
  { stdio: 'inherit' },
);

if (result.status === 0) process.stdout.write('dist/ validates.\n');
process.exit(result.status ?? 1);

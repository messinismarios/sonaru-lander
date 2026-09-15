/**
 * Contrast validator - phases.md 8.1, acceptance-criteria.md §4.
 *
 * Reads the hex tokens out of src/styles/tokens.css and checks every pairing this project
 * actually claims to use against WCAG 2.2 AA. Exits non-zero on a failure, so CI blocks a
 * palette change that quietly breaks legibility.
 *
 * **The table moved to `src/lib/contrast.ts` at 8.10c**, because `/brand` publishes the
 * colour system's usage rules and their measured ratios and there must be exactly one
 * table - a document that computes its own numbers beside a validator computing different
 * ones is worse than a document with no numbers. See that file for what the pairings are
 * and why they are declared rather than crossed.
 *
 * **`parseTokens` below stays here, and that is the point of the split.** A validator that
 * imports its subject's helper can agree with it about the wrong thing: `src/lib/tokens.ts`
 * is the *page's* reading of the stylesheet, this is the validator's, and they are written
 * differently on purpose. What must not be duplicated is the claim; what must not be
 * shared is the reading.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { score, PAIRINGS } from '../src/lib/contrast.ts';
import { brand } from '../copy/en/brand.ts';

/*
 * The report's words, read from the English catalogue rather than from `contrast.ts`,
 * which lost them at 8.11a. **English specifically, and not the visitor's locale**: this
 * is a build log in a developer's terminal, not a page.
 *
 * **The namespace file directly, not `copy/en/index.ts`.** Node's ESM resolver wants
 * an extension on every specifier and the catalogue's own imports are extensionless, as
 * Vite prefers - so the assembler is not importable here while one leaf of it is. The
 * catalogue stays free of anything only a bundler can resolve (no `astro:` modules, no
 * `?raw`) precisely so this line can exist; that is the same constraint
 * `src/data/press.ts` records for itself, and the reason this script can check a table
 * that a page renders.
 */
const { levels, uses } = brand.contrast;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} css @returns {Map<string, string>} */
function parseTokens(css) {
  const tokens = new Map();
  for (const [, name, hex] of css.matchAll(/--(?:color-)?([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(name, hex.toLowerCase());
  }
  return tokens;
}

const tokens = parseTokens(readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8'));

/*
 * `score` throws on a pairing naming a token the stylesheet no longer declares, which is
 * the failure that would otherwise look like success - a usage rule for a colour that has
 * been deleted. Caught here so the exit code and the message are the validator's.
 */
let scored;
try {
  scored = score(tokens);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const failures = [];
const rows = [];

for (const pairing of scored) {
  if (!pairing.passes) {
    failures.push(
      `${pairing.fg} on ${pairing.bg} - ${pairing.ratio.toFixed(2)}:1, ` +
        `needs ${pairing.min}:1 (${uses[pairing.id]})`,
    );
  }
  rows.push(
    `${pairing.passes ? 'ok  ' : 'FAIL'}  ${`${pairing.fg} on ${pairing.bg}`.padEnd(28)} ` +
      `${pairing.ratio.toFixed(2).padStart(6)}:1  (min ${pairing.min})  ` +
      `${uses[pairing.id]} [${levels[pairing.level]}]`,
  );
}

process.stdout.write(`${rows.join('\n')}\n`);

if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} contrast failure(s):\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`\nAll ${PAIRINGS.length} declared pairings meet WCAG 2.2 AA.\n`);

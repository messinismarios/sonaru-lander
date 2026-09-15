/**
 * The declared contrast pairings, and the WCAG maths that scores them.
 *
 * **This was `scripts/check-contrast.mjs`'s private table until 8.10c.** It moved because
 * `/brand` publishes the colour system's usage rules and their measured ratios, and a
 * document that computes its own numbers beside a validator that computes different ones
 * is worse than a document with no numbers at all. There is one table and one ratio
 * function, so **the page cannot print a ratio CI does not enforce**.
 *
 * **The validator keeps its own hex parser, deliberately.** Its header makes the argument
 * and the argument is right: a validator that imports its subject's helper can agree with
 * it about the wrong thing. What must stay independent is the *reading of the stylesheet*
 * - `src/lib/tokens.ts` is the page's parser and `parseTokens` in the script is the
 * validator's, and they are written differently on purpose. What must **not** be
 * duplicated is the table of what we claim, which is this file.
 *
 * **The caller supplies the token map**, for the reason `src/lib/tokens.ts` documents at
 * length: this module has two consumers in two environments, and reading a file here
 * through `import.meta.url` works in `astro dev` and is `ENOENT` in a production build.
 *
 * Adding a token to `tokens.css` means declaring how it is used, here. That is the whole
 * point of scoring declared pairings rather than the cross-product: `design-system.md` §2
 * assigns every token a job, and `--plum-900` is the brand *ground* and is never text, so
 * scoring it as text would fail by design and teach us nothing.
 */
import type { Catalogue } from '../i18n';

/**
 * What a pairing has to clear, and why.
 *
 * **`level` rather than a bare number, which is 8.10c's one change to the table.** Two
 * pairings score `plum-500 on ink-950` at the same 3.0 - one is the primary button's
 * border under 1.4.11, the other is display-size accent type under 1.4.3 - and with only
 * the minimum recorded they are indistinguishable rows that look like a duplicate. The
 * page has to label them, so the distinction is declared here instead of guessed from a
 * number that two rules happen to share.
 */
export type Level = 'AA' | 'AA-large' | 'non-text' | 'tracked';

/** WCAG 2.2 thresholds. Large = >=24px, or >=18.66px bold. */
export const MINIMUM: Readonly<Record<Level, number>> = {
  /** 1.4.3 - body text. */
  AA: 4.5,
  /** 1.4.3 - large text. */
  'AA-large': 3.0,
  /** 1.4.11 - UI components and meaningful graphics. */
  'non-text': 3.0,
  /**
   * No minimum. A pairing that is decoration rather than information, recorded so that a
   * change to it is still visible in the validator's output.
   *
   * **This is the row 8.10b's accessibility defect came out of.** `--ink-700` on the
   * ground is about 1.2:1, and `/press`'s swatch labels were first set in it - invisible,
   * and invisible in a way the gate that exists for it cannot fail, because it never
   * scores a pairing nobody called text. `tracked` means *this is not text*, so anything
   * reading as text on this list is a bug.
   */
  tracked: 1.0,
};

/**
 * A pairing's identity, and the key into `brand.contrast.uses` - where its one-line usage
 * rule now lives, along with the level labels this file used to carry (8.11a).
 *
 * It needs an id because `fg`/`bg` is not unique: `plum-500` on `ink-950` appears twice,
 * once as a non-text border and once as display-size accent type. They are two different
 * requirements with two different minimums, and a key built from the colours would
 * collapse them into one.
 */
export interface Pairing {
  readonly id: keyof Catalogue['brand']['contrast']['uses'];
  /** Token name without the `--color-` prefix, as `tokens.css` declares it. */
  readonly fg: string;
  readonly bg: string;
  readonly level: Level;
}

/**
 * Every pairing this project actually claims to use.
 *
 * The order is the order `/brand` prints and the order the validator logs: text on the
 * flat grounds, then interactive colour, then the non-text pairings, then the gradient's
 * two ends.
 */
export const PAIRINGS: readonly Pairing[] = [
  { id: 'primary-on-ground', fg: 'white', bg: 'ink-950', level: 'AA' },
  { id: 'primary-on-raised', fg: 'white', bg: 'ink-900', level: 'AA' },
  { id: 'primary-on-inset', fg: 'white', bg: 'ink-800', level: 'AA' },
  { id: 'primary-on-brand', fg: 'white', bg: 'plum-900', level: 'AA' },
  { id: 'primary-on-wash', fg: 'white', bg: 'plum-800', level: 'AA' },
  { id: 'secondary-on-ground', fg: 'mute-200', bg: 'ink-950', level: 'AA' },
  { id: 'secondary-on-raised', fg: 'mute-200', bg: 'ink-900', level: 'AA' },
  { id: 'secondary-on-brand', fg: 'mute-200', bg: 'plum-900', level: 'AA' },
  { id: 'muted-on-ground', fg: 'mute-400', bg: 'ink-950', level: 'AA' },
  { id: 'muted-on-raised', fg: 'mute-400', bg: 'ink-900', level: 'AA' },
  { id: 'link-on-ground', fg: 'plum-300', bg: 'ink-950', level: 'AA' },
  { id: 'link-on-raised', fg: 'plum-300', bg: 'ink-900', level: 'AA' },
  { id: 'interactive-on-ground', fg: 'plum-400', bg: 'ink-950', level: 'AA' },
  { id: 'button-label', fg: 'white', bg: 'plum-700', level: 'AA' },
  { id: 'button-label-hover', fg: 'white', bg: 'plum-600', level: 'AA' },
  { id: 'button-border-on-ground', fg: 'plum-500', bg: 'ink-950', level: 'non-text' },
  { id: 'button-border-on-top-stop', fg: 'plum-500', bg: 'plum-900', level: 'non-text' },
  { id: 'display-accent', fg: 'plum-500', bg: 'ink-950', level: 'AA-large' },
  { id: 'focus-indicator', fg: 'plum-400', bg: 'ink-950', level: 'non-text' },
  { id: 'divider', fg: 'ink-700', bg: 'ink-950', level: 'tracked' },
  { id: 'primary-on-mid-stop', fg: 'white', bg: 'ground-mid', level: 'AA' },
  { id: 'secondary-on-mid-stop', fg: 'mute-200', bg: 'ground-mid', level: 'AA' },
  { id: 'muted-on-mid-stop', fg: 'mute-400', bg: 'ground-mid', level: 'AA' },
  { id: 'muted-on-top-stop', fg: 'mute-400', bg: 'plum-900', level: 'AA' },
  { id: 'link-on-top-stop', fg: 'plum-300', bg: 'plum-900', level: 'AA' },
  { id: 'interactive-on-top-stop', fg: 'plum-400', bg: 'plum-900', level: 'AA' },
];

/** WCAG relative luminance of a `#rrggbb` string. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`Could not read channels from ${hex}`);
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two `#rrggbb` strings, 1–21. */
export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  if (hi === undefined || lo === undefined) throw new Error('unreachable');
  return (hi + 0.05) / (lo + 0.05);
}

/** A pairing with its measured ratio and whether it clears its level. */
export interface Scored extends Pairing {
  readonly min: number;
  readonly fgHex: string;
  readonly bgHex: string;
  readonly ratio: number;
  readonly passes: boolean;
}

/**
 * Score every declared pairing against a token map.
 *
 * Throws on a pairing naming a token the stylesheet does not declare, rather than
 * skipping it: a usage rule for a colour that no longer exists is the one failure this
 * table can have that looks like success.
 */
export function score(tokens: ReadonlyMap<string, string>): readonly Scored[] {
  return PAIRINGS.map((pairing) => {
    const fgHex = tokens.get(pairing.fg);
    const bgHex = tokens.get(pairing.bg);
    if (fgHex === undefined || bgHex === undefined) {
      const missing = fgHex === undefined ? pairing.fg : pairing.bg;
      throw new Error(
        `Pairing "${pairing.fg} on ${pairing.bg}" names --color-${missing}, which tokens.css does not declare`,
      );
    }
    const min = MINIMUM[pairing.level];
    const measured = ratio(fgHex, bgHex);
    return { ...pairing, min, fgHex, bgHex, ratio: measured, passes: measured >= min };
  });
}

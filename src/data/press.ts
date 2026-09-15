/**
 * `/press` - the boilerplate, the asset list, and the address.
 *
 * A data module rather than markup, for `nav.ts`'s reason: the asset list is something a
 * test can walk. `tests/unit/press-assets.spec.ts` checks every file declared here against
 * `public/press/manifest.json`, in both directions - a declared file that was never
 * generated is a broken download, and a generated file nothing offers is dead weight in
 * the repo.
 *
 * **The copy here is the whole point of the page.** 8.10b's Gate A measured what the
 * references actually ship: cash.app's press page is 255 words and its boilerplate *is*
 * the h2 under the title. A journalist on a deadline wants a paragraph they can paste, at
 * the length their piece has room for - so it is written at three lengths rather than one
 * length and a hope.
 *
 * **No hex literals, and not even the stylesheet import that would resolve them.** The
 * swatches below name their tokens; `press.astro` reads the values, because pulling
 * `tokens.css?raw` in here made this module un-importable from a Playwright spec - Vite
 * inlines that, and the test runner's transform meets a stylesheet where it expects
 * TypeScript. The tests are the second consumer of this file and the reason it is data at
 * all, so it stays free of anything only a bundler can resolve.
 *
 * **The copy is not here - 8.11a moved it to `src/i18n/<locale>/press.ts`.** The
 * boilerplate, the labels, the swatch roles and the screenshot descriptions all left;
 * what stayed is the inventory: which files exist, which tokens the swatches name, and
 * the ids that join the two halves. `tests/unit/press-assets.spec.ts` still walks this
 * against `public/press/manifest.json` in both directions.
 */
import type { Catalogue } from '../i18n';
/** Where press enquiries go. Created for this page - see 8.13's mailbox verification task. */
export const PRESS_EMAIL = 'press@sonaru.app';

export interface Boilerplate {
  /** The key into `press.boilerplate.entries`, where the label and the text live. */
  readonly id: keyof Catalogue['press']['boilerplate']['entries'];
}

/**
 * The three lengths.
 *
 * **The last sentence of the long one is not padding.** Sonaru has not shipped: no App
 * Store listing, no TestFlight build, no release date. A press page that leaves that out
 * is the one page on this site with a real chance of misleading somebody in print, and
 * `/changelog` already refused the same fabrication when it printed `Not yet released`
 * rather than inventing a date.
 */
export const BOILERPLATE: readonly Boilerplate[] = [
  { id: 'one-line' },
  { id: 'short' },
  { id: 'long' },
];

export interface Swatch {
  /** The name in `tokens.css`, without the `--color-` prefix, and the key into `press.colour.roles`. */
  readonly token: keyof Catalogue['press']['colour']['roles'];
}

/** The six a journalist or a designer would actually reach for. Not the whole ramp. */
export const SWATCHES: readonly Swatch[] = [
  { token: 'plum-900' },
  { token: 'plum-700' },
  { token: 'plum-500' },
  { token: 'plum-300' },
  { token: 'ink-950' },
  { token: 'white' },
];

export interface LogoFile {
  /** Path under `public/press/`, and the key into the generated manifest. */
  readonly file: string;
  /** The key into `press.logo.files`. The same five shapes exist in both colourways. */
  readonly label: keyof Catalogue['press']['logo']['files'];
}

export interface Colourway {
  readonly id: keyof Catalogue['press']['logo']['ways'];
  readonly files: readonly LogoFile[];
}

/**
 * **There is no vector lockup, and that is a decision rather than an omission.**
 *
 * The mark is geometry and exports cleanly to SVG. The wordmark is live Outfit text, and
 * `design-system.md` §9.5 records that outlining it was *dropped, not done, and must not
 * be reopened as cleanup* when the owner declared the mark final. So the lockup is offered
 * as PNG at two sizes, which is what a newsroom pastes into a CMS anyway, and the page
 * says so rather than leaving a journalist to discover it.
 */
export const COLOURWAYS: readonly Colourway[] = [
  {
    id: 'dark',
    files: [
      { file: 'sonaru-mark.svg', label: 'mark' },
      { file: 'sonaru-mark-512.png', label: 'mark-512' },
      { file: 'sonaru-mark-1024.png', label: 'mark-1024' },
      { file: 'sonaru-lockup-1024.png', label: 'lockup-1024' },
      { file: 'sonaru-lockup-2048.png', label: 'lockup-2048' },
    ],
  },
  {
    id: 'light',
    files: [
      { file: 'sonaru-mark-light.svg', label: 'mark' },
      { file: 'sonaru-mark-light-512.png', label: 'mark-512' },
      { file: 'sonaru-mark-light-1024.png', label: 'mark-1024' },
      { file: 'sonaru-lockup-light-1024.png', label: 'lockup-1024' },
      { file: 'sonaru-lockup-light-2048.png', label: 'lockup-2048' },
    ],
  },
];

export interface Screen {
  /** The key into `press.screenshots.screens`, and the stem of both image files. */
  readonly id: keyof Catalogue['press']['screenshots']['screens'];
}

/** The five App Store captures, in the order the app introduces them. */
export const SCREENS: readonly Screen[] = [
  { id: 'welcome' },
  { id: 'feed' },
  { id: 'search' },
  { id: 'auto-add' },
  { id: 'pro' },
];

/** The one download that contains everything above. */
export const KIT_FILE = 'sonaru-press-kit.zip';

/** Every file `/press` offers, for the guard that checks them against the manifest. */
export const ALL_PRESS_FILES: readonly string[] = [
  ...COLOURWAYS.flatMap((way) => way.files.map((file) => file.file)),
  ...SCREENS.flatMap((screen) => [`screens/${screen.id}.jpg`, `screens/${screen.id}-full.jpg`]),
  KIT_FILE,
];

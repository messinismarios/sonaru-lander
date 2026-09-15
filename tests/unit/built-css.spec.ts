import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guards on the CSS the build actually ships, not on the source - 8.14.
 *
 * **The header's scroll scrim was absent on every iPhone, on every route, and nothing here
 * could see it.** The source declares `animation` and then `animation-timeline: scroll()`
 * as separate longhands. The build's minifier folds the second into the first and ships
 * `animation: linear both header-scrim scroll()`. Chromium, and the WebKit build Playwright
 * runs, accept a timeline inside the shorthand; **iOS Safari 26 does not**, so it discards
 * the whole declaration and the scrim sits at `opacity: 0` whatever the scroll position.
 * Measured in the iOS 26 simulator: `animation-name: none`, `animation-timeline: auto`,
 * while `animation-range` - which the minifier left alone - applied.
 *
 * Every browser test passed throughout, because none of them runs that engine. So this
 * asserts the shape of the shipped bytes instead: no timeline inside a shorthand, anywhere.
 */

const DIST = new URL('../../dist/', import.meta.url);

function builtCss(dir = DIST): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...builtCss(new URL(`${entry.name}/`, dir)));
    else if (entry.name.endsWith('.css')) out.push(fileURLToPath(new URL(entry.name, dir)));
  }
  return out;
}

const sheets = builtCss().map((file) => ({ file, css: readFileSync(file, 'utf8') }));

/** Every `animation:` shorthand value in a stylesheet. Longhands never match. */
function shorthands(css: string): string[] {
  return [...css.matchAll(/(?:^|[;{\s])animation\s*:\s*([^;}]*)/g)].map((match) => match[1] ?? '');
}

test('the build emitted stylesheets to check', () => {
  expect(sheets.length).toBeGreaterThan(0);
});

test('no animation shorthand carries a scroll or view timeline', () => {
  const offenders = sheets.flatMap(({ file, css }) =>
    shorthands(css)
      .filter((value) => /\b(?:scroll|view)\(/.test(value))
      .map((value) => `${file}: animation: ${value}`),
  );
  expect(offenders, 'iOS Safari drops these declarations entirely').toEqual([]);
});

test('the header scrim ships its timeline as a longhand', () => {
  // Inside a declaration block: the `@supports (animation-timeline: scroll())` condition that
  // wraps it is the same text, and matching that let this pass against the broken build.
  const scrim = sheets.some(({ css }) => /\{[^{}]*animation-timeline\s*:\s*scroll\(\)/.test(css));
  expect(scrim, 'no standalone `animation-timeline: scroll()` in the built CSS').toBe(true);
});

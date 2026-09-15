import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  { ignores: ['dist/**', '.astro/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  /*
   * Wired 2026-09-08. Until then neither Svelte linter was installed, so `npm run verify`
   * walked past `PlanToggle.svelte` and `WaitlistForm.svelte` in silence - the repo's
   * `any` ban and its format gate did not reach either hydrated component that actually
   * ships. Recorded in phases.md 8.12 as a known hole; closed here because it is tooling
   * (`review-gates.md` §4) and because a rule that skips the code it exists for is worse
   * than no rule.
   */
  ...svelte.configs.recommended,

  // Astro's ambient client types (ImageMetadata, Astro, ...) are globals TypeScript knows
  // about from 'astro/client' but ESLint's no-undef cannot see. TypeScript is the
  // authority on undefined identifiers here - 'astro check' and 'tsc --noEmit' both run in
  // 'npm run verify' - so no-undef only duplicates it, badly, in typed files.
  {
    files: ['**/*.astro', '**/*.ts', '**/*.svelte'],
    rules: { 'no-undef': 'off' },
  },

  /*
   * Svelte components are typed by their own `lang="ts"` blocks; `svelte-eslint-parser`
   * hands the script to the TypeScript parser, which is what makes the `any` ban below
   * apply inside them.
   */
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'] },
      globals: globals.browser,
    },
  },

  // Build and design tooling runs in Node, not the browser.
  {
    files: ['scripts/**/*.mjs', '*.config.{js,mjs,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.nodeBuiltin },
  },

  /*
   * Except where it drives a browser. The bodies passed to Playwright's `page.evaluate`
   * are serialised and run *inside the page*, so `document` and `Image` are correct there
   * and undefined in the file around them - which is exactly what `no-undef` reports.
   * Both global sets are declared for these files rather than the rule being turned
   * off, so a genuine typo in the Node half is still caught.
   */
  {
    files: [
      'scripts/build-og-images.mjs',
      'scripts/build-press-assets.mjs',
      'scripts/build-brand-pdf.mjs',
      'scripts/lib/image-compare.mjs',
      'tests/e2e/blog.spec.ts',
    ],
    languageOptions: { globals: { ...globals.nodeBuiltin, ...globals.browser } },
  },

  {
    rules: {
      // mission.md §3.2 - the codebase carries no leftover work markers at launch.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-warning-comments': ['warn', { terms: ['fixme'], location: 'anywhere' }],
      // mission.md §3.2 - "Strict TypeScript, no `any`".
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];

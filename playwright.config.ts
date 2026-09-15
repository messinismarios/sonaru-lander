import { defineConfig, devices } from '@playwright/test';

/**
 * Uses the locally installed Chrome (`channel: 'chrome'`) rather than downloading
 * Playwright's own browser bundles. The full cross-browser matrix - Safari and Firefox
 * especially, where scroll smoothing and backdrop effects break first - arrives with the
 * hardening work in 8.12.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  /*
   * Capped deliberately. Every test drives a real Chrome, and the font-metrics specs load
   * two full variable fonts each; at Playwright's default worker count this machine
   * thrashed and tests failed with `browser.newContext: Test ended` - a timeout from
   * contention, not a defect, which is the most misleading kind of red build.
   *
   * **Two locally as well, since 2026-09-08.** The cap above said 4 when the suite was
   * 217 tests; at 274 the same contention returned, failing a different `feed.spec.ts`
   * test each run - each of which passed alone, and the whole suite green at 2. The
   * trade is about 1.5 minutes per full run against a red build that means nothing,
   * which is the wrong way round: a suite you have to re-run to believe is not a gate.
   */
  workers: 2,
  forbidOnly: !!process.env['CI'],
  /*
   * **No retries, on CI or anywhere** (owner, 2026-09-15: flaky tests "shouldn't ever
   * happen"). CI retried twice from 2026-09-12 as a stopgap around `notify.spec.ts`, which
   * turned out to be the tests reading scroll-driven state before the page had written it -
   * fixed at the source in `scrollToAndSettle` (`tests/motion-ready.ts`). A retry would only
   * hide the next one; a test that fails once is a failure.
   */
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'on-first-retry' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321/specimen',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});

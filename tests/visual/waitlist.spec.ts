import { expect, test, type Page } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * The waitlist route's frozen appearance - phases.md 8.8, Gate C.
 *
 * **All five states are shot, which is the point of this suite rather than a bonus.**
 * `acceptance-criteria.md` §9 requires idle, loading, success, duplicate and error to be
 * designed and approved, and an error state with no baseline behind it is the one that
 * quietly rots - nobody submits a bad address on the way to reviewing something else.
 * The route reads `?state=` under `astro dev` for exactly this reason.
 *
 * **Turnstile is masked, not disabled.** The widget is a third-party iframe whose
 * contents change without warning, so its pixels cannot be a baseline. Masking keeps the
 * space it occupies in the frame - which is the part that is ours, and the part that
 * would regress if the reserved box were ever removed.
 */

const CHALLENGE = '.challenge';

async function open(page: Page, state: string): Promise<void> {
  await page.goto(`/waitlist?state=${state}`);
  // The form is server-rendered as idle, so wait for hydration: Astro drops `ssr` from the
  // island once it has, and only then does a `?state=` other than idle show.
  await page.waitForSelector('astro-island:not([ssr]) .waitlist');
  await freeze(page);
}

for (const viewport of VIEWPORTS) {
  test(`the waitlist at ${viewport.name}, default motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await open(page, 'idle');

    await expect(page).toHaveScreenshot(`waitlist-${viewport.name}.png`, {
      ...SHOT,
      fullPage: true,
      mask: [page.locator(CHALLENGE)],
    });

    await context.close();
  });

  test(`the waitlist at ${viewport.name}, reduced motion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await open(page, 'idle');

    await expect(page).toHaveScreenshot(`waitlist-${viewport.name}-reduced.png`, {
      ...SHOT,
      fullPage: true,
      mask: [page.locator(CHALLENGE)],
    });

    await context.close();
  });
}

/**
 * The four states a visitor reaches by doing something, at the one width where the
 * differences between them are legible. They are the same composition with different
 * words, so three viewports each would be nine near-identical baselines to review.
 */
for (const state of ['loading', 'success', 'duplicate', 'error'] as const) {
  test(`the waitlist in its ${state} state`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await open(page, state);

    await expect(page).toHaveScreenshot(`waitlist-state-${state}.png`, {
      ...SHOT,
      fullPage: true,
      mask: [page.locator(CHALLENGE)],
    });

    await context.close();
  });
}

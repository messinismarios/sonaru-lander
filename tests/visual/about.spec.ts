import { expect, test, type Page } from '@playwright/test';
import { SHOT, VIEWPORTS, freeze } from './support';

/**
 * "About Sonaru" on `/` - SEO audit H3, at every viewport in both motion modes
 * (`acceptance-criteria.md` §5).
 *
 * **Scrolled until the section's top is still at the top of the viewport**, rather than to a
 * measured offset: the acts above grow the document as their pins are built, by different
 * amounts at different widths and in neither order reliably, so an offset read too early is
 * wrong by thousands of pixels. Re-scrolling until the position holds is true whatever the
 * acts do. The frame therefore includes the header, with the scrim this section drives.
 */
async function settleOnAbout(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const about = document.querySelector('[data-about]') as HTMLElement | null;
      if (about === null) return false;
      const top = about.getBoundingClientRect().top;
      window.scrollTo(0, top + window.scrollY);
      const store = window as unknown as { __aboutSame?: number };
      store.__aboutSame = Math.abs(top) < 1 ? (store.__aboutSame ?? 0) + 1 : 0;
      return store.__aboutSame >= 10;
    },
    undefined,
    { timeout: 20_000, polling: 50 },
  );
}

for (const viewport of VIEWPORTS) {
  test(`"About Sonaru" at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await settleOnAbout(page);
    await freeze(page);
    await expect(page).toHaveScreenshot(`about-${viewport.name}.png`, SHOT);
  });

  test(`"About Sonaru" at ${viewport.name}, reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await settleOnAbout(page);
    await freeze(page);
    await expect(page).toHaveScreenshot(`about-${viewport.name}-reduced.png`, SHOT);
  });
}

import { expect, test } from '@playwright/test';

/**
 * `acceptance-criteria.md` §3: "The LCP element is not animation-dependent and does not
 * wait on a font or on JS."
 *
 * That line is the whole reason the hero's headline is static - it was the owner's Gate A
 * decision, and `docs/adr-0003-hero-lcp.md` records the argument. A promise like that
 * decays the moment someone adds a fade-in to the hero and everything still looks fine
 * locally, so it is asserted rather than trusted.
 *
 * Two independent checks, because neither alone is enough:
 *
 * 1. **Which element wins.** Only two are allowed to: the headline and the first cover.
 *    Both are server-rendered, and both are painted from the HTML.
 * 2. **The page with JavaScript turned off.** If the largest paintable things are fully
 *    visible with no script at all, the LCP element cannot be waiting on script or on an
 *    animation. This is the check that actually holds the line - an opacity-0 entrance
 *    would sail through the first one and fail here.
 */

/**
 * Elements permitted to be the largest paint. Anything else is a regression.
 *
 * `p.sub` was added after the 2026-09-03 restructure moved the device out of the hero.
 * With the phone gone the fold is pure text, and at 390 the sub-paragraph wraps to enough
 * lines to out-area the headline, so Chrome reports it rather than `h1.headline` - a real
 * change in which element wins, not a regression in *what kind* of element wins. It
 * qualifies on the terms this file actually cares about: server-rendered, painted from
 * the HTML, and fully opaque with JavaScript disabled, which the third test below proves
 * for every entry in this list rather than taking on trust.
 *
 * `img.art` now lives in `Feed.astro` rather than the hero. It is kept because it remains
 * the largest *image* on the route and the no-JS check below is the only thing asserting
 * it is painted rather than faded in.
 */
const ALLOWED = ['h1.headline', 'p.sub', 'img.art'];

test.describe('hero - largest contentful paint', () => {
  for (const [name, width, height] of [
    ['mobile', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    test(`${name}: the LCP element is static, server-rendered content`, async ({ page }) => {
      await page.setViewportSize({ width, height });

      // Registered before navigation so the entry is not missed: LCP candidates are
      // reported from the very first paint, and a late observer sees nothing.
      await page.addInitScript(() => {
        const store: { selector: string | null } = { selector: null };
        (window as unknown as { __lcp: typeof store }).__lcp = store;

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as
            | (PerformanceEntry & {
                element?: Element;
              })
            | undefined;
          const element = last?.element;
          if (!element) return;
          const classes = element.className
            ? `.${String(element.className).trim().split(/\s+/).join('.')}`
            : '';
          store.selector = `${element.tagName.toLowerCase()}${classes}`;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });

      await page.goto('/');
      // Long enough for the scrub to have initialised and painted at progress 0. If any
      // of that were able to move the LCP element, waiting here is what would expose it.
      await page.waitForTimeout(2500);

      const selector = await page.evaluate(
        () => (window as unknown as { __lcp: { selector: string | null } }).__lcp.selector,
      );

      expect(selector, 'no LCP entry was reported').not.toBeNull();
      const matched = ALLOWED.some((allowed) => (selector ?? '').startsWith(allowed));
      expect(matched, `LCP element was ${selector}; expected one of ${ALLOWED.join(', ')}`).toBe(
        true,
      );
    });
  }

  /**
   * The guard on 8.2's Gate B measurement.
   *
   * The rebuilt hero grows the device to near-full-screen, which is larger than the
   * headline - so the obvious worry is that the cover becomes the LCP element partway
   * through the scrub and the largest paint turns out to be animation-dependent after
   * all. Measured at Gate B across three growth modes and two viewports, it does not:
   * Chrome records LCP candidates at paint time, and an element that grows *after* it has
   * painted does not re-qualify.
   *
   * That is a fact about Chrome's implementation, not about our code, which is exactly
   * why it is asserted here - if it ever stops being true, or if someone makes the device
   * enter rather than merely grow, this is what catches it.
   *
   * Scrolling is done with the wheel and never with a click: a click finalises LCP, which
   * would make this test pass for the wrong reason.
   */
  test('the headline is still the LCP element after the device has grown', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      const store: { selectors: string[] } = { selectors: [] };
      (window as unknown as { __lcpAll: typeof store }).__lcpAll = store;

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const element = (entry as PerformanceEntry & { element?: Element }).element;
          if (!element) continue;
          const classes = element.className
            ? `.${String(element.className).trim().split(/\s+/).join('.')}`
            : '';
          store.selectors.push(`${element.tagName.toLowerCase()}${classes}`);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Through the whole growth, in small steps, the way a person scrolls.
    for (let i = 0; i < 30; i += 1) {
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(1500);

    const selectors = await page.evaluate(
      () => (window as unknown as { __lcpAll: { selectors: string[] } }).__lcpAll.selectors,
    );

    expect(selectors.length, 'no LCP entry was reported').toBeGreaterThan(0);
    const last = selectors[selectors.length - 1] ?? '';
    const matched = ALLOWED.some((allowed) => last.startsWith(allowed));
    expect(
      matched,
      `after the growth the LCP element was ${last}; entries seen: ${selectors.join(' -> ')}`,
    ).toBe(true);
  });

  test('with JavaScript disabled, the headline and the first cover are fully painted', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/');

    for (const selector of ALLOWED) {
      const element = page.locator(selector).first();
      await expect(element).toBeVisible();

      const painted = await element.evaluate((node) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return {
          opacity: Number(style.opacity),
          visibility: style.visibility,
          area: box.width * box.height,
        };
      });

      // Fully opaque, not merely present: an element mid-fade is exactly the failure this
      // whole arrangement exists to prevent.
      expect(painted.opacity, `${selector} is not fully opaque without JS`).toBe(1);
      expect(painted.visibility).toBe('visible');
      expect(painted.area, `${selector} has no painted area without JS`).toBeGreaterThan(0);
    }

    await context.close();
  });
});

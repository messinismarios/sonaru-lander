import { expect, test } from '@playwright/test';

/**
 * The changelog's behaviour - phases.md 8.9e.
 *
 * `tests/unit/changelog-inventory.spec.ts` checks the notes; this checks the page they
 * produce. Nearly everything here is a thing that can be wrong while the page looks
 * perfect: the heading outline, the permalink's focus, and the sentence the page prints
 * where a release date will eventually go.
 */

test.describe('the page', () => {
  test('renders every release in full, not as a list of links', async ({ page }) => {
    // Gate A's finding: both references render entries in full on the index and neither
    // uses cards. A changelog you must click into to find out what changed is the design
    // this page exists not to be.
    await page.goto('/changelog');
    const entries = page.locator('.releases > li');
    await expect(entries).toHaveCount(1);
    await expect(entries.first().locator('.notes p').first()).toBeVisible();
    // No per-entry route, so nothing on the page links to one.
    await expect(page.locator('a[href^="/changelog/"]')).toHaveCount(0);
  });

  test('keeps one h1 and steps each release down from it', async ({ page }) => {
    await page.goto('/changelog');
    // `main h1`, matching `tests/e2e/legal.spec.ts`. A bare `h1` locator pierces shadow
    // DOM and counts Astro's dev-toolbar headings along with the page's own.
    await expect(page.locator('main h1')).toHaveCount(1);
    // The masthead owns the h1, a release is an h2, and a note's own sections are h3.
    // No level is skipped, which is the whole of the accessibility claim at Gate B.
    const levels = await page
      .locator('.releases :is(h2, h3, h4)')
      .evaluateAll((nodes) => nodes.map((node) => node.tagName));
    expect(levels[0]).toBe('H2');
    // Only h2 and h3 may appear; a short note like 0.1's has no sections, so h3 is optional.
    expect(levels.filter((level) => level !== 'H2' && level !== 'H3')).toEqual([]);
  });

  test('a release heading is a focusable permalink target', async ({ page }) => {
    // Without `tabindex="-1"` a fragment link scrolls the page and leaves focus at the
    // top, so the next Tab returns the visitor to the header they navigated away from.
    await page.goto('/changelog');
    const heading = page.locator('.releases h2').first();
    const anchor = await heading.getAttribute('id');
    expect(anchor).toBe('v0-1');
    await expect(heading).toHaveAttribute('tabindex', '-1');

    await page.goto(`/changelog#${anchor}`);
    await heading.evaluate((node: HTMLElement) => node.focus());
    await expect(heading).toBeFocused();
  });
});

test.describe('the date that does not exist yet', () => {
  test('an unshipped release says so instead of printing a date', async ({ page }) => {
    /*
     * The point of the whole unit. Sonaru has never shipped, so 0.1 has no release date;
     * writing today's would be the fabrication Gate A rejected on the same ground 8.9a
     * refused superlist's `version 1.57.0` footer line.
     */
    await page.goto('/changelog');
    const meta = page.locator('.releases .meta').first();
    await expect(meta).toContainText('Version 0.1');
    await expect(meta).toContainText('Not yet released');
  });

  test('it emits no <time>, because there is no instant to emit', async ({ page }) => {
    // An empty `<time>` is a machine-readable claim with nothing in it. When 8.13 fills
    // the date in, this assertion is the one that has to be updated - deliberately.
    await page.goto('/changelog');
    await expect(page.locator('.releases time')).toHaveCount(0);
  });

  test('the meta line reads correctly as text, not only on screen', async ({ page }) => {
    // The flex `gap` puts nothing in the document, so without the explicit spaces this
    // reads `Version 0.1·Not yet released` to a screen reader, a copy-paste and a search
    // result. `tests/visual/inline-spacing.spec.ts` covers the class; this covers the line.
    await page.goto('/changelog');
    const text = await page.locator('.releases .meta').first().innerText();
    expect(text.replace(/\s+/g, ' ').trim()).toBe('Version 0.1 · Not yet released');
  });
});

test.describe('the footer promise', () => {
  test('the footer now offers Changelog as a real link', async ({ page }) => {
    // 8.9a built the footer with this entry inert and `nav-inventory.spec.ts` asserts the
    // flag in both directions; this is the same claim seen from the page.
    await page.goto('/');
    await expect(page.locator('footer a[href="/changelog"]')).toHaveCount(1);
  });
});

test.describe('the motion budget', () => {
  test('/changelog ships no GSAP, ScrollTrigger or Lenis', async ({ page }) => {
    // Asserted rather than promised, the way `/blog` asserts it.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/changelog', { waitUntil: 'networkidle' });
    const motion = requests.filter((url) => /gsap|ScrollTrigger|lenis/i.test(url));
    expect(motion, '/changelog should ship no motion stack').toEqual([]);
  });

  test('and no JavaScript of its own', async ({ page }) => {
    /*
     * Gate B budgeted this route at 0 bytes of JS, so the claim is worth asserting and not
     * only the motion stack. **The filter is the honest part.** Against the dev server the
     * page carries Vite's client and Astro's dev toolbar, and every scoped stylesheet
     * arrives as a module request - `?astro&type=style` for a scoped block and a bare
     * `.css` path for `tokens.css`, both of which Vite serves as JavaScript in dev and
     * neither of which exists in a production build. Dropping them leaves exactly what
     * this is about: an island, a bundled entrypoint, or a third-party script appearing on
     * a static document.
     */
    await page.goto('/changelog', { waitUntil: 'networkidle' });
    const scripts = await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') ?? ''));
    const shipped = scripts.filter(
      (src) => !/^\/@vite\/|^\/@id\/astro\/|[?&]astro&type=style|\.css(\?|$)/.test(src),
    );
    expect(shipped, '/changelog is a static document').toEqual([]);
  });
});

test.describe('prose links', () => {
  test("a link in a release note matches the site's one link treatment", async ({ page }) => {
    // Markdown renders a bare <a>, so `Link.astro` cannot be used and `Document.astro`
    // repeats its declarations. `tests/e2e/legal.spec.ts` guards that pairing for the
    // legal pages; the notes reach the same rules through the same layout.
    await page.goto('/changelog');
    const link = page.locator('.notes a[href="/waitlist"]').first();
    await expect(link).toHaveCount(1);
    await expect(link).toHaveCSS('text-decoration-line', 'none');
  });
});

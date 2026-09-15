import { expect, test } from '@playwright/test';

/**
 * The 404's behaviour - phases.md 8.9f.
 *
 * Most of this is a thing that can be wrong while the page looks perfect: the status code
 * behind it, the `noindex` that keeps it out of an index, and whether the footer the whole
 * design leans on is actually under it.
 *
 * **There is no companion `/500` spec, and that is the unit's finding rather than an
 * omission.** The site is `output: 'static'`, `functions/api/waitlist.ts` never returns
 * 5xx by design, and Cloudflare Pages has no `500.html` convention - so there is no
 * navigation on this site that can produce one. Recorded at Gate A, option A.
 */

test.describe('the status code', () => {
  test('an unmatched path answers 404, not 200', async ({ page }) => {
    /*
     * The assertion the page's appearance cannot make. A 404 page served with a 200 is a
     * soft 404: search engines index it, and a crawler cannot tell a missing page from a
     * real one.
     */
    const response = await page.goto('/no-such-page-8-9f');
    expect(response?.status()).toBe(404);
  });

  test('and the route itself answers 404 when requested directly', async ({ page }) => {
    // Measured rather than assumed at Gate B, where both behaviours were budgeted for:
    // the dev server answers 404 on `/404` too, so the two paths agree.
    const response = await page.goto('/404');
    expect(response?.status()).toBe(404);
  });

  test('both paths render the same page', async ({ page }) => {
    await page.goto('/no-such-page-8-9f');
    await expect(page.locator('main h1')).toHaveText("This page isn't here.");
    await page.goto('/404');
    await expect(page.locator('main h1')).toHaveText("This page isn't here.");
  });
});

test.describe('the page', () => {
  test('the numeral is the eyebrow, and the headline is a sentence', async ({ page }) => {
    /*
     * Gate A's finding, and the one thing both references agree on: neither gsap nor
     * superlist prints `404` as its headline. The number is still owed to the visitor, so
     * it goes where every other section of this site puts its label.
     */
    await page.goto('/404');
    await expect(page.locator('.not-found .eyebrow')).toHaveText('Error 404');
    await expect(page.locator('main h1')).not.toContainText('404');
  });

  test('keeps exactly one h1', async ({ page }) => {
    // `main h1`, matching the legal and changelog specs: a bare `h1` locator pierces
    // shadow DOM and counts Astro's dev-toolbar headings along with the page's own.
    await page.goto('/404');
    await expect(page.locator('main h1')).toHaveCount(1);
  });

  test('offers exactly one action, and it goes home', async ({ page }) => {
    // Both references give exactly one. Ours is home rather than gsap's contact link: a
    // mistyped URL is not a support case.
    await page.goto('/404');
    const actions = page.locator('.not-found a.btn');
    await expect(actions).toHaveCount(1);
    await expect(actions).toHaveAttribute('href', '/');
    await expect(actions).toHaveText('Go to the home page');
  });

  test('that action is a real link, not a scripted button', async ({ page }) => {
    // `Button.astro` renders an <a> when given `href`. On a page that ships no JavaScript
    // at all, anything else would be a control that cannot do its one job.
    await page.goto('/404');
    const action = page.locator('.not-found a.btn');
    await expect(action).toHaveJSProperty('tagName', 'A');
    await action.focus();
    await expect(action).toBeFocused();
  });

  test('tells the visitor the footer is the recovery', async ({ page }) => {
    // The lede's last clause is what makes the chrome load-bearing rather than
    // decorative. Without it the page points at nothing and the design's whole argument
    // - that we keep our chrome where superlist drops theirs - goes unstated.
    await page.goto('/404');
    await expect(page.locator('.not-found .lede')).toContainText(
      'Everything the site has is below',
    );
  });
});

test.describe('the chrome the design leans on', () => {
  test('the footer is present and still lists the site', async ({ page }) => {
    /*
     * The design decision under test. 8.9a built the footer as an inventory of the routes
     * the site offers, guarded in both directions by `tests/unit/nav-inventory.spec.ts`;
     * this page is that inventory with a sentence over it. If the footer ever stops
     * rendering here, the 404 silently becomes superlist's dead end.
     */
    await page.goto('/404');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    /*
     * At least one, not exactly one: `/support` appears twice by design - the Legal
     * group's entry, and `TAKEDOWN` reusing it, which `tests/unit/nav-inventory.spec.ts`
     * documents as its one exception. This guard is about the destination being reachable,
     * and the footer's own composition is `tests/visual/footer.spec.ts`'s to freeze.
     */
    for (const href of ['/blog', '/changelog', '/privacy', '/support', '/terms', '/waitlist']) {
      expect(await footer.locator(`a[href="${href}"]`).count(), href).toBeGreaterThan(0);
    }
  });

  test('but it cannot offer /pricing, which nothing links to', async ({ page }) => {
    /*
     * **Written to fail the day the gap closes, because the gap is the point.**
     *
     * The Pricing entry was dropped from the footer by the owner at 8.9a's Gate A, and
     * `/pricing` has been orphaned ever since - carried to 8.13's pre-launch sweep. This
     * unit is what gives that a visible cost: the 404's entire argument is that the footer
     * is the recovery, so a visitor who mistypes a pricing URL reaches a page that cannot
     * point them at pricing. Asserting the hole keeps it from being rediscovered as a
     * surprise, and turns red the moment 8.13 links the route from anywhere.
     */
    await page.goto('/404');
    await expect(page.locator('footer a[href="/pricing"]')).toHaveCount(0);
  });

  test('and the header still offers the waitlist', async ({ page }) => {
    // `Header.astro` derives its action from the path; `/404` is not `/waitlist`, so the
    // visitor who lands here wrong still has the one thing the site is for.
    await page.goto('/404');
    await expect(page.locator('header a[href="/waitlist"]')).toHaveCount(1);
  });
});

test.describe('the head', () => {
  test('is noindex', async ({ page }) => {
    // Taken from superlist's 404, which is the one choice on that page that is simply
    // correct: a page that exists to say "this is not a page" must never enter an index.
    await page.goto('/404');
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('and claims no canonical URL or language versions', async ({ page }) => {
    // SEO audit L2: both named `/404`, which contradicts the noindex beside them.
    await page.goto('/404');
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('head link[rel="alternate"][hreflang]')).toHaveCount(0);
  });
});

test.describe('the motion budget', () => {
  test('/404 ships no GSAP, ScrollTrigger or Lenis', async ({ page }) => {
    // Asserted rather than promised, the way `/blog` and `/changelog` assert it. The only
    // movement on the page is `BloomField`'s own CSS drift, which costs no bytes.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/404', { waitUntil: 'networkidle' });
    const motion = requests.filter((url) => /gsap|ScrollTrigger|lenis/i.test(url));
    expect(motion, '/404 should ship no motion stack').toEqual([]);
  });

  test('and no JavaScript of its own', async ({ page }) => {
    // The filter is `tests/e2e/changelog.spec.ts`'s, for the reason documented there: in
    // dev, Vite serves every scoped stylesheet as a JavaScript module and neither those
    // nor the dev toolbar exist in a production build.
    await page.goto('/404', { waitUntil: 'networkidle' });
    const scripts = await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') ?? ''));
    const shipped = scripts.filter(
      (src) => !/^\/@vite\/|^\/@id\/astro\/|[?&]astro&type=style|\.css(\?|$)/.test(src),
    );
    expect(shipped, '/404 is a static document').toEqual([]);
  });
});

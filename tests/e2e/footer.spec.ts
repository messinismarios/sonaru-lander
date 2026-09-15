import { expect, test } from '@playwright/test';
import { ALL_NAV_ITEMS } from '../../src/data/nav';
import { ROUTES, isCameraStand } from '../visual/routes';

/**
 * The footer's behaviour - phases.md 8.9a.
 *
 * The appearance is `tests/visual/footer.spec.ts`'s job. These are the properties a
 * snapshot cannot see: that it is on every route, that a destination which does not exist
 * yet is genuinely not a link, that it carries exactly one `contentinfo` landmark, and
 * that the takedown contact `design-system.md` §7.4 requires is actually on the page a
 * rights holder lands on.
 */

/**
 * Every route the site serves, including the development-only ones - **except the OG
 * camera stands.**
 *
 * `/blog/og/<slug>` is not a page. It renders `PostCover` on a bare 1200x600 document with
 * no `Base`, no header, no footer and no skip link, because whatever is in that document
 * ends up inside the photograph `npm run og` takes of it. Asserting a footer there would
 * be asserting that the social card has a footer in it.
 *
 * Excluded by shape rather than by name, so a fourth post does not have to be added here,
 * and narrowly enough that a real route can never fall through it: `/blog/og/` is the only
 * prefix the site serves that is not a destination.
 */
const ALL = ROUTES.filter((route) => !isCameraStand(route));

test.describe('presence', () => {
  for (const route of ALL) {
    test(`renders on ${route}`, async ({ page }) => {
      await page.goto(route);
      const footer = page.locator('footer.site-footer');
      await expect(footer).toBeAttached();

      // It closes the document rather than sitting somewhere in the middle of it, and it
      // is outside <main> so it lands in the contentinfo landmark. Scripts and the dev
      // toolbar are rendered nothing, so the check is against the last element that
      // occupies space.
      const lastRendered = await page.evaluate(() =>
        [...document.body.children]
          .filter((element) => element.getBoundingClientRect().height > 0)
          .at(-1)
          ?.tagName.toLowerCase(),
      );
      expect(lastRendered).toBe('footer');
      await expect(page.locator('main footer.site-footer')).toHaveCount(0);
    });
  }

  test('renders on /waitlist, where the header drops its action', async ({ page }) => {
    await page.goto('/waitlist');
    // 8.8's Gate C removed the header's button here; the footer is the only remaining
    // way out of the route, which is why it is not also dropped.
    await expect(page.locator('header.site-header a[href="/waitlist"]')).toHaveCount(0);
    await expect(page.locator('footer.site-footer')).toBeVisible();
  });
});

test.describe('pending destinations', () => {
  test('render as text, not as links', async ({ page }) => {
    await page.goto('/');
    const pending = ALL_NAV_ITEMS.filter((item) => !item.live);
    // Every route named in nav.ts that does not exist yet must appear exactly once as
    // inert text - never as an anchor, which would be a 404 the visitor finds first.
    for (const item of pending) {
      await expect(page.locator(`footer.site-footer a[href="${item.href}"]`)).toHaveCount(0);
    }
    // The Legal group's /support and the takedown contact are the same destination, so
    // the label appears twice; every other pending label appears once.
    await expect(page.locator('footer.site-footer .pending')).toHaveCount(pending.length);
  });

  test('are not focusable', async ({ page }) => {
    await page.goto('/');
    // A tab stop that goes nowhere is worse than an absent one.
    const focusable = page.locator(
      'footer.site-footer .pending[tabindex], footer.site-footer .pending a, footer.site-footer .pending button',
    );
    await expect(focusable).toHaveCount(0);
  });

  test('live destinations are links', async ({ page }) => {
    await page.goto('/');
    for (const item of ALL_NAV_ITEMS.filter((entry) => entry.live)) {
      await expect(page.locator(`footer.site-footer a[href="${item.href}"]`).first()).toBeVisible();
    }
  });
});

test.describe('semantics', () => {
  test('there is exactly one contentinfo landmark', async ({ page }) => {
    await page.goto('/');
    // ReleaseCard.astro also uses <footer>, but inside <article> and inside an
    // aria-hidden subtree, so it is scoped rather than a landmark. If either of those
    // ever changes, a screen reader gains three phantom "footer" landmarks on the home
    // route and nothing else would tell us.
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('the footer nav is named, and each group labels its own list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Footer' })).toBeVisible();

    for (const label of ['Product', 'Company', 'Legal']) {
      const list = page.locator(
        `footer.site-footer ul[aria-labelledby="footer-${label.toLowerCase()}"]`,
      );
      await expect(list).toHaveCount(1);
      await expect(page.locator(`#footer-${label.toLowerCase()}`)).toHaveText(label);
    }
  });

  test('group labels are not headings', async ({ page }) => {
    await page.goto('/');
    // Three h2s per page purely for footer grouping would land in every document's
    // outline. The grouping is announced through aria-labelledby instead.
    await expect(page.locator('footer.site-footer :is(h1,h2,h3,h4,h5,h6)')).toHaveCount(0);
  });
});

test.describe('the artwork attribution', () => {
  test('is on every route, with its takedown contact', async ({ page }) => {
    // design-system.md §7.4. The bottom bar is where a rights holder actually looks.
    for (const route of ['/', '/pricing', '/waitlist']) {
      await page.goto(route);
      const line = page.locator('footer.site-footer .artwork');
      // Names photography as well as artwork (8.13): the site ships twelve artist
      // photographs, whose rights holders are photographers rather than labels.
      await expect(line).toContainText('Album artwork and artist photography');
      await expect(line).toContainText('respective rights holders');
      await expect(line).toContainText('Request a takedown');
    }
  });
});

test.describe('cost', () => {
  test('the footer adds no motion stack to a route that had none', async ({ page }) => {
    // /waitlist deliberately imports no GSAP, ScrollTrigger or Lenis (8.8). The footer
    // is rendered by Base.astro on every route, so a motion import here would silently
    // put ~57 KB back on the cheapest page on the site.
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await page.goto('/waitlist', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const motion = scripts.filter((url) => /gsap|ScrollTrigger|lenis/i.test(url));
    expect(motion).toEqual([]);
  });
});

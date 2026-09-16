import { expect, test } from '@playwright/test';

/**
 * The blog's behaviour - phases.md 8.9c.
 *
 * `tests/unit/blog-inventory.spec.ts` checks the data; this checks the pages that data
 * produces. The order, the feed, the structured data and the accessible shape of a card
 * are all things that can be wrong while the page looks perfect.
 */

const POSTS = ['what-is-sonaru'];

test.describe('the index', () => {
  test('lists every published post, newest first', async ({ page }) => {
    await page.goto('/blog');
    /*
     * Wait for the list before reading it. `evaluateAll` resolves immediately against
     * whatever is in the DOM, so under load - the full `npm test` run has the visual suite
     * hammering the same dev server - this read the index mid-render and compared a short
     * list against the expected three. It failed twice that way and passed every time it
     * was run alone, which is the signature of a test that races its own page rather than
     * of an ordering defect.
     */
    await expect(page.locator('.index li')).toHaveCount(POSTS.length);
    const hrefs = await page
      .locator('.index a[href^="/blog/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual(POSTS.map((slug) => `/blog/${slug}`));
  });

  test("a card's only link is its title", async ({ page }) => {
    // The whole card is clickable through a `::after` overlay rather than an anchor
    // wrapping it, so the link's accessible name is the title and not the cover's alt
    // plus the tag plus the date plus the excerpt.
    await page.goto('/blog');
    const card = page.locator('.index li').first();
    await expect(card.locator('a')).toHaveCount(1);
    const name = await card.locator('a').getAttribute('href');
    expect(name).toBe(`/blog/${POSTS[0]}`);
    await expect(card.locator('a')).toHaveAccessibleName('What Sonaru is, and who it is for');
  });

  test('the cover carries the hook as its alt text', async ({ page }) => {
    // The hook exists nowhere else on the page after Gate A's amendment, so an empty alt
    // would drop content rather than omit decoration.
    await page.goto('/blog');
    await expect(page.locator('.index img').first()).toHaveAttribute(
      'alt',
      'Every release, the moment it drops.',
    );
  });

  test('only the first cover loads eagerly', async ({ page }) => {
    // It is the LCP element; the rest are below the fold. `acceptance-criteria.md` §3.
    await page.goto('/blog');
    const loading = await page
      .locator('.index img')
      .evaluateAll((images) => images.map((image) => image.getAttribute('loading')));
    expect(loading).toEqual(['eager', ...POSTS.slice(1).map(() => 'lazy')]);
  });

  test('every cover reserves its box before it loads', async ({ page }) => {
    // CLS is budgeted at 0 for this route and this is the whole of how.
    await page.goto('/blog');
    const boxes = await page.locator('.index img').evaluateAll((images) =>
      images.map((image) => ({
        width: image.getAttribute('width'),
        height: image.getAttribute('height'),
        ratio: getComputedStyle(image).aspectRatio,
      })),
    );
    for (const box of boxes) {
      expect(box.width).toBe('1200');
      expect(box.height).toBe('600');
      expect(box.ratio.replace(/\s/g, '')).toBe('2/1');
    }
  });

  test('the feed is advertised in the head', async ({ page }) => {
    await page.goto('/blog');
    // Absolute since SEO audit L6: a feed reader resolves nothing against the page.
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
      'href',
      'https://sonaru.app/blog/rss.xml',
    );
  });
});

test.describe('an article', () => {
  test('renders through the approved reading layout', async ({ page }) => {
    // `Document.astro`, unchanged - 8.9b's Gate B promised the blog would reuse it rather
    // than fork it, and this is that promise expressed as something that can fail.
    await page.goto(`/blog/${POSTS[0]}`);
    await expect(page.locator('.document .prose')).toHaveCount(1);
    await expect(page.locator('.document h1')).toHaveText('What Sonaru is, and who it is for');
    await expect(page.locator('.document .eyebrow')).toHaveText('Blog');
  });

  test('does not repeat its cover at the top', async ({ page }) => {
    // The owner's decision at Gate B. It also keeps the LCP element text.
    await page.goto(`/blog/${POSTS[0]}`);
    const first = page.locator('.document img').first();
    expect(await first.count()).toBe(0);
  });

  test('carries BlogPosting and BreadcrumbList structured data', async ({ page }) => {
    await page.goto(`/blog/${POSTS[0]}`);
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent ?? '{}')));
    const posting = blocks.find((block) => block['@type'] === 'BlogPosting');
    const crumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList');
    expect(posting).toBeDefined();
    expect(posting.headline).toBe('What Sonaru is, and who it is for');
    expect(posting.datePublished).toBe('2026-09-14T06:00:00Z');
    expect(posting.image).toBe(`https://sonaru.app/og/${POSTS[0]}.jpg`);
    // No byline (owner, Gate A). Structured data that names an author the page does not
    // is worse than none.
    expect(posting.author['@type']).toBe('Organization');
    expect(crumbs.itemListElement).toHaveLength(2);
  });

  test('its social card is the file the index card shows', async ({ page }) => {
    await page.goto(`/blog/${POSTS[0]}`);
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    await page.goto('/blog');
    const card = await page.locator('.index img').first().getAttribute('srcset');
    expect(og).toContain(`/og/${POSTS[0]}.jpg`);
    expect(card).toContain(`/og/${POSTS[0]}.jpg`);
  });

  test('a linked tag matches the site’s one link treatment', async ({ page }) => {
    // `PostMeta` cannot use the `Link` primitive inside a flex row, so its declarations are
    // written a second time. This is what stops the two parting company - the same pairing
    // `Document.astro`'s prose links carry.
    await page.goto(`/blog/${POSTS[0]}`);
    const tag = page.locator('.meta a.tag').first();
    await expect(tag).toHaveAttribute('href', '/blog/tags/product');
    const style = await tag.evaluate((element) => {
      const computed = getComputedStyle(element);
      const underline = getComputedStyle(element, '::after');
      return {
        color: computed.color,
        decoration: computed.textDecorationLine,
        height: underline.height,
        background: underline.backgroundColor,
      };
    });
    expect(style.decoration).toBe('none');
    expect(style.height).toBe('1px');
  });
});

test.describe('tags', () => {
  test('every tag route lists its own posts and nothing else', async ({ page }) => {
    await page.goto('/blog/tags/product');
    /*
     * Scoped to `main`, not the document. Astro's dev toolbar injects **four `<h1>`s** of
     * its own - "No islands detected.", "Audit", the audit result and "Settings" - and
     * Playwright's locators pierce its open shadow root, so a bare `locator('h1')` matches
     * five elements the moment the toolbar hydrates.
     *
     * **This test was racing that hydration and had been winning.** `goto` resolves on
     * `load`, the toolbar mounts after it, and whichever arrived first decided the run.
     * 8.10a's head tags perturbed the timing by a few milliseconds and it started losing -
     * consistently, because a strict-mode violation is an error rather than a retryable
     * mismatch, so `toHaveText`'s polling cannot recover from it.
     *
     * Same contamination `scripts/build-og-images.mjs` already guards against with
     * `HIDE_DEV_TOOLBAR`: the toolbar is wanted everywhere except inside a measurement.
     */
    await expect(page.locator('main h1')).toHaveText('Product');
    const hrefs = await page
      .locator('.index a[href^="/blog/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toEqual(['/blog/what-is-sonaru']);
    await expect(page.locator('.count')).toHaveText('1 post');
  });

  test('a tag page offers a way back', async ({ page }) => {
    // `product`: since SEO audit H5 a tag with no published post has no page.
    await page.goto('/blog/tags/product');
    await expect(page.locator('.back a')).toHaveAttribute('href', '/blog');
  });
});

test.describe('the feed', () => {
  test('is valid XML with absolute links and every published post', async ({ request }) => {
    const response = await request.get('/blog/rss.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(response.headers()['content-type']).toContain('xml');
    for (const slug of POSTS) {
      expect(body).toContain(`https://sonaru.app/blog/${slug}`);
    }
    // Newest first, the same order the index uses.
    const order = POSTS.map((slug) => body.indexOf(slug));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(body).toContain('<language>en</language>');
  });

  test('carries the lede rather than the whole post', async ({ request }) => {
    // A full-content feed duplicates the site into a document the site does not render,
    // and means sanitising rendered MDX. Gate B.
    const body = await (await request.get('/blog/rss.xml')).text();
    expect(body).toContain('every new release from your favorite artists, the moment they drop');
    expect(body).not.toContain('What it is not');
  });
});

test.describe('the covers', () => {
  test('white type clears AA against the brightest light behind it', async ({ page }) => {
    /*
     * `scripts/check-contrast.mjs` scores every *declared* foreground/background pairing in
     * the token set. A hook sitting on a bloom is not one of those: the background is a
     * composite of three drifting radial gradients over a plum gradient, and no token
     * describes what comes out. So it is measured from the rendered cover instead.
     *
     * **The type is hidden before the sample.** The first version of this measurement left
     * it visible and filtered out "bright" pixels, which quietly measured the glyphs' own
     * antialiasing and reported 1.3:1 for every palette.
     *
     * Measured at the brightest single pixel inside the hook's own box, which is the real
     * worst case and not an average. Amber is the tightest at ~4.8:1.
     */
    for (const slug of POSTS) {
      await page.setViewportSize({ width: 1200, height: 600 });
      await page.goto(`/blog/og/${slug}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.currentTime = 0;
          animation.pause();
        }
      });
      const band = await page.evaluate(() => {
        const hook = document.querySelector('.cover-hook') as HTMLElement;
        const stage = document.querySelector('[data-og-stage]') as HTMLElement;
        const h = hook.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        hook.style.visibility = 'hidden';
        return {
          x: Math.round(h.left - s.left),
          y: Math.round(h.top - s.top),
          w: Math.round(h.width),
          h: Math.round(h.height),
        };
      });
      const shot = await page.locator('[data-og-stage]').screenshot({ type: 'png' });
      const contrast = await page.evaluate(
        async ([encoded, box]) => {
          const image = await new Promise<HTMLImageElement>((resolve) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.src = `data:image/png;base64,${encoded as string}`;
          });
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const b = box as { x: number; y: number; w: number; h: number };
          const pixels = context.getImageData(b.x, b.y, b.w, b.h).data;
          const channel = (value: number): number => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          const luminance = (r: number, g: number, bl: number): number =>
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
          let brightest = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const l = luminance(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
            if (l > brightest) brightest = l;
          }
          return (luminance(250, 250, 250) + 0.05) / (brightest + 0.05);
        },
        [shot.toString('base64'), band] as const,
      );
      expect(contrast, `${slug}'s hook against its own bloom`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('the motion budget', () => {
  test('no blog route ships GSAP, ScrollTrigger or Lenis', async ({ page }) => {
    // The precedent `/waitlist` set and 8.12's open finding about `/pricing` applied at
    // authoring time rather than after.
    for (const route of ['/blog', `/blog/${POSTS[0]}`, '/blog/tags/product']) {
      const requests: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      await page.goto(route, { waitUntil: 'networkidle' });
      const motion = requests.filter((url) => /gsap|ScrollTrigger|lenis/i.test(url));
      expect(motion, `${route} should ship no motion stack`).toEqual([]);
      page.removeAllListeners('request');
    }
  });
});

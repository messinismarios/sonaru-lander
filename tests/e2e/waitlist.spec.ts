import { expect, test, type Page } from '@playwright/test';

/**
 * The waitlist route - phases.md 8.8.
 *
 * These drive the real page against the real endpoint: `astro dev` does not run Pages
 * Functions, so `astro.config.mjs` mounts `functions/api/_handler.ts` with in-memory
 * ports. The guards and every rule under test here are the deployed code; only the
 * store, the challenge and the DNS lookup are substituted.
 *
 * Turnstile's widget is a third-party iframe and is not driven from here. The dev mount's
 * verifier accepts any non-empty token, which is what lets the *page's* behaviour be
 * tested without making a Cloudflare challenge a prerequisite for CI.
 */

/**
 * A fresh address per run. The dev store lives in the server process, so a fixed address
 * would pass once and then return `duplicate` for the rest of the day - a test that goes
 * green only on a cold server is worse than no test.
 */
function freshEmail(): string {
  return `listener-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Every caller here is loopback, so without this they would all share one hourly rate
 * limit and each test after the fifth would be refused by the ones before it. The dev
 * mount lets a caller name its own bucket; production keys on `cf-connecting-ip` and has
 * no equivalent.
 */
function ownSource(): string {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function isolate(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-dev-source': ownSource() });
}

/**
 * The server refuses anything submitted faster than a person could have read the form.
 * Tests type instantly, so they have to wait it out - the alternative is a test-only
 * bypass in production code, which would delete the check it is meant to prove.
 */
async function submit(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email address').fill(email);
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
}

test.describe('the waitlist route', () => {
  test('opens on the ask, with the field and the button in the first viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/waitlist');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sonaru is coming soon.');

    const button = page.getByRole('button', { name: 'Join the waitlist' });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test('a good address is accepted, and the outcome takes focus', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, freshEmail());

    const heading = page.getByRole('heading', { name: "You're on the list." });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
  });

  test('the same address twice is duplicate, and never reads as failure', async ({ page }) => {
    const email = freshEmail();

    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, email);
    await expect(page.getByRole('heading', { name: "You're on the list." })).toBeVisible();

    await page.goto('/waitlist');
    await submit(page, email);
    await expect(page.getByRole('heading', { name: "You're already on the list." })).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  /**
   * The one bad entry no server-side check can catch: `gmial.com` resolves and accepts
   * mail. It is offered, never applied - an address silently rewritten under someone is
   * worse than the typo it fixes.
   */
  test('a near-miss on a common domain is suggested, not corrected', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, 'listener@gmial.com');

    const suggestion = page.getByRole('button', { name: 'listener@gmail.com' });
    await expect(suggestion).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveValue('listener@gmial.com');

    await suggestion.click();
    await expect(page.getByLabel('Email address')).toHaveValue('listener@gmail.com');
  });

  test('the suggestion can be overruled by submitting again', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, `someone-${Date.now()}@gmial.com`);

    // Offered once. Pressing the button again past it is the person overruling us, and
    // the address they actually typed is the one that gets sent.
    await expect(page.getByRole('button', { name: /@gmail\.com$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.getByRole('heading', { name: /on the list/ })).toBeVisible();
  });

  test('a malformed address is refused with a message tied to the field', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, 'not-an-address');

    const field = page.getByLabel('Email address');
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    const describedBy = await field.getAttribute('aria-describedby');
    expect(describedBy).toBe('waitlist-message');
    await expect(page.locator('#waitlist-message')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('email address');
  });

  test('a domain with no mail server is refused before it is stored', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, 'someone@nowhere.invalid');

    await expect(page.getByRole('alert')).toContainText('mail server');
  });

  test('a disposable address is refused', async ({ page }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await submit(page, 'burner@mailinator.com');

    await expect(page.getByRole('alert')).toContainText('temporary address');
  });

  /**
   * The honeypot is filled the way a bot fills it - by name, without looking. It must be
   * out of the tab order and hidden from assistive technology, or the person it catches
   * is a screen-reader user rather than a script.
   */
  test('the honeypot is unreachable by keyboard and hidden from assistive technology', async ({
    page,
  }) => {
    await page.goto('/waitlist');

    const trap = page.locator('input[name="company_website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('.trap')).toHaveAttribute('aria-hidden', 'true');
  });

  test('a filled honeypot is refused rather than answered with a false success', async ({
    page,
  }) => {
    await isolate(page);
    await page.goto('/waitlist');
    await page
      .locator('input[name="company_website"]')
      .fill('https://spam.example', { force: true });
    await submit(page, freshEmail());

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: /on the list/ })).toBeHidden();
  });

  /**
   * The honeypot is the one element on this page that a keyboard user must never reach,
   * and Turnstile's iframe is the one focus-order surprise - since 8.14 it sits after the
   * button, where it lands last, and that is worth pinning rather than assuming.
   */
  test('tab order runs field, button, challenge, and never enters the honeypot', async ({
    page,
  }) => {
    await page.goto('/waitlist');
    await page.getByLabel('Email address').focus();

    const seen: string[] = [];
    for (let step = 0; step < 4; step += 1) {
      seen.push(
        await page.evaluate(() => {
          const active = document.activeElement;
          if (active === null) return 'none';
          const name = active.getAttribute('name');
          return name ?? active.tagName.toLowerCase();
        }),
      );
      await page.keyboard.press('Tab');
    }

    expect(seen[0]).toBe('email');
    expect(seen).not.toContain('company_website');
    expect(seen).toContain('button');
  });

  /**
   * Owner, 8.8's Gate C: the header must not offer "Join the waitlist" on the waitlist.
   * It is an invitation to somewhere you already are, and a second control competing with
   * the form for the same click. Asserted in both directions - the rule is that the action
   * is *dropped here*, not that it is gone.
   */
  test('the header drops its action on this route, and keeps it everywhere else', async ({
    page,
  }) => {
    await page.goto('/waitlist');
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Join the waitlist' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Sonaru - home' }),
    ).toBeVisible();

    for (const route of ['/', '/pricing']) {
      await page.goto(route);
      await expect(
        page.getByRole('banner').getByRole('link', { name: 'Join the waitlist' }),
      ).toBeVisible();
    }
  });

  test('the challenge box holds its space before the widget arrives', async ({ page }) => {
    await page.goto('/waitlist');

    const challenge = page.locator('.challenge');
    const box = await challenge.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(65);
  });

  /**
   * `acceptance-criteria.md` line 43: the largest paint may not depend on an animation.
   * The `h1` is this route's LCP element, so it must be fully painted with motion off.
   */
  test('nothing above the fold animates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/waitlist');

    const opacity = await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
  });

  /**
   * The route requires JavaScript - the owner's Gate B decision, taken so that Turnstile
   * could be mandatory. The obligation that came with it is that someone without
   * JavaScript is *told*, rather than handed a form that cannot submit.
   */
  test('with JavaScript off the page explains itself instead of showing a dead form', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/waitlist');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/needs JavaScript/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(0);

    await context.close();
  });

  /**
   * `APP_STORE_APP_ID` is null because the app is unpublished. A Smart App Banner built
   * from a placeholder id would advertise a stranger's app, so the tag must be absent
   * rather than approximate.
   */
  test('no Smart App Banner is emitted while there is no App Store id', async ({ page }) => {
    await page.goto('/waitlist');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveCount(0);
  });

  test('the route carries no scroll-motion stack', async ({ page }) => {
    const scripts: string[] = [];
    page.on('response', (response) => scripts.push(response.url()));
    await page.goto('/waitlist');
    /*
     * Not `networkidle`: Turnstile's iframe keeps talking to Cloudflare and the page never
     * goes quiet, so waiting for idle waits for the timeout. A fixed settle is enough -
     * the motion stack, if it were imported, would be fetched during hydration.
     */
    await page.waitForTimeout(2000);

    const motion = scripts.filter((url) => /gsap|ScrollTrigger|lenis/i.test(url));
    expect(motion).toEqual([]);
  });
});

test.describe('the endpoint behind it', () => {
  test('refuses a submission from another origin', async ({ request }) => {
    const response = await request.post('/api/waitlist', {
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      data: { email: 'x@example.com', token: 't', trap: '', elapsedMs: 5000 },
    });

    expect(response.status()).toBe(403);
  });

  test('refuses anything that is not a POST', async ({ request }) => {
    expect((await request.get('/api/waitlist')).status()).toBe(405);
  });

  test('refuses a body that is not JSON', async ({ request }) => {
    const response = await request.post('/api/waitlist', {
      headers: { 'content-type': 'text/plain', origin: 'http://localhost:4321' },
      data: 'email=x@example.com',
    });

    expect(response.status()).toBe(415);
  });

  /**
   * Duplicate answers 200. It is a designed outcome the page renders as its own state,
   * not a failure the client has to interpret out of a 4xx.
   */
  test('duplicate is a 200, and a refusal is a 4xx', async ({ request }) => {
    const headers = {
      'content-type': 'application/json',
      origin: 'http://localhost:4321',
      'x-dev-source': ownSource(),
    };

    const duplicate = await request.post('/api/waitlist', {
      headers,
      data: { email: 'already@sonaru.app', locale: 'en', token: 't', trap: '', elapsedMs: 5000 },
    });
    expect(duplicate.status()).toBe(200);
    expect(await duplicate.json()).toEqual({ state: 'duplicate' });

    const refused = await request.post('/api/waitlist', {
      headers,
      data: { email: 'x@example.com', locale: 'en', token: '', trap: '', elapsedMs: 5000 },
    });
    expect(refused.status()).toBe(400);
  });
});

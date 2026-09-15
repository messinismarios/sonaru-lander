import { expect, test } from '@playwright/test';

/**
 * The hero's accessibility contract, as behaviour rather than as intent.
 *
 * `design-system.md` §6 is categorical that "a screen reader must never have to walk a
 * fake app", and `acceptance-criteria.md` §4 turns that into a launch condition. The
 * device is a plausible place for that to rot: it is the one part of the page that looks
 * like an interface without being one, so anything focusable or announced inside it is a
 * defect however good it looks.
 */
test.describe('hero - accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the device is hidden from assistive technology and holds nothing focusable', async ({
    page,
  }) => {
    // Every device on the route, not the first one. Act three (phases.md 8.5) added a
    // second - the lock screen - and the original single-element assertion started failing
    // on Playwright's strict mode rather than on the property it was guarding, which would
    // have been an easy thing to "fix" by narrowing the locator back to one. `design-system.md`
    // §6's rule is about every device mockup on the page, so the assertion now is too.
    const devices = page.locator('[data-device]');
    const count = await devices.count();
    expect(count, 'no device mockup was found on the route').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const device = devices.nth(index);
      await expect(device).toHaveAttribute('aria-hidden', 'true');

      const focusable = device.locator(
        'a, button, input, select, textarea, [tabindex], [contenteditable]',
      );
      expect(await focusable.count(), `device mockup ${index} contains a focusable element`).toBe(
        0,
      );
    }
  });

  test('tab order runs skip link, header, then the call to action, and never enters the device', async ({
    page,
  }) => {
    const order: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const active = document.activeElement;
          if (!active || active === document.body) return 'body';
          const insideDevice = active.closest('[data-device]') !== null;
          return `${insideDevice ? 'DEVICE:' : ''}${active.textContent?.trim() ?? active.tagName}`;
        }),
      );
    }

    // Skip link, then the header's brand and its action, then the hero's. Since Gate C
    // rev 13 the fixed header owns the conversion, which frees the hero to offer the
    // thing a visitor wants next instead of competing with it.
    expect(order.slice(0, 4)).toEqual([
      'Skip to content',
      'Sonaru',
      'Join the waitlist',
      'See how it works',
    ]);
    expect(order.some((entry) => entry.startsWith('DEVICE:'))).toBe(false);
  });

  test('there is exactly one h1 and it carries the headline', async ({ page }) => {
    // Scoped to <main>: Playwright's locators pierce shadow DOM, and in dev the Astro
    // toolbar contributes an h1 of its own that is not part of the document outline.
    const headings = page.locator('main h1');
    await expect(headings).toHaveCount(1);
    // The device's own release titles are h3s inside the aria-hidden subtree; the page's
    // heading outline must not be built out of the mockup's copy.
    // The visually hidden full stop (SEO audit H3-h1) is part of the heading's text.
    await expect(headings).toHaveText(/They dropped it\.\s*You always catch it/);
  });

  /**
   * The two risks 8.2's Gate B carried out of the pinned redesign.
   *
   * The device is sticky and grows to cover most of the viewport, so it is physically
   * capable of sitting on top of a focused control - and `Tab` scrolls its target into
   * view, which on a section with this much scroll travel can land the page anywhere. A
   * call to action that is focused but covered, or focused but off screen, fails WCAG 2.2
   * regardless of how good the animation looks.
   */
  test('the call to action stays visible and on top when focused', async ({ page }) => {
    for (const label of ['See how it works']) {
      // Not scoped to `.hero` any more: the CTA moved to act one (owner, 2026-09-03), which
      // is a *scroll-revealed, pinned* section - strictly harder for this assertion than the
      // hero was, since the control starts invisible and its layout position sits near the
      // bottom of a very tall section. The assertions below are unchanged and are what
      // caught that; see `Problem.astro`'s `.actions` for the fix they forced.
      const cta = page.getByRole('link', { name: label });
      await cta.focus();

      // Focusing a control this far down the page starts a *smooth* scroll (`Base.astro`
      // sets `scroll-behavior`), so "focused and visible" is a settled state rather than an
      // instantaneous one - read immediately, this sees `scrollY === 0` and fails on a page
      // that is behaving correctly. Wait for the scroll to actually stop, then assert
      // exactly what was asserted before.
      await page.waitForFunction(
        () =>
          new Promise<boolean>((resolve) => {
            // Stable across several consecutive frames, not merely two: the smooth scroll
            // has not started yet on the frame right after `focus()`, so a two-frame check
            // reports "settled" at `scrollY === 0` - which is the very state this is meant
            // to scroll away from.
            let frames = 0;
            let previous = -1;
            const tick = (): void => {
              frames = scrollY === previous ? frames + 1 : 0;
              previous = scrollY;
              if (frames >= 8) resolve(true);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        undefined,
        { timeout: 5_000 },
      );

      const state = await cta.evaluate((node) => {
        const box = node.getBoundingClientRect();
        // What is actually painted at the control's centre. If the growing device is
        // over it, this returns something inside the device rather than the link.
        const atCentre = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return {
          inViewport: box.top >= 0 && box.bottom <= innerHeight,
          coveredByDevice: atCentre?.closest('[data-device]') !== null && atCentre !== null,
          hitsSelf: node.contains(atCentre) || node === atCentre,
        };
      });

      expect(state.inViewport, `"${label}" is focused but outside the viewport`).toBe(true);
      expect(state.coveredByDevice, `"${label}" is focused but covered by the device`).toBe(false);
      expect(state.hitsSelf, `"${label}" is focused but something else is painted over it`).toBe(
        true,
      );
    }
  });

  test('under reduced motion the feed rests on a release and nothing is mid-transition', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForTimeout(1200);

    const state = await page.evaluate(() => {
      const track = document.querySelector('[data-feed-track]') as HTMLElement;
      const tints = Array.from(document.querySelectorAll('[data-tint]')) as HTMLElement[];
      return {
        feedY: getComputedStyle(track).getPropertyValue('--feed-y').trim(),
        opacities: tints.map((t) => Number(getComputedStyle(t).opacity)),
      };
    });

    // A whole number of screens: resting between two releases would be the "stuck
    // mid-state" that design-system.md §5 explicitly forbids.
    expect(state.feedY).toMatch(/^-?\d+(\.0+)?%$/);
    // Math.abs, because a track parked at -0% otherwise fails Object.is against 0.
    expect(Math.abs(Number.parseFloat(state.feedY) % 100)).toBe(0);

    // Exactly one tint at full strength, the rest off - no half-finished crossfade.
    expect(state.opacities.filter((o) => o === 1)).toHaveLength(1);
    expect(state.opacities.filter((o) => o === 0)).toHaveLength(state.opacities.length - 1);

    await context.close();
  });
});

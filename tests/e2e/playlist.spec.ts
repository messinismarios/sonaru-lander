import { expect, test, type Page } from '@playwright/test';
import { scrollToAndSettle, waitForPinnedMotion, waitForScrubbedMotion } from '../motion-ready';

/**
 * The auto-add act's scroll contract - phases.md 8.6.
 *
 * Two things are worth guarding, and they are the two the plan is built on:
 *
 * 1. **The arrival is not scrubbed.** `--playlist-row` is written by a tween that runs to
 *    completion once a threshold is crossed. If it were scrubbed, a visitor could drag the
 *    row half into the playlist and hold it there - the section's whole claim, held in a
 *    state that contradicts it.
 * 2. **The idle beat holds.** `.travel.idle` drives nothing at all - the scroll a visitor
 *    spends on a list that was already there, which is what makes the arrival read as
 *    something happening *to* an existing playlist.
 *
 * The close and the CTA that used to be asserted here moved to `notify.spec.ts` on
 * 2026-09-04 with the section swap, and so did the "this is the page's last frame" claim.
 *
 * Plus the Gate A failure condition, which is not a matter of taste: if the frame could be
 * mistaken for a Spotify screenshot the section fails, so the absence of service marks and
 * player chrome is asserted rather than reviewed.
 */

interface Budget {
  readonly top: number;
  readonly travel: number;
  readonly idle: number;
  readonly arrive: number;
}

async function budget(page: Page): Promise<Budget> {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
    const pin = document.querySelector('[data-playlist-pin]') as HTMLElement;
    return {
      top: stage.offsetTop,
      travel: stage.offsetHeight - pin.offsetHeight,
      idle: (document.querySelector('[data-playlist-idle]') as HTMLElement).offsetHeight,
      arrive: (document.querySelector('[data-playlist-arrive]') as HTMLElement).offsetHeight,
    };
  });
}

/** The row's arrival switch - see `scrollToAndSettle` in `tests/motion-ready.ts`. */
const PROBES = [{ selector: '[data-playlist-stage]', properties: ['--playlist-row'] }] as const;

async function stateAt(page: Page, offset: number) {
  await scrollToAndSettle(page, offset, PROBES);
  return page.evaluate(() => {
    const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
    const style = getComputedStyle(stage);
    return { row: Number(style.getPropertyValue('--playlist-row')) };
  });
}

test.describe('the auto-add act', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Act one's pin is 2100px of document above this section, so `offsetTop` is wrong until
    // it exists; and this section's own timeline must have run at least once before its
    // properties mean anything (`motion-ready.ts`). `--playlist-row` is the discriminator
    // now that the close is gone - it is the one property both motion branches write.
    await waitForPinnedMotion(page);
    await waitForScrubbedMotion(page, '[data-playlist-stage]', '--playlist-row');
  });

  test('the playlist stands still for the whole of the idle beat', async ({ page }) => {
    const { top, idle } = await budget(page);

    // Every sample across the beat, not just its ends: the spacer's entire purpose is that
    // nothing happens across it, and a re-tune that let the arrival bleed backwards into it
    // would still pass an endpoints-only check.
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.98]) {
      const state = await stateAt(page, top + idle * fraction);
      expect(state.row, `the row started landing ${fraction} into the idle beat`).toBeCloseTo(0, 2);
    }
  });

  test('the row arrives whole, never part-way', async ({ page }) => {
    const { top, idle, arrive } = await budget(page);

    // Sample densely across the arrive track and let each sample settle. Every reading must
    // be fully absent or fully landed - never parked between the two, which is exactly what
    // a scrubbed row would produce and what this test exists to forbid.
    for (let step = 0; step <= 10; step += 1) {
      const state = await stateAt(page, top + idle + (arrive * step) / 10);
      const settled = state.row < 0.02 || state.row > 0.98;
      expect(
        settled,
        `the row was resting part-way in at ${state.row.toFixed(2)} - is it being scrubbed?`,
      ).toBe(true);
    }
  });

  test('the arrival is positional - scrolling back up takes the row away again', async ({
    page,
  }) => {
    const { top, idle, arrive } = await budget(page);

    expect((await stateAt(page, top + idle + arrive)).row).toBeCloseTo(1, 1);

    // Back to the idle beat: it must leave the way it came, not latch.
    const back = await stateAt(page, top + idle * 0.5);
    expect(back.row, 'the row latched and never left').toBeCloseTo(0, 1);

    // And forward again, to prove the first arrival was not a one-shot.
    const again = await stateAt(page, top + idle + arrive);
    expect(again.row, 'the row only ever lands once').toBeCloseTo(1, 1);
  });

  test('the section holds its composition through the trailing rest', async ({ page }) => {
    const { top, travel } = await budget(page);

    // The hand-over into the notification act. Whatever the visitor is looking at when this
    // section releases its pin has to be the composition it built, not one already leaving.
    const state = await stateAt(page, top + travel);
    expect(state.row, 'the row left before the section did').toBeCloseTo(1, 1);
  });

  test('nothing is left of the close the CTA took with it', async ({ page }) => {
    // The close moved to the notification act with the CTA (owner, 2026-09-04). This is the
    // assertion that it moved rather than being duplicated: a second copy of the same
    // composition change would be two sections competing to end the page.
    const leftovers = await page.evaluate(() => ({
      cta: document.querySelectorAll('.playlist [data-playlist-cta]').length,
      closeTrack: document.querySelectorAll('.playlist [data-playlist-close-track]').length,
    }));

    expect(leftovers.cta, 'the auto-add act still carries a CTA').toBe(0);
    expect(leftovers.closeTrack, 'the auto-add act still pays scroll for a close').toBe(0);
  });

  test('the page never scrolls horizontally across the section', async ({ page }) => {
    const { top, travel } = await budget(page);

    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollToAndSettle(page, top + travel * fraction, PROBES);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        overflow.scrollWidth,
        `the document is ${overflow.scrollWidth - overflow.clientWidth}px too wide at ${fraction} of the auto-add act`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });

  test('the row that lands is the release the notification announces', async ({ page }) => {
    // The page's spine is one release end to end - missed, listed, filed, announced - and it
    // only holds if all four sections read the same record. If they ever drift, the page
    // quietly tells four different stories.
    const landed = await page.evaluate(() => {
      const row = document.querySelector('.playlist [data-playlist-landing]');
      return {
        artist: row?.querySelector('.artist')?.textContent?.trim() ?? '',
        title: row?.querySelector('.title')?.textContent?.trim() ?? '',
      };
    });
    // The lock screen splits the release across the banner's two lines: `.title` is the
    // notification's own title and carries the *artist*, and the release title sits in the
    // body beneath it ("just released Nightshift"). Both are asserted, because matching only
    // one would let the other drift.
    const announced = await page.evaluate(() => {
      const banner = document.querySelector('.notify .banner');
      return {
        artist: banner?.querySelector('.title')?.textContent?.trim() ?? '',
        text: banner?.textContent ?? '',
      };
    });

    expect(landed.artist, 'no row lands in the playlist').not.toBe('');
    expect(announced.artist, 'the lock screen announces nothing').not.toBe('');
    expect(announced.artist).toBe(landed.artist);
    expect(
      announced.text,
      'the notification announces a different release than the one that is filed',
    ).toContain(landed.title);
  });

  test('the arriving row is marked and the settled rows are not', async ({ page }) => {
    // Owner, Gate C rev 2: without a mark the landing reads as the list scrolling by one
    // rather than as one release being *put there*, which is the section's whole claim. The
    // mark is a plum wash rather than an "Added" chip - chosen over the chip because a chip
    // is a word to translate at 8.11 and a piece of product chrome in a list whose Gate A
    // guard is that it carries none.
    //
    // Asserted as a *difference* rather than against a colour value: the point is that the
    // arriving row is not painted like the rows it lands among, and pinning the exact
    // gradient here would make it a second, competing definition of a token that lives in
    // `Playlist.astro`.
    const paint = await page.evaluate(() => {
      const at = (selector: string) => {
        const row = document.querySelector(`${selector} .row`);
        return row ? getComputedStyle(row).backgroundImage : '';
      };
      return {
        landing: at('.playlist [data-playlist-landing]'),
        settled: at('.playlist [data-playlist-settled]'),
      };
    });

    expect(paint.settled, 'a settled row has picked up a background of its own').toBe('none');
    expect(paint.landing, 'the arriving row is painted like every other row').not.toBe('none');
  });

  test('the frame carries no service chrome - the Gate A failure condition', async ({ page }) => {
    // Not a matter of taste: Gate A makes "it could be mistaken for a Spotify screenshot" a
    // standing failure on its own. Spotify and Apple Music appear in this section as words
    // in the sub-line and nowhere else - never as marks, never as colour, and never inside
    // the list itself.
    const list = await page.evaluate(
      () => document.querySelector('.playlist .viewport')?.textContent ?? '',
    );

    for (const forbidden of ['Spotify', 'Apple Music', 'Apple', 'Premium']) {
      expect(list, `the playlist frame names ${forbidden}`).not.toContain(forbidden);
    }

    // No player transport, no artwork the visitor could mistake for a service's own UI.
    const chrome = await page.evaluate(() => {
      const viewport = document.querySelector('.playlist .viewport');
      return {
        controls: viewport?.querySelectorAll('button, svg, [role="button"]').length ?? -1,
        images: viewport?.querySelectorAll('img').length ?? 0,
      };
    });
    expect(chrome.controls, 'the playlist grew a control of some kind').toBe(0);
    expect(chrome.images, 'the playlist rows lost their covers').toBeGreaterThan(0);
  });

  test('the fake playlist is hidden from assistive technology', async ({ page }) => {
    // Fictional artists and titles are a depiction, not content - the same call
    // `design-system.md` §6 makes for the device mockup. The headline and sub-line beside
    // the list are what a screen reader gets.
    const hidden = await page.evaluate(
      () => document.querySelector('.playlist .viewport')?.getAttribute('aria-hidden') ?? null,
    );
    expect(hidden, 'a screen reader is walked through a playlist that does not exist').toBe('true');
  });

  test.describe('below md', () => {
    // 8.14c (owner): no pin, and the row lands soon after the section comes into view
    // (round 3: 12% of the way in). Reloads at 390, where act one has no pin to wait for.
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await waitForScrubbedMotion(page, '[data-playlist-stage]', '--playlist-row');
    });

    /** The scroll offset at which the viewport's middle is `fraction` of the way in. */
    async function through(page: Page, fraction: number) {
      return page.evaluate((f) => {
        const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
        const top = stage.getBoundingClientRect().top + window.scrollY;
        return top + stage.offsetHeight * f - window.innerHeight / 2;
      }, fraction);
    }

    test('the section is not pinned and not a screen tall', async ({ page }) => {
      const state = await page.evaluate(() => ({
        position: getComputedStyle(document.querySelector('[data-playlist-pin]') as HTMLElement)
          .position,
        height: (document.querySelector('[data-playlist-stage]') as HTMLElement).offsetHeight,
      }));
      expect(state.position).not.toBe('sticky');
      expect(state.height, 'the section is still a full screen').toBeLessThan(844);
    });

    test('the copy is always there; only the row arrives, early in the section', async ({
      page,
    }) => {
      const copy = () =>
        page.evaluate(() =>
          Number(
            getComputedStyle(document.querySelector('[data-playlist-copy]') as Element).opacity,
          ),
        );

      expect((await stateAt(page, await through(page, 0.02))).row, 'landed early').toBe(0);
      expect(await copy(), 'the copy waits for the row').toBe(1);
      expect((await stateAt(page, await through(page, 0.2))).row, 'never landed').toBe(1);
      expect((await stateAt(page, await through(page, 0.02))).row, 'latched').toBe(0);
    });
  });

  test('under reduced motion the section rests on its conclusion', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForScrubbedMotion(page, '[data-playlist-stage]', '--playlist-row');

    const state = await page.evaluate(() => {
      const stage = document.querySelector('[data-playlist-stage]') as HTMLElement;
      const stack = document.querySelector('.playlist [data-playlist-stack]') as HTMLElement;
      return {
        row: Number(getComputedStyle(stage).getPropertyValue('--playlist-row')),
        playlistOpacity: Number(getComputedStyle(stack).opacity),
      };
    });

    expect(state.row, 'the row never lands under reduced motion').toBe(1);
    expect(state.playlistOpacity, 'the playlist is dimmed out under reduced motion').toBeCloseTo(
      1,
      2,
    );

    await context.close();
  });
});

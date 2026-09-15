/**
 * The copy buttons on `/press`, wired at runtime.
 *
 * **This is a module rather than the body of the component's `<script>` for one measured
 * reason.** Astro *inlines* a hoisted script that imports nothing - the built page carried
 * `<script type="module">` with 614 bytes of code in it - and
 * `acceptance-criteria.md` §10 requires a Content-Security-Policy **without
 * `unsafe-inline`**. Under that header the inlined version would be blocked, the buttons
 * would never appear, and the only clue would be a console error on a page that otherwise
 * looks finished. A script with an import is emitted as a file the policy can allow with
 * `script-src 'self'`. Gate B predicted the external file and was wrong about why it would
 * happen; the fix is the prediction made true rather than the claim quietly dropped.
 *
 * The behaviour itself is in `src/components/press/CopyBlock.astro`'s header.
 */

/** How long "Copied" stands before the live region goes quiet again. */
const COPIED_FOR = 2000;

export function wireCopyButtons(): void {
  /*
   * `navigator.clipboard` is undefined outside a secure context - which includes the LAN
   * URL from `npm run dev:host`, the one a Gate C check on a real phone uses. No API, no
   * buttons: the text stays on the page and stays selectable, which is what a visitor
   * without a working clipboard needs anyway.
   */
  if (navigator.clipboard === undefined) return;

  for (const block of document.querySelectorAll<HTMLElement>('[data-copy]')) {
    const value = block.dataset['copyValue'];
    const label = block.dataset['copyLabel'];
    /*
     * The button's three words, handed down as attributes by `CopyBlock.astro` (8.11a).
     * This file runs in the browser: an import of `src/i18n/` here would put every
     * locale's copy of them into the bundle every visitor downloads.
     */
    const idle = block.dataset['copyIdle'];
    const done = block.dataset['copyDone'];
    const manual = block.dataset['copyManual'];
    const status = block.querySelector<HTMLElement>('.status');
    const tools = block.querySelector<HTMLElement>('.tools');
    if (value === undefined || label === undefined || status === null || tools === null) continue;
    if (idle === undefined || done === undefined || manual === undefined) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = idle;
    button.setAttribute('aria-label', label);
    /* Before the live region, so the tab order is button → announcement → next block. */
    tools.insertBefore(button, status);

    let timer: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        /*
         * A permissions policy or a denied prompt - the visitor's browser saying no.
         * Saying "Copied" anyway would be a lie about what is on their clipboard, and the
         * text is still on the page to select by hand.
         */
        status.textContent = manual;
        return;
      }
      status.textContent = done;
      clearTimeout(timer);
      timer = setTimeout(() => {
        status.textContent = '';
      }, COPIED_FOR);
    });
  }
}

/**
 * Rests the bloom fields whenever their drift costs frames and buys nothing - 8.14, on the
 * owner's report that the home route's motion ran at a low frame rate on a phone.
 *
 * Every act carries its own `BloomField`: three orbs drifting forever on their own
 * compositing layers under `mix-blend-mode: screen`, so every frame an orb moves, the
 * overlap has to be blended again. Two cases are answered here, and `BloomField.astro`
 * answers the attributes they set:
 *
 * - **A field more than half a viewport away** is marked `data-offscreen`: hidden, so its
 *   layers stop being drawn, and its drift paused. Measured on `/` at 390x844 @3x, all
 *   fifteen orbs held drawn layers at every scroll offset, while at most two acts are ever
 *   on screen. The margin keeps it invisible - a field is back before it can be seen.
 * - **While the page is scrolling**, every field is marked `data-scrolling` and its drift
 *   paused until `SCROLL_IDLE` after the last scroll event. Measured with the GPU disabled
 *   in Chromium, as a stand-in for a phone's: scrolling the hero, the playlist and the
 *   notification dropped a frame in ten with the drift running, and none with it paused.
 *   The drift's periods are 25-43s, so a second of scroll holds it by a few degrees of an
 *   orbit - nothing a person scrolling can see stop.
 *
 * Both pause rather than stop, so a field resumes from the pose it left.
 *
 * @param root where to look for fields. Defaults to the document.
 * @returns a teardown that removes the observer, the listener and any pending timer.
 */
import { SCROLL_IDLE } from './tokens';

export function restBlooms(root: ParentNode = document): () => void {
  const fields = Array.from(root.querySelectorAll<HTMLElement>('[data-bloom]'));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.toggleAttribute('data-offscreen', !entry.isIntersecting);
      }
    },
    { rootMargin: '50% 0px' },
  );
  for (const field of fields) observer.observe(field);

  let idle = 0;

  const settle = (): void => {
    idle = 0;
    for (const field of fields) field.removeAttribute('data-scrolling');
  };

  const scrolled = (): void => {
    if (idle === 0) {
      for (const field of fields) field.setAttribute('data-scrolling', '');
    } else {
      clearTimeout(idle);
    }
    idle = window.setTimeout(settle, SCROLL_IDLE * 1000);
  };

  addEventListener('scroll', scrolled, { passive: true });

  return () => {
    observer.disconnect();
    removeEventListener('scroll', scrolled);
    if (idle !== 0) clearTimeout(idle);
    settle();
  };
}

/**
 * A two-state custom property moved by a tween that always runs to completion.
 *
 * The mechanism behind every discrete event on the home route that is not act two's feed:
 * the notification banner (`notify.ts`) and the row landing in the playlist
 * (`playlist.ts`). Both used to carry their own copy of it; 8.14c gave each a mobile branch
 * that needs it too, and four copies of one mechanism is how they drift apart.
 *
 * **Why a tween and not a scrub.** A release either arrived or it did not. A scrubbed value
 * lets a visitor drag it half in and hold it there, which denies the one thing these
 * sections exist to say.
 *
 * A tween already in flight is killed rather than queued: unlike act two's feed there are
 * only two states, so the newest intent is the only one worth honouring - reversing
 * mid-arrival should turn around immediately, not finish arriving first.
 */
import { gsap } from 'gsap';

export interface Switch {
  /** Moves the property to `target` (0 or 1) over the full duration. */
  commit(target: number): void;
  /** Stops a tween in flight, for teardown. */
  kill(): void;
}

/**
 * @param stage the element the property is written on.
 * @param property the custom property, registered with `@property` by the section.
 * @param duration a `DURATION` token, in seconds.
 * @param ease a `GSAP_EASE` token.
 */
export function createSwitch(
  stage: HTMLElement,
  property: string,
  duration: number,
  ease: string,
): Switch {
  let settled = 0;
  let running: gsap.core.Tween | null = null;

  const write = (value: number): void => {
    stage.style.setProperty(property, String(value));
  };

  return {
    commit(target) {
      if (target === settled && running === null) return;
      running?.kill();

      const state = {
        at: Number(getComputedStyle(stage).getPropertyValue(property) || settled),
      };

      running = gsap.to(state, {
        at: target,
        duration,
        ease,
        onUpdate: () => write(state.at),
        onComplete: () => {
          settled = target;
          running = null;
          write(target);
        },
      });
    },

    kill() {
      running?.kill();
    },
  };
}

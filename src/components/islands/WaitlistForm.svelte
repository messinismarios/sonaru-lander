<script lang="ts">
  /**
   * The waitlist form - phases.md 8.8, and the "waitlist form
   * (idle/loading/success/error/duplicate)" entry in `design-system.md` §9's inventory.
   *
   * **This route requires JavaScript, which is unusual here and was decided rather than
   * drifted into.** `tech-stack.md` §6 asked for a form that converts with JavaScript
   * off, and `acceptance-criteria.md` §9 asked for Turnstile on every submission -
   * Turnstile cannot issue a token without JavaScript, so the two could not both be true.
   * The owner resolved it toward protection at 8.8's Gate B: *"use any and all required
   * methods to catch bad entries and bots."* The struck-through requirements are still
   * visible in both specs, and the page carries a `<noscript>` that explains rather than
   * a form that silently cannot submit.
   *
   * The same decision lifted this route's JavaScript budget, which is why this is a
   * Svelte island as `tech-stack.md` §1 always specified, rather than the ~1.5 KB of
   * vanilla the plan had proposed to dodge the 14.9 KB that 8.7 measured.
   *
   * **Every check here is a courtesy, not a control.** The client cannot be trusted about
   * anything, so `functions/api/_core.ts` repeats all of it server-side. What the client
   * adds is speed of feedback and one thing the server cannot do: catch a *typo*, which
   * is a bad entry that is otherwise perfectly valid.
   */
  import { turnstileSiteKey } from '../../config/launch';
  import type { Catalogue } from '../../i18n';

  /**
   * **Its words arrive as a prop and it imports no catalogue** (8.11a) - only the *type*,
   * which is erased at build. This is the site's most expensive island; an import of
   * `src/i18n/` here would ship every locale's copy of every refusal message to every
   * visitor, and nothing in the suite would have reported the regression.
   */
  interface Props {
    readonly strings: Catalogue['waitlist'];
  }

  const { strings }: Props = $props();

  type State = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

  const STATES: readonly State[] = ['idle', 'loading', 'success', 'duplicate', 'error'];

  /**
   * `?state=success` and friends, so all five can be opened directly at Gate C rather
   * than reached by submitting five times.
   *
   * **Read here rather than in the page's frontmatter**, because the route is prerendered
   * and Astro strips search params from `Astro.url` on a prerendered route - the version
   * that lived there returned `idle` for every state, and only the visual baselines
   * showed it. `import.meta.env.DEV` is a compile-time constant, so a production build
   * drops this entirely.
   */
  function reviewState(): State {
    // `window` is absent while the island is server-rendered, which it is since 8.14.
    if (!import.meta.env.DEV || typeof window === 'undefined') return 'idle';
    const requested = new URLSearchParams(window.location.search).get('state');
    return STATES.find((candidate) => candidate === requested) ?? 'idle';
  }

  const initialState = reviewState();

  let state = $state<State>(initialState);
  let email = $state('');
  let message = $state('');
  let suggestion = $state<string | null>(null);
  let form: HTMLFormElement | undefined = $state();
  let challengeEl: HTMLElement | undefined = $state();
  let token = $state('');

  const siteKey = turnstileSiteKey();

  /** When the form became available to a person. The server refuses anything faster. */
  const shownAt = Date.now();

  /**
   * What the server's refusal reasons say to the person who caused them. Anything not
   * listed is our fault rather than theirs, and gets the generic line - a message naming
   * an internal reason code would be true and useless.
   */
  const MESSAGES: Record<string, string> = strings.errors;

  const GENERIC = strings.errors.generic;

  /*
   * The dev-only `?state=error` entry has to carry a message, or the state it exists to
   * show is an empty box. The most common refusal is the one it shows.
   */
  if (initialState === 'error') message = MESSAGES['malformed-email'] ?? GENERIC;

  /** The domains a typo is worth guessing at. Anything rarer is not worth a false alarm. */
  const COMMON_DOMAINS = [
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'yahoo.com',
    'icloud.com',
    'me.com',
    'proton.me',
    'protonmail.com',
  ];

  function editDistance(a: string, b: string): number {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) rows[0]![j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        rows[i]![j] = Math.min(
          rows[i - 1]![j]! + 1,
          rows[i]![j - 1]! + 1,
          rows[i - 1]![j - 1]! + cost,
        );
      }
    }
    return rows[a.length]![b.length]!;
  }

  /**
   * A near-miss on a common domain is the one bad entry no server check can catch:
   * `gmial.com` resolves, accepts mail, and swallows it. Suggested rather than corrected -
   * an address silently rewritten under someone is worse than the typo.
   */
  function typoSuggestion(address: string): string | null {
    const at = address.lastIndexOf('@');
    if (at < 1) return null;

    const domain = address.slice(at + 1).toLowerCase();
    if (domain.length === 0 || COMMON_DOMAINS.includes(domain)) return null;

    const near = COMMON_DOMAINS.find((candidate) => editDistance(domain, candidate) <= 2);
    return near === undefined ? null : `${address.slice(0, at)}@${near}`;
  }

  function acceptSuggestion(): void {
    if (suggestion === null) return;
    email = suggestion;
    suggestion = null;
  }

  /**
   * **The widget is rendered explicitly, and that is not a style choice.** Turnstile's
   * implicit mode scans the document for `.cf-turnstile` when its script executes. This
   * island is `client:only`, so on a cold load the script arrives after hydration and
   * finds the element - and on a warm load the script is cached, runs first, finds
   * nothing, and no challenge is ever rendered. The form then waits for a token that
   * cannot arrive. It failed exactly one test in three that way before being caught.
   *
   * So the island renders the widget itself, once it is mounted and the API exists, and
   * owns the token rather than reading it out of an input Turnstile injected.
   */
  interface Turnstile {
    render(
      element: HTMLElement,
      options: {
        sitekey: string;
        theme: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
      },
    ): void;
  }

  const TOKEN_WAIT_MS = 10_000;

  function turnstileApi(): Turnstile | undefined {
    return (globalThis as { turnstile?: Turnstile }).turnstile;
  }

  $effect(() => {
    if (challengeEl === undefined) return;

    const target = challengeEl;
    let cancelled = false;

    const mount = (): void => {
      if (cancelled) return;
      const api = turnstileApi();
      if (api === undefined) {
        window.setTimeout(mount, 100);
        return;
      }
      api.render(target, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (issued) => {
          token = issued;
        },
        // A token expires after five minutes. An expired one is worse than none.
        'expired-callback': () => {
          token = '';
        },
        'error-callback': () => {
          token = '';
        },
      });
    };

    mount();
    return () => {
      cancelled = true;
    };
  });

  /**
   * Turnstile issues its token asynchronously, a second or two after the widget loads -
   * so a person who types quickly and hits the button lands on an empty token through no
   * fault of their own. Answering that with "the bot check hasn't loaded yet" is a real
   * error message for something that is about to fix itself.
   *
   * So the click is honoured instead of refused: the form goes to `loading`, which is
   * what it is doing, and waits. Only a widget that never arrives becomes an error.
   */
  async function waitForToken(): Promise<string> {
    const deadline = Date.now() + TOKEN_WAIT_MS;

    while (token.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return token;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (state === 'loading' || form === undefined) return;

    const near = typoSuggestion(email.trim());
    if (near !== null && near !== suggestion) {
      // Offered once. Submitting again past the suggestion is the person overruling us.
      suggestion = near;
      return;
    }
    suggestion = null;
    state = 'loading';

    const issued = await waitForToken();

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          locale: document.documentElement.lang || 'en',
          token: issued,
          trap: new FormData(form).get('company_website') ?? '',
          elapsedMs: Date.now() - shownAt,
        }),
      });

      const body: unknown = await response.json();
      const reported = (body as { state?: unknown; reason?: unknown } | null) ?? {};
      const reason = typeof reported.reason === 'string' ? reported.reason : '';

      if (reported.state === 'success' || reported.state === 'duplicate') {
        state = reported.state;
        return;
      }

      state = 'error';
      message = MESSAGES[reason] ?? GENERIC;
    } catch {
      /*
       * A network failure, not a refusal. Told apart from a server "no" on purpose: the
       * advice is different, and "check your connection" is useless when the connection
       * is fine.
       */
      state = 'error';
      message = strings.errors.network;
    }
  }

  /**
   * Focus follows the outcome. Without this, a screen-reader user is left on a button
   * that has just been replaced and never hears what happened to their submission.
   */
  /**
   * An action rather than `bind:this` plus an effect. The heading only exists once the
   * outcome replaces the form, and an action runs when its node is created - where a
   * component-level effect can run before the child's binding has been assigned, which is
   * how the first attempt at this focused nothing at all.
   */
  function takeFocus(node: HTMLElement): void {
    node.focus();
  }
</script>

<div class="waitlist" data-state={state}>
  {#if state === 'success' || state === 'duplicate'}
    <div class="outcome" role="status">
      <h2 use:takeFocus tabindex="-1">
        {state === 'success' ? strings.success.heading : strings.duplicate.heading}
      </h2>
      <p>
        {state === 'success' ? strings.success.body : strings.duplicate.body}
      </p>
    </div>
  {:else}
    <!--
      `method="dialog"` outside a dialog makes a native submission do nothing. The form is
      server-rendered and visible before it hydrates, and without this a submit in that
      moment would navigate to `?email=` - the address in the URL, the history and the logs.
      Once hydrated, `submit` prevents the native submission anyway.
    -->
    <form bind:this={form} method="dialog" onsubmit={submit} novalidate>
      <label class="field">
        <span class="label">{strings.field.label}</span>
        <input
          type="email"
          name="email"
          bind:value={email}
          autocomplete="email"
          required
          placeholder={strings.field.placeholder}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' ? 'waitlist-message' : undefined}
          disabled={state === 'loading'}
        />

        <!--
          Directly beneath the field, not at the foot of the component. `aria-describedby`
          ties them together for a screen reader either way; sight needs them adjacent, and
          the first version put the refusal below the reassurance line where it read as a
          footnote about something else.
        -->
        <!--
          A `span`, not a `p`: a label may only hold phrasing content (SEO audit H7). As a
          flex item of `.field` it is blockified either way, and `.message` sets no margin.
        -->
        <span id="waitlist-message" class="message" role="alert" hidden={state !== 'error'}>
          {state === 'error' ? message : ''}
        </span>
      </label>

      <!--
        The honeypot. Hidden from sight and from assistive technology, out of the tab
        order, and named after a field no person is being asked for. A filled one is
        refused *visibly* rather than answered with a false success - see `_core.ts`.
      -->
      <div class="trap" aria-hidden="true">
        <label>
          {strings.honeypot}
          <input type="text" name="company_website" tabindex="-1" autocomplete="off" />
        </label>
      </div>

      <button type="submit" disabled={state === 'loading'}>
        {state === 'loading' ? strings.submit.loading : strings.submit.idle}
      </button>

      {#if suggestion !== null}
        <p class="suggestion">
          {strings.suggestion.before}
          <button type="button" class="link" onclick={acceptSuggestion}>{suggestion}</button
          >{strings.suggestion.after}
        </p>
      {/if}

      <!--
        Space is reserved at the widget's rendered size before it arrives. An unreserved
        Turnstile box is the only CLS risk on this route.

        **Below the button, and last** (owner, 8.14): it is the one thing on the route that
        arrives after the page does, so nothing sits beneath it to be moved when it lands.
        Above the button, the button and everything after it jumped by the widget's height.
      -->
      <div class="challenge">
        <div bind:this={challengeEl}></div>
      </div>

      <!-- 
        The privacy link 8.8 recorded as owed to this section: the form asks for an
        address, so the sentence that says what happens to it is the sentence that should
        carry the link. It reuses the island's own `.link` class rather than the `Link`
        primitive, which is an Astro component and cannot be rendered inside an island.
      <p class="note">
        {strings.note.text}
        <a class="link" href="/privacy">{strings.note.link}</a>.
      </p>
      -->
    </form>
  {/if}

  <!--
    The second live region. An error is assertive, because it is asking for a correction
    now; progress is polite, because it is not.
  -->
  <p class="sr-only" role="status">
    {state === 'loading' ? strings.loadingStatus : ''}
  </p>
</div>

<style>
  .waitlist {
    width: 100%;
    max-width: 32rem;
  }

  /*
   * The island is server-rendered (8.14), so without JavaScript the HTML still holds a
   * complete form that can never submit - the dead form the route's `<noscript>` exists to
   * replace. It is withdrawn here instead, in CSS, which is the one thing that knows
   * scripting is off before anything paints.
   */
  @media (scripting: none) {
    .waitlist {
      display: none;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* A real label, not a placeholder standing in for one: a placeholder disappears the
   * moment someone starts typing, which is when they most need to know what the field is. */
  .label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-mute-200);
  }

  input[type='email'] {
    width: 100%;
    min-height: 48px;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-plum-700);
    border-radius: 12px;
    background: color-mix(in oklab, var(--color-ink-950) 55%, transparent);
    color: var(--color-white);
    font: inherit;
    font-size: var(--text-base);
    transition:
      border-color var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  input[type='email']::placeholder {
    color: var(--color-mute-400);
  }

  input[type='email']:focus-visible {
    outline: none;
    border-color: var(--color-plum-300);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-plum-300) 40%, transparent);
  }

  input[type='email'][aria-invalid='true'] {
    border-color: var(--color-bloom-amber);
  }

  input[type='email']:disabled {
    opacity: 0.6;
  }

  /* Off-screen rather than display:none - a field that is not rendered is not filled,
   * and a honeypot nothing fills catches nothing. */
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  .challenge {
    /*
     * The widget's rendered size, held before it loads - and held exactly, as a `height`
     * rather than a floor (8.14). The iframe is 65px but sits on a text baseline inside
     * Turnstile's shadow root, so the box it actually occupies measured 71px, and the
     * `min-height: 65px` that used to be here grew by 6px on arrival. The form is centred
     * in the frame, so that nudged everything above it up by half.
     */
    height: 71px;
  }

  button[type='submit'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: var(--spacing-3) var(--spacing-6);
    border: 1px solid var(--color-plum-500);
    border-radius: 999px;
    background: var(--color-plum-700);
    color: var(--color-white);
    font: inherit;
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
      background-color var(--dur-1) var(--ease-out),
      border-color var(--dur-1) var(--ease-out);
  }

  button[type='submit']:hover:not(:disabled) {
    background: var(--color-plum-600);
    border-color: var(--color-plum-300);
  }

  button[type='submit']:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  /*
   * The island's own links - the "did you mean" suggestion, which is a <button>, and the
   * privacy link in the fine print.
   *
   * **One link treatment on the site** (owner, 2026-09-08): plum, no underline at rest,
   * the underline drawing in on hover. These declarations are the `Link` primitive's
   * `inline` variant, written a third time because an Astro component cannot render
   * inside a Svelte island and `.link` cannot be globalised - the name is taken here.
   * `tests/e2e/legal.spec.ts` asserts all three computed results agree, so they cannot
   * drift apart quietly. It replaces a permanent `text-decoration: underline`, which was
   * the one link on the site wearing a different affordance.
   */
  .link {
    position: relative;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-plum-300);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .link::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform var(--dur-2) var(--ease-out);
  }

  .link:hover::after,
  .link:focus-visible::after {
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .link::after {
      transition: none;
      transform: scaleX(1);
      opacity: 0.4;
    }

    .link:hover::after,
    .link:focus-visible::after {
      opacity: 1;
    }
  }

  .note,
  .suggestion,
  .message {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-mute-400);
  }

  .message {
    color: var(--color-bloom-amber);
  }

  .outcome h2 {
    /* Inline-block so the focus ring hugs the sentence rather than drawing a box the
     * width of the column - this heading takes focus programmatically on success, so its
     * ring is seen by everyone, not only by whoever tabbed to it. */
    display: inline-block;
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-xl);
    line-height: var(--leading-display);
    color: var(--color-white);
  }

  .outcome h2:focus-visible {
    outline: 2px solid var(--color-plum-300);
    outline-offset: 6px;
    border-radius: 6px;
  }

  .outcome p {
    margin: 0;
    max-width: var(--measure);
    color: var(--color-mute-200);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* The only motion on the route: state swaps arrive rather than appear. */
  .outcome,
  .suggestion,
  .message:not([hidden]) {
    animation: settle 180ms var(--ease-out) both;
  }

  @keyframes settle {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .outcome,
    .suggestion,
    .message:not([hidden]) {
      animation: none;
    }
  }
</style>

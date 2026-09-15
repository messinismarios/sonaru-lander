<script lang="ts">
  /**
   * The monthly/yearly switch - phases.md 8.7, and the "pricing toggle" from
   * `design-system.md` §9's inventory.
   *
   * **The first hydrated component on the site.** Everything before this was static
   * Astro, so the rule it establishes matters more than the component does: the island
   * owns *state*, never *content*. Both prices are server-rendered inside the cards; all
   * this does is set `data-billing` on `<html>` and let CSS cross-fade between two nodes
   * that are already in the document.
   *
   * That is what keeps three separate promises at once. Without JavaScript the page still
   * renders - showing monthly, the honest default - because the markup never depended on
   * hydration. The prices are in the HTML for a crawler to read. And the transition costs
   * no JavaScript at all, so the island stays a few hundred bytes of state rather than an
   * animation runtime.
   *
   * It is a **real radiogroup**, not a div with a click handler: arrow keys move between
   * the two options and the state is announced without any ARIA of our own.
   *
   * **Its words arrive as a prop and it imports no catalogue** (8.11a). This is a
   * hydrated component: an import of `src/i18n/` here would put *every* locale's strings
   * into the bundle *every* visitor downloads, and no test would have reported it. The
   * numbers still come from `src/data/pricing.ts` directly, because they are the same in
   * every language and the discount must stay derived rather than written.
   */
  import { yearlyDiscountPercent, PRO_PLAN } from '../../data/pricing';

  interface Props {
    readonly strings: { readonly label: string; readonly monthly: string; readonly yearly: string };
  }

  const { strings }: Props = $props();

  type Billing = 'monthly' | 'yearly';

  let billing = $state<Billing>('monthly');

  const discount = yearlyDiscountPercent(PRO_PLAN);

  /**
   * The discount lives in the toggle's own label rather than in a badge shouting beside
   * it - superlist.com/pricing's move, cited at Gate A (`reference-study.md` §pricing).
   */
  const options: readonly { value: Billing; label: string }[] = [
    { value: 'monthly', label: strings.monthly },
    { value: 'yearly', label: strings.yearly.replace('{discount}', String(discount)) },
  ];

  $effect(() => {
    document.documentElement.dataset['billing'] = billing;
  });
</script>

<fieldset class="toggle" data-billing={billing}>
  <legend class="sr-only">{strings.label}</legend>

  <!--
    The indicator is a sibling rather than a background on the checked label, so it can
    slide between the two positions instead of appearing under one and vanishing from the
    other. `aria-hidden` because it carries no information the radios do not.
  -->
  <span class="indicator" aria-hidden="true"></span>

  {#each options as option (option.value)}
    <label class="option">
      <input type="radio" name="billing" value={option.value} bind:group={billing} />
      <span>{option.label}</span>
    </label>
  {/each}
</fieldset>

<style>
  /*
   * A two-column grid, not a flex row. The indicator below is positioned as a fraction of
   * this box, so the two options have to be exactly equal halves of it - with `inline-flex`
   * they were sized by their own text ("Monthly" against "Yearly - 20% off"), the 50%
   * indicator matched neither, and it sat across the boundary covering half the second
   * label. Equal columns make the geometry true by construction rather than by luck.
   */
  .toggle {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* A fieldset carries a default border, padding and margin in every browser. */
    margin: 0;
    padding: var(--spacing-1);
    border: 1px solid var(--color-ink-700);
    border-radius: 999px;
    background: var(--color-ink-900);
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

  .option {
    position: relative;
    /* Above the indicator, which shares this stacking context. */
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    /* WCAG 2.2 target size, matching Button's own floor. */
    min-height: 40px;
    padding: 0 var(--spacing-6);
    border-radius: 999px;
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1;
    color: var(--color-mute-200);
    cursor: pointer;
    transition: color var(--dur-2) var(--ease-in-out);
  }

  /*
   * The radio itself is placed under its own label rather than moved off-screen, so the
   * focus ring the browser draws lands on the control the visitor is actually operating.
   */
  .option input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    border-radius: 999px;
    opacity: 0;
    cursor: pointer;
  }

  .option:has(input:checked) {
    color: var(--color-white);
  }

  .option:has(input:focus-visible) {
    outline: 2px solid var(--color-plum-400);
    outline-offset: 2px;
  }

  .indicator {
    position: absolute;
    top: var(--spacing-1);
    bottom: var(--spacing-1);
    left: var(--spacing-1);
    /* Exactly one column of the grid above, inset by the fieldset's own padding. */
    width: calc(50% - var(--spacing-1));
    border-radius: 999px;
    background: var(--color-plum-700);
    transition: transform var(--dur-2) var(--ease-in-out);
  }

  .toggle[data-billing='yearly'] .indicator {
    transform: translateX(100%);
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator,
    .option {
      transition: none;
    }
  }

  @media (max-width: 480px) {
    .option {
      padding: 0 var(--spacing-4);
      font-size: var(--text-xs);
    }
  }
</style>

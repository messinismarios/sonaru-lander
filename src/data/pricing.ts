/**
 * The pricing page's single source of truth - phases.md 8.7, Gate B approved 2026-09-06.
 *
 * The cards, the comparison table and the FAQ all read from here for the same reason the
 * home page's four acts read from one showcase manifest: two renderings of the same
 * tier that disagree is the failure this module exists to make unrepresentable. The
 * annualised figures are **derived**, never typed twice - `yearlyTotalCents` is the only
 * yearly number in the file and everything else is computed from it.
 *
 * **The prices are temporary** (owner, 2026-09-06). `specs/mission.md` records that Pro
 * pricing is not finalised, and the owner's instruction at Gate A was to put indicative
 * numbers on the page anyway so the monthly/yearly toggle has something to move between.
 * `PRICING_IS_INDICATIVE` carries that fact to the UI rather than leaving it in a comment
 * nobody reads, and `phases.md` 8.13 tracks replacing these numbers as a launch blocker.
 *
 * **No copy is in here - 8.11a moved it to `src/i18n/<locale>/pricing.ts`.** What is left
 * is the money and the shape: cents, the derived annual figures, which tier a feature
 * falls on, and whether Pro is the emphasised card. A translator cannot change a price
 * from the catalogue, and `tests/unit/pricing-data.spec.ts` still checks this file against
 * `specs/mission.md`. **The FAQ left whole** rather than splitting like the plans and the
 * comparison rows did: a question and its answer carry no structural data at all, so an
 * id-only husk here would have been a file that exists to be joined to another one.
 */
import type { Catalogue } from '../i18n';

/** Currency symbol. One place, because the toggle animates between two of these. */
export const CURRENCY = '€';

/**
 * Whether the page admits its prices are not final. Flipping this to `false` at launch
 * removes the disclaimer everywhere it appears - it is deliberately not a per-component
 * decision.
 */
export const PRICING_IS_INDICATIVE = true;

export interface Plan {
  /** The key into `pricing.plans` - its name, tagline, feature list and button live there. */
  readonly id: keyof Catalogue['pricing']['plans'];
  readonly monthlyCents: number;
  /** What a year costs when billed yearly. The per-month figure is derived from it. */
  readonly yearlyTotalCents: number;
  /** Pro is the emphasised card. */
  readonly featured: boolean;
}

export const PLANS: readonly Plan[] = [
  { id: 'free', monthlyCents: 0, yearlyTotalCents: 0, featured: false },
  // 399 x 12. The 20% in the toggle's own label is this number against 499 x 12.
  { id: 'pro', monthlyCents: 499, yearlyTotalCents: 4788, featured: true },
];

/**
 * The comparison, straight from `specs/mission.md` §Business model.
 *
 * The five features and which side of the line each falls on are the product's, not the
 * page's - `tests/unit/pricing-data.spec.ts` guards that. **Notifications are identical
 * on both sides**: they are free and ship in the beta (owner, 2026-09-04). The iOS app's
 * paywall copy still says otherwise and is the thing that is wrong.
 */
export interface ComparisonRow {
  /** The key into `pricing.compare.rows`, where the three cells' words live. */
  readonly id: keyof Catalogue['pricing']['compare']['rows'];
  /** True where mission.md says "Same" - the UI marks it rather than repeating it. */
  readonly sameAsFree: boolean;
}

export const COMPARISON: readonly ComparisonRow[] = [
  { id: 'feed', sameAsFree: true },
  { id: 'notifications', sameAsFree: true },
  { id: 'autoAdd', sameAsFree: false },
  { id: 'recommendations', sameAsFree: false },
  { id: 'social', sameAsFree: false },
];

/** Cents as a display string: `499` → `4.99`, `0` → `0`. */
export function formatPrice(cents: number): string {
  if (cents === 0) return '0';
  return (cents / 100).toFixed(2);
}

/** What Pro costs per month when billed yearly. Derived - never typed. */
export function monthlyEquivalentCents(plan: Plan): number {
  return Math.round(plan.yearlyTotalCents / 12);
}

/**
 * The yearly saving, as a whole percentage. This is what the toggle's label says, and it
 * is computed rather than written so the label cannot outlive a price change.
 */
export function yearlyDiscountPercent(plan: Plan): number {
  if (plan.monthlyCents === 0) return 0;
  return Math.round((1 - plan.yearlyTotalCents / (plan.monthlyCents * 12)) * 100);
}

/** The plan the page is really selling. */
export const PRO_PLAN: Plan = PLANS[1] as Plan;

import { expect, test } from '@playwright/test';
import {
  COMPARISON,
  PLANS,
  PRO_PLAN,
  formatPrice,
  monthlyEquivalentCents,
  yearlyDiscountPercent,
} from '../../src/data/pricing';
import { catalogue } from '../../src/i18n';

/*
 * 8.11a split this page's words from its numbers. The numbers are still asserted against
 * `src/data/pricing.ts` below; the assertions that were about *wording* moved to the
 * catalogue rather than being deleted, because a test that stops checking the thing it
 * was written for is worse than no test.
 */
const copy = catalogue('en').pricing;

/**
 * The pricing data against the product it describes.
 *
 * `specs/mission.md` §Business model is the source for what each tier gives you, and the
 * page is not allowed to improve on it. These are the assertions that would have caught
 * the two things most likely to go wrong here: a tier boundary drifting away from the
 * product, and a hand-typed annual figure that stops matching the discount beside it.
 */

test('the comparison carries mission.md’s five features, in its order', () => {
  expect(COMPARISON.map((row) => row.id)).toEqual([
    'feed',
    'notifications',
    'autoAdd',
    'recommendations',
    'social',
  ]);
  // The names those ids print, which is what mission.md actually specifies.
  expect(COMPARISON.map((row) => copy.compare.rows[row.id].feature)).toEqual([
    'Feed',
    'Notifications',
    'Auto-add',
    'Recommendations',
    'Social',
  ]);
});

/** Every row the table renders has words, and every set of words belongs to a row. */
test('the comparison rows and their copy are the same set', () => {
  expect(Object.keys(copy.compare.rows).sort()).toEqual(COMPARISON.map((row) => row.id).sort());
});

/**
 * The one row with a decision behind it.
 *
 * Notifications were moved to the free side by the owner on 2026-09-04, reversing the
 * earlier plan that put instant delivery behind Pro. The iOS app's paywall copy still
 * advertises the old arrangement, so there is live text in the product contradicting
 * this - which is exactly why the site's version is pinned by a test rather than left to
 * whoever edits the table next.
 */
test('notifications are identical on both tiers', () => {
  const notifications = COMPARISON.find((row) => row.id === 'notifications');
  expect(notifications).toBeDefined();
  expect(notifications?.sameAsFree).toBe(true);
  // Not merely flagged as the same - the two cells say the same thing.
  expect(copy.compare.rows.notifications.free).toBe(copy.compare.rows.notifications.pro);
});

test('every plan has a name, a tagline, a button and at least one feature line', () => {
  for (const plan of PLANS) {
    const words = copy.plans[plan.id];
    expect(words.name.trim().length, `${plan.id} name`).toBeGreaterThan(0);
    expect(words.tagline.trim().length, `${plan.id} tagline`).toBeGreaterThan(0);
    expect(words.cta.trim().length, `${plan.id} cta`).toBeGreaterThan(0);
    expect(words.includes.length, `${plan.id} includes`).toBeGreaterThan(0);
  }
});

test('free is free, and Pro is the only priced tier', () => {
  const free = PLANS.find((plan) => plan.id === 'free');
  expect(free?.monthlyCents).toBe(0);
  expect(free?.yearlyTotalCents).toBe(0);
  expect(PRO_PLAN.monthlyCents).toBeGreaterThan(0);
});

/**
 * The toggle's label says "20% off" because this maths says so, not because someone typed
 * it. A price change that breaks the round number fails here rather than shipping a label
 * that lies by a percentage point.
 */
test('the yearly price is a whole-number discount on twelve months', () => {
  expect(yearlyDiscountPercent(PRO_PLAN)).toBe(20);
});

test('the annual total divides into twelve equal months', () => {
  expect(PRO_PLAN.yearlyTotalCents % 12).toBe(0);
  expect(monthlyEquivalentCents(PRO_PLAN) * 12).toBe(PRO_PLAN.yearlyTotalCents);
});

test('the yearly per-month figure is cheaper than the monthly one', () => {
  expect(monthlyEquivalentCents(PRO_PLAN)).toBeLessThan(PRO_PLAN.monthlyCents);
});

test('prices render with two decimals, and zero renders as zero', () => {
  expect(formatPrice(499)).toBe('4.99');
  expect(formatPrice(4788 / 12)).toBe('3.99');
  expect(formatPrice(0)).toBe('0');
});

/** Structured data is generated from this array, so an empty entry becomes invalid JSON-LD. */
test('every FAQ entry has both a question and an answer', () => {
  expect(copy.faq.entries.length).toBeGreaterThan(0);
  for (const entry of copy.faq.entries) {
    expect(entry.question.trim().length).toBeGreaterThan(0);
    expect(entry.answer.trim().length).toBeGreaterThan(0);
  }
});

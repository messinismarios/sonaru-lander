/**
 * English - the authored catalogue, and the shape every other locale is checked against.
 *
 * Split by surface rather than by kind so that translating `/press` means opening one file
 * and reading it top to bottom, in the order the page says it. A single 800-line bag of
 * keys is faster to write and much worse to translate from.
 */
import { ui } from './ui';
import { home } from './home';
import { pricing } from './pricing';
import { press } from './press';
import { brand } from './brand';
import { waitlist } from './waitlist';

export const en = { ui, home, pricing, press, brand, waitlist } as const;

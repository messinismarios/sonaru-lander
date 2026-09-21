/**
 * The route cards, as JSON, for `scripts/build-og-images.mjs` - SEO audit M12.
 *
 * The script is plain Node and cannot import `src/data/og-cards.ts`, exactly as it cannot
 * import the content collection. It already solves that by reading the running dev server
 * (`publishedSlugs` walks `/blog`), and this is the same answer for a list that is data
 * rather than markup: one source of truth, read at the only moment both sides exist.
 *
 * Dev-only like every other `/og/` route, and pruned from `dist/` with them.
 */
import type { APIRoute } from 'astro';
import { ROUTE_CARDS } from '../../../data/og-cards';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(ROUTE_CARDS.map((card) => card.slug)), {
    headers: { 'content-type': 'application/json' },
  });

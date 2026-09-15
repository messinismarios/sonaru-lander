// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { devWaitlistEndpoint } from './scripts/dev-waitlist-endpoint.mjs';
import { localeFallback404 } from './scripts/locale-404.mjs';
import { cspHashes } from './scripts/csp-hashes.mjs';
import { pruneDevRoutes } from './scripts/prune-dev-routes.mjs';
import { isShippingRoute } from './src/data/routes.ts';
import { hasCatalogue, PUBLISHED_LOCALES, DEFAULT_LOCALE } from './src/i18n/index.ts';
import { splitLocale } from './src/i18n/routing.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://sonaru.app',
  output: 'static',
  /*
   * en is unprefixed at the apex - tech-stack.md §10.
   *
   * **`PUBLISHED_LOCALES`, not `LOCALES`** - 8.11e. `es` is declared and withheld until
   * 8.11c writes Spanish, so it is not a locale this build knows about at all; see
   * `copy/config.ts`.
   */
  i18n: {
    locales: [...PUBLISHED_LOCALES],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  /*
   * `@astrojs/mdx` is pinned to **7.0.8, not the 8.0.0 npm offers**. mdx 8 peers
   * `@astrojs/markdown-remark@^7.3.0` and astro 7.2.9 pins that dependency at 7.2.4, so
   * installing it resolves only under `--force`. The choice was mdx 8 plus an astro bump
   * or mdx 7 on the astro we have; an astro upgrade moves every visual baseline on the
   * site and is not something 8.9c should do on its way past. It belongs to 8.12.
   */
  /*
   * **Syntax highlighting had no configuration at all**, so the blog ran on Astro's default
   * `github-dark` - whose comment colour is `#6a737d` on its own `#24292e` ground, which is
   * **3.04:1** and fails WCAG AA. axe found it on `/blog/mirroring-musicbrainz`, where two
   * lines of SQL comment carry the paragraph explaining what the query is for. 8.12a.
   *
   * **`colorReplacements` rather than a different theme.** All 40-odd bundled dark themes were
   * scored token-by-token against their own backgrounds and **only `catppuccin-mocha` clears
   * 4.5:1 on every one** (5.81, then macchiato 5.29 and frappe 4.53). Switching to it is one
   * line and repaints every code block on the site to look like Catppuccin - a far larger
   * visual change than the defect, for three posts in which axe finds exactly **one** failing
   * scope. `tests/e2e/axe.spec.ts` is what catches the next one.
   *
   * `#8b949e` is github's own later comment colour and is **4.77:1** here. Our tokens do not
   * fit: `--color-mute-400` is 4.18:1 on that ground and `--color-mute-200` at 8.56 is
   * brighter than the code it annotates.
   *
   * **What this does not fix, recorded in `phases.md` 8.12**: the code block's ground is
   * `#24292e` and not ours, so it is foreign to the palette and outside `npm run contrast`'s
   * reach entirely. Making it our own ink is a design gate on 8.9c's frozen blog.
   */
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      /*
       * **A transformer, because `colorReplacements` is not passed through.** Shiki's own
       * option for exactly this was tried first and does nothing here - astro 7.2.9's
       * `shikiConfig` forwards `theme`, `themes`, `langs`, `wrap` and `transformers` and
       * drops the rest. **Verified by isolating it**: setting `theme` to another value
       * repaints every token, so the config does reach both `.md` and `.mdx`; only the
       * replacement map is ignored. A `span` transformer edits the inline style the
       * highlighter has already written, which is the same result one layer later.
       */
      transformers: [
        {
          span(node) {
            const style = node.properties?.['style'];
            if (typeof style === 'string' && /#6a737d/i.test(style)) {
              node.properties['style'] = style.replace(/#6a737d/gi, '#8b949e');
            }
          },
        },
      ],
    },
  },
  integrations: [
    svelte(),
    mdx(),
    /*
     * The site's first sitemap - phases.md 8.11b. There was none at all before this unit,
     * and no `robots.txt` either.
     *
     * **One file per locale under an index**, which is superlist's shape, measured live at
     * Gate A: `sitemap_en.xml` / `sitemap_de-DE.xml` / `sitemap_es-ES.xml`, 163 URLs in each.
     * `chunks` is what produces that here - the integration's default is numbered files
     * split by size, and its `i18n` option puts `xhtml:link` alternates *inside* one
     * sitemap instead. We use neither: hreflang lives in the page head, once, where
     * superlist keeps it too, so there is only one place for it to be wrong.
     */
    sitemap({
      /*
       * Three exclusions, and all three are the same rule: **a sitemap lists pages that
       * are canonical, shipping and real.**
       *
       * The dev-only routes and camera stands go because 8.13 deletes them - the probe at
       * Gate B found all nine of them in the first sitemap this site ever built, `/kit`
       * and `/specimen` included. `src/data/routes.ts` is the one inventory both this file
       * and the guards read; a second copy here is the narrowing that file exists to stop.
       *
       * **And a locale with no catalogue is excluded whole.** Until 8.11c, every `/es/`
       * page is the English page at a second address and canonicalises to it (see
       * `Base.astro`); listing a non-canonical URL in a sitemap is the same defect as a
       * canonical that disagrees with itself. The Spanish chunk is therefore *empty* today
       * and no file is emitted for it - which is correct, and becomes 16 URLs the day
       * Spanish exists, with nothing here changing.
       *
       * **16 and not 17, which is the count `isShippingRoute` returns.** `/404` is a
       * shipping route by that predicate - it is a page a visitor reaches - and the
       * integration drops it from the sitemap on its own, as it does `/500`. So the two
       * numbers are allowed to disagree, and the sitemap's is the smaller one. Counted
       * from `dist/sitemap-en-0.xml` rather than derived.
       */
      filter: (page) => {
        const { locale, path } = splitLocale(new URL(page).pathname);
        return hasCatalogue(locale) && isShippingRoute(path);
      },
      /*
       * `Base.astro` strips the trailing slash from every canonical, because
       * `trailingSlash: 'ignore'` serves both forms and a canonical that varies with how a
       * visitor arrived is worse than none. The integration emits `.../pricing/` - measured
       * at Gate B - so without this the sitemap would advertise a URL the page itself
       * disclaims. The root keeps its slash, as the canonical does.
       */
      serialize: (item) => ({ ...item, url: item.url.replace(/(\w)\/$/, '$1') }),
      chunks: Object.fromEntries(
        PUBLISHED_LOCALES.map((locale) => [
          locale,
          (item) => (splitLocale(new URL(item.url).pathname).locale === locale ? item : undefined),
        ]),
      ),
    }),
    /*
     * Astro special-cases `src/pages/404.astro` into `dist/404.html`, and **only that one**
     * - measured at Gate B, both by authoring it under the locale parameter and as a literal
     * `src/pages/es/404.astro`. Either way the Spanish one lands at `dist/es/404/index.html`,
     * which Cloudflare Pages does not look for.
     */
    localeFallback404({
      locales: PUBLISHED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE),
    }),
    /*
     * `dist/` gets the shipping routes and nothing else - phases.md 8.13. The files stay in
     * the repository because `npm run og` and `npm run press` photograph the camera stands on
     * the dev server; see the script's header for the decision and its alternative.
     *
     * **Before `cspHashes()`**, so the hashes describe pages that ship.
     */
    pruneDevRoutes({ isShippingRoute }),
    /*
     * Completes the CSP in `dist/_headers` with the hash of every inline script the build
     * actually emitted - phases.md 8.12b. Astro inlines its own island runtime on `/pricing`
     * and `/waitlist`, which `assetsInlineLimit: 0` does not reach; see the script's header
     * for how that was found and what it would have broken.
     */
    cspHashes(),
  ],
  /*
   * `devWaitlistEndpoint` mounts POST /api/waitlist under `astro dev` only. Pages
   * Functions do not run here, and Gate C is "start the dev server and look at it" - see
   * the file's header for what is real in it and what is substituted.
   */
  /*
   * **Nothing is inlined into the HTML, and this is a Content-Security-Policy decision
   * rather than a size one.** Astro inlines a hoisted `<script>` whose bundled chunk has no
   * imports and falls under `assetsInlineLimit` - measured at 8.10b, where `/press`'s
   * 614-byte copy-button module arrived as `<script type="module">…</script>` in the built
   * page. `acceptance-criteria.md` §10 requires a CSP **without `unsafe-inline`**, under
   * which that script is blocked: the buttons never appear and the only symptom is a
   * console error on a page that otherwise looks finished.
   *
   * Zero rather than a smaller threshold, because a limit that inlines *sometimes* is a
   * policy violation that arrives with whichever change happens to shrink a script.
   * Verified to affect nothing else: the built site contains no `data:` asset at any
   * threshold, and the only other inline scripts were `/specimen` and `/blog/lab`, which
   * 8.13 removes.
   */
  vite: {
    plugins: [tailwindcss(), devWaitlistEndpoint()],
    /*
     * **The motion layer's four dependencies are pre-bundled by name, and without this the
     * dev server serves `504 Outdated Optimize Dep` for them mid-run.**
     *
     * Vite's dependency scanner crawls HTML and the modules it can reach from it. It never
     * reaches these: the site's only entry into `src/motion/` is an Astro page `<script>`,
     * which the Astro compiler extracts and serves as its own module, and `ScrollTrigger`
     * and `lenis` sit one level further behind `await import(...)` in `registry.ts` - which
     * is Vite's own documented case for this option. So all four arrive as *runtime*
     * discoveries: the server optimises them, bumps its browser hash, and every module
     * already holding the previous `?v=` stops resolving.
     *
     * **What that looks like is a broad regression in sections nothing has touched.** It
     * failed 67 tests on an unmodified tree on 2026-09-12 - every ScrollTrigger section
     * (act one, act two, the notification, the playlist) red, and `hero-lights` green
     * because the hero asks for `initMotion()` and never loads ScrollTrigger. CLAUDE.md has
     * described this family twice from the symptom side; this is the cause, and pre-bundling
     * at server start is the fix rather than another documented restart ritual.
     *
     * `gsap` and `gsap/CustomEase` are static imports and are listed for the same reason:
     * static or not, nothing scannable imports them either.
     */
    optimizeDeps: { include: ['gsap', 'gsap/ScrollTrigger', 'gsap/CustomEase', 'lenis'] },
    /* Vite's limit, not Astro's: the plugin that makes this decision reads it off the
     * resolved *Vite* config (`plugin-scripts.js`), so `build.assetsInlineLimit` at the
     * top level of this file is silently ignored - which is how the first attempt at this
     * fix passed review and changed nothing. */
    build: { assetsInlineLimit: 0 },
  },
});

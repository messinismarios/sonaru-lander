# Typeface licence

**Satoshi**, by the Indian Type Foundry, chosen by the owner at the 8.1 gate
(`../../../specs/lander/gate-log.md`). It is the site's only typeface - display and body
both, with hierarchy carried by weight and size (`design-system.md` §3).

| File | What it is |
|---|---|
| `satoshi-variable.woff2` | The source as distributed by Fontshare. Input to `scripts/build-fonts.mjs`; **not served**. |
| `satoshi-subset.woff2` | Generated. Latin-1 + Spanish punctuation + typographic marks, `wght` 300–900 preserved. This is what ships. |

Regenerate with `npm run fonts` after changing the character set.

## Licence

Satoshi is released under the **ITF Free Font Licence**, which permits personal *and*
commercial use, including self-hosting on a commercial website. It is served from this
origin - `design-system.md` §3 forbids a runtime Google Fonts request, because a
third-party connection on the critical path is incompatible with the performance bar.

Before launch (`phases.md` 8.13): re-verify the licence text against Fontshare's current
terms and restate it in the README.

## Spanish coverage

The subset includes Latin-1 Supplement, so `á é í ó ú ü ñ ¿ ¡` are all present - verified
by rendering them in `/specimen`. `phases.md` 8.11 re-checks coverage against the final
Spanish copy.

## Candidates that were not chosen

General Sans, Geist and Inter Display were set alongside Satoshi in the specimen and
removed from the repo when the gate closed. They are recoverable from commit history if
the decision is ever reopened.

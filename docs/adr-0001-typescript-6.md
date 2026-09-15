# ADR 0001 - TypeScript 6.0.3, not 7.0.2

**Status:** **accepted - owner's decision, 2026-08-31** · **Date:** 2026-08-31

## Context

`specs/lander/tech-stack.md` §1 pins TypeScript **7.0.2**, on the reasoning that a site
whose stated requirement is "the latest technology" should not ship a two-major-old
toolchain. TypeScript 7.0.2 is indeed the current release.

The Astro toolchain has not adopted it. Measured on 2026-08-31:

| Package           | Version | `typescript` peer range |
| ----------------- | ------- | ----------------------- |
| `@astrojs/check`  | 0.9.10  | `^5.0.0 \|\| ^6.0.0`    |
| `@astrojs/svelte` | 9.0.1   | `^5.3.3 \|\| ^6.0.0`    |

`astro` itself declares no `typescript` peer, so Astro _builds_ fine on 7. What breaks is
everything around it.

## Decision

Pin **TypeScript 6.0.3** - the newest stable release the toolchain supports.

The owner was shown the measured evidence below and chose this over TypeScript 7.

## Evidence

Not inferred from peer ranges - measured on a throwaway copy of this repo running
TypeScript 7.0.2.

`astro check` does not degrade under TS 7. It refuses to run:

> The TypeScript module loaded (found 7.0.2) does not expose the programmatic API that
> `astro check` relies on. TypeScript's native compiler (7.0 and later) does not ship
> this API yet.

To find out what that actually costs, `const deliberateError: number = 'this is a
string, not a number';` was planted in the frontmatter of `src/pages/specimen.astro`:

| Toolchain                                     | Result                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| TS 7 + `tsc --noEmit` - the only checker left | **exit 0, silent**                                           |
| TS 6 + `astro check`                          | `ts(2322): Type 'string' is not assignable to type 'number'` |

`astro build` succeeds under TS 7, so the error stays invisible until runtime. `tsc` even
_lists_ the `.astro` files while checking nothing inside them, which is what makes the gap
easy to miss: the typecheck appears to be running and passing.

Forcing the install with `--legacy-peer-deps` was tested and does not help - this is a
missing compiler API, not a stale peer range.

## Consequences

Pinning 7.0.2 would have cost us both of these:

- **`astro check`**, the only thing that typechecks `.astro` component templates. Plain
  `tsc --noEmit` does not read them. Losing it would mean the majority of our view layer
  is unchecked, on a project where `mission.md` §3.2 bans `any` outright and
  `acceptance-criteria.md` §6 requires a clean strict-mode typecheck. The ban would be
  unenforceable exactly where most of the code lives.
- **Svelte islands**, which `tech-stack.md` §1 selects for the pricing toggle, waitlist
  form, mobile nav and FAQ. Nothing in 8.1 needs them, but 8.7 and 8.8 do.

The alternatives were worse. `--legacy-peer-deps` or an npm `override` would install an
untested combination and call it done - `mission.md` §3.6 rules out exactly that kind of
shortcut. Dropping `@astrojs/svelte` to keep TS 7 would trade a working typechecker for a
version number and still leave 8.7 blocked.

TypeScript's own major cadence means 7 is where the toolchain will land; this ADR is
revisited when `@astrojs/check` ships a `^7` peer, and the upgrade is a deliberate PR.

**This diverges from an approved spec**, so it is recorded here and raised at the 8.1
gate rather than applied silently. If the owner prefers TS 7, the change is one line in
`package.json` plus dropping `astro check` from `npm run typecheck` - and we accept the
consequences above.

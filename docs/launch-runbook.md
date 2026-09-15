# Launch runbook - sonaru.app

Everything in `phases.md` 8.13 that needs a Cloudflare account, a mailbox or a person,
in the order the dependencies force. Written 2026-09-12, when the code-side of 8.13 was
finished and the only remaining work was operator work.

**Why this file exists.** Most of what is left shares one property: **no build step, type
or test can tell success from failure**, so the first honest check is on the deployed
site. A wrong Turnstile secret, a mailbox that bounces, a 404 served with a 200, a CSP
directive with a typo and a Web Analytics chart that stays empty all look exactly like
working systems from here. Each step below therefore ends in a check you can actually
fail, and the check is the step. Do not tick anything on the strength of the console
saying it saved.

Tick the boxes in `../../specs/lander/phases.md` 8.13 as you go; this file is the
procedure, that file is the ledger.

---

## Before you start

| Thing               | Value                               | Where it comes from                          |
| ------------------- | ----------------------------------- | -------------------------------------------- |
| Repo                | `sonaru-app/sonaru-frontend-lander` |                                              |
| Production branch   | `main`                              |                                              |
| Build command       | `npm run build`                     | `package.json`                               |
| Output directory    | `dist`                              | Astro's default, `output: 'static'`          |
| Node version        | `22` or newer                       | `package.json` `engines`                     |
| Functions directory | `functions/`                        | Pages picks this up automatically, no config |
| Site URL            | `https://sonaru.app`                | `astro.config.mjs`                           |

There is no `wrangler.toml` and no `_routes.json`, and neither is missing: Pages infers
the Functions routing from `functions/api/waitlist.ts`, and every setting above is entered
once in the dashboard. `wrangler` is not a dependency of this repo, so the D1 commands
below use `npx wrangler`, which fetches it on demand.

---

## 1. The Pages project

Create it against the repo, production branch `main`, preview on every PR. Enter the build
settings from the table above.

**Deploy once now, before any custom domain**, and check the `*.pages.dev` URL it gives
you. The site should be complete and correct there: the waitlist form will render and
fail on submit, which is expected until step 3.

- [ ] The `*.pages.dev` deployment builds and every page loads.

**If the build fails on Node:** the default is older than 22 on some accounts. Set
`NODE_VERSION=22` as a build environment variable rather than pinning a lower Astro.

**Then the deploy hook, for scheduled posts.** A post with a future `publishedAt` is left
out of the build until that instant, so it only appears when something rebuilds the site.
`.github/workflows/scheduled-rebuild.yml` does that daily at 06:00 UTC by calling a deploy
hook. In the Pages project: _Settings → Builds → Deploy hooks_, add one for branch `main`,
and store the URL as the repository secret `CLOUDFLARE_PAGES_DEPLOY_HOOK`. Then run the
workflow by hand from the Actions tab.

- [ ] The manual run of _Scheduled rebuild_ is green and starts a production build in Pages.

---

## 2. D1, and the migration

The waitlist has never run anywhere. `astro dev` mounts the same rules through
`scripts/dev-waitlist-endpoint.mjs`, but with in-memory ports, so **the bindings
themselves are unproven** until this step.

```sh
npx wrangler d1 create sonaru-waitlist
npx wrangler d1 execute sonaru-waitlist --remote --file=./migrations/0001_waitlist.sql
npx wrangler d1 execute sonaru-waitlist --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

The last command must list **`signups`** and **`attempts`**. Both matter:
`signups.email` is the primary key and **is** the duplicate check, so the page's "you are
already on the list" state is this constraint and nothing else; `attempts` records refused
submissions as well as accepted ones, because a limiter that counts only successes is a
limiter a bot never meets.

Bind it to the Pages project with the variable name **`WAITLIST_DB`**, on **both**
production and preview. The name is not a preference: `functions/api/waitlist.ts` reads
`env.WAITLIST_DB` and nothing else.

- [ ] `sonaru-waitlist` exists, both tables are present, bound as `WAITLIST_DB` on
      production and preview.

---

## 3. Turnstile, and the two secrets

Create a Turnstile widget for `sonaru.app`. It gives you a **site key** (public) and a
**secret key** (not).

Set these on the Pages project:

| Name                        | Kind                | Value                             |
| --------------------------- | ------------------- | --------------------------------- |
| `PUBLIC_TURNSTILE_SITE_KEY` | build-time variable | the widget's site key             |
| `TURNSTILE_SECRET_KEY`      | encrypted secret    | the widget's secret key           |
| `IP_HASH_SALT`              | encrypted secret    | 32+ random bytes you generate now |

Generate the salt with `openssl rand -hex 32`. It is what lets the site rate-limit without
storing an identifier: `hashIp()` stores a salted SHA-256 and the raw address never leaves
the Function. Rotating it later makes every stored hash unlinkable to any future address,
which is a feature rather than a migration.

**`PUBLIC_TURNSTILE_SITE_KEY` is the one with a silent failure.** If it is absent,
`src/config/launch.ts` falls back to Cloudflare's documented **always-passing test key**,
which is what dev and CI use. The widget renders, the form submits, everything looks
correct, and the bot check is off. It is a build-time variable, so it must be set before
the deploy that uses it, and changing it requires a rebuild rather than a restart.

- [ ] All three set, production and preview, and the site rebuilt afterwards.

### Then submit a real address

On the `*.pages.dev` URL, submit an address you control.

- [ ] It succeeds, and `npx wrangler d1 execute sonaru-waitlist --remote --command="SELECT email, locale, created_at FROM signups"` shows the row.
- [ ] Submit the **same** address again: the page says you are already on the list.
- [ ] `SELECT COUNT(*) FROM attempts` has increased by two, not one.

That third check is the one worth doing deliberately. It is the only evidence that the
refused path writes too, and it is what the rate limiter rests on.

---

## 4. The custom domains

Add `sonaru.app` and `www.sonaru.app` as custom domains **on the Pages project**. Pages
writes and owns those records in the zone.

**Do not add them to `ftero-infra`'s `tenant_hosts`.** `terraform/dns.tf` in that repo
says so in its header, and `messinismarios/ftero-infra#1` records the reasoning: Terraform
declaring names Pages already owns is two systems fighting over one record, and it makes
`terraform plan` wrong rather than making the platform map more accurate.

`api.sonaru.app` is unaffected. It is a droplet hostname, it stays in `tenant_hosts`, and
it is in the same zone as these two, which is the only reason this is worth a warning.

- [ ] Both hostnames resolve and serve the site over HTTPS.
- [ ] `api.sonaru.app` still answers.

---

## 5. Read the security headers back off the live site

8.12b wrote `public/_headers` and **nothing about it is verifiable here**: Pages serves
that file, `astro dev` does not, and a malformed directive is silently ignored rather than
rejected.

```sh
curl -sI https://sonaru.app | grep -iE 'content-security-policy|strict-transport-security|referrer-policy|permissions-policy|x-content-type-options'
```

- [ ] `Content-Security-Policy` is present and starts `default-src 'none'`.
- [ ] `Strict-Transport-Security` is `max-age=63072000; includeSubDomains`, with **no**
      `preload` (deliberate: preload is a submission to a browser-vendor list, not a header
      we control, and nothing about launch needs it).
- [ ] `Referrer-Policy`, `Permissions-Policy` and `X-Content-Type-Options` are present.

### Then use the two pages with inline scripts

`/pricing` and `/waitlist` are the only routes with inline scripts. They are allowed **by
hash**, computed into `dist/_headers` at build time by `scripts/csp-hashes.mjs`. A wrong
hash is not an error page; it is a dead control with a console message behind it.

- [ ] On `/pricing`, the monthly/yearly toggle actually switches the prices.
- [ ] On `/waitlist`, the form renders and the Turnstile widget appears.
- [ ] The browser console on both is free of CSP violations.

If either is dead, the hashes did not make it into the served file. Check that
`dist/_headers` contains no literal `__INLINE_SCRIPT_HASHES__`, which is what an unrun
build hook leaves behind.

---

## 6. The 404, and its status code

8.9f proved the build half: `dist/404.html` exists and carries its `noindex`. Pages
_serving_ it for an unmatched path is documented rather than locally testable.

```sh
curl -sI https://sonaru.app/this-page-does-not-exist | head -1
```

- [ ] The status line says **404**, not 200.
- [ ] The page itself is the site's own 404, with the footer under it.

**Check the code, not just the page.** A 404 page served with a 200 is a soft 404, and it
is the one failure this design cannot show you: the page looks perfect and search engines
index it as real content.

---

## 7. Cloudflare Web Analytics, and the CSP in the same change

Enable Web Analytics for `sonaru.app`. Cloudflare injects its script at the edge.

**This needs a code change in the same breath**, and the order matters: the CSP is
`default-src 'none'`, so nothing is inherited. In `public/_headers`, add
`https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com`
to `connect-src`, then deploy.

Without it the script is blocked and **the symptom is a chart that stays empty**, which
reads as "no traffic yet" rather than as a mistake. `tests/unit/security-headers.spec.ts`
cannot catch this: it checks scripts the build emits, and this one is injected downstream
of the build.

- [ ] CSP updated and deployed.
- [ ] Console shows no CSP violation for `cloudflareinsights.com`.
- [ ] The dashboard records your own page views within a few minutes.

---

## 8. Search Console and Bing

- [ ] `sonaru.app` verified in Google Search Console.
- [ ] `sonaru.app` verified in Bing Webmaster Tools.
- [ ] `https://sonaru.app/sitemap-index.xml` submitted to both.

`robots.txt` already points at it and deliberately disallows nothing: the dev-only routes
are kept out of the build by `scripts/prune-dev-routes.mjs`, not by a `Disallow` line,
because a `Disallow` is a published list of the pages we would rather you did not look at.

---

## 9. The three mailboxes

Owner requirement, recorded 2026-09-09 at 8.10b's Gate A. The site publishes three
addresses and **none has ever been sent a message**:

| Address              | Published on                                                 |
| -------------------- | ------------------------------------------------------------ |
| `support@sonaru.app` | `/privacy`, `/terms`, `/support`                             |
| `hello@sonaru.app`   | the waitlist's fine print, the "we'll add you by hand" route |
| `press@sonaru.app`   | `/press`                                                     |

Send a real message to each **from outside the zone** (a personal account on another
provider, not a Cloudflare Email Routing rule talking to itself), confirm it arrives, and
reply to the reply.

This is the Turnstile secret's failure mode exactly: nothing can tell a working mailbox
from a printed string, so a published address that bounces fails for the first time in
production, in front of the one person who was trying to reach us. `hello@` catches people
whose signup broke; `press@` catches a journalist on a deadline.

- [ ] All three received and answered.
- [ ] If a fourth address appears anywhere on the site before launch, it joins this list.

This step depends on nothing above it. Do it first if you are waiting on anything else.

---

## 10. A screen reader, run by a person

Carried from 8.12a, which did every other part of the manual pass and wrote it up in
`accessibility-pass.md`. **VoiceOver on macOS** was in that unit's scope and was not
delivered, because a screen reader cannot be driven from a terminal. **VoiceOver on iOS**
was ruled out of launch scope by the owner on 2026-09-12 and is a known gap.

axe checks that an accessible name _exists_, never that it is useful. What to listen to:
the four scrubbed acts on `/`, and both forms.

- [ ] VoiceOver on macOS, over the home route and both forms.

---

## 11. Final full-site Gate C

The last gate. The owner walks the entire site, desktop and phone, **in English**, and
approves it as a whole.

`/es/` is out of the published build (8.11e), so there is no Spanish half to this walk;
it belongs to 8.11c's and 8.11d's own gates, after launch.

- [ ] Approved, and the row written into `../../specs/lander/gate-log.md`.

**The site does not go live without this.**

---

## What is deliberately not here

- **`/pricing`'s orphan and its indicative prices.** Deferred past launch (owner,
  2026-09-12). The route ships reachable by URL and by sitemap with no link to it, and
  `tests/e2e/404.spec.ts` asserts the hole so it cannot close quietly.
- **`APP_STORE_APP_ID` and 1.0's `releasedAt`.** Both wait on the App Store listing. Tests
  assert the Smart App Banner is absent while the id is `null`, and that `/changelog` says
  `Not yet released`; both fail deliberately the day those land, which is the reminder.
- **The iOS Associated Domains entitlement.** Deferred, and larger than 8.13 implied: there
  is no `.entitlements` file in `sonaru-frontend-ios` at all and no universal-link handler,
  so it is a feature rather than configuration. `public/.well-known/apple-app-site-association`
  is inert rather than wrong in the meantime.

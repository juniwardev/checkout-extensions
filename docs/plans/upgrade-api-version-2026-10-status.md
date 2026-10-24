# Status: `upgrade-api-version-2026-10`. Paused before release.

**Stopped:** 2026-10-23, after QA sign-off. **Not deployed.** Nothing about this upgrade is live yet.
The store still runs `checkout-extensions-2` (created 2026-06-12, mixed API versions). The dashboard's
"outdated API version" warning stays until the release steps below are completed.

## Where things stand

| Stage | Result | Artifact |
|---|---|---|
| Plan | APPROVE after 4 review passes | `docs/plans/upgrade-api-version-2026-10.md`, `docs/reviews/upgrade-api-version-2026-10-review.md` |
| Implement | Done; AC-1 to AC-10 and AC-14 pass | `docs/plans/upgrade-api-version-2026-10-impl-notes.md` |
| QA | PASS WITH NITS, operator sign-off without the manual walk-through | `docs/qa/upgrade-api-version-2026-10-report.md` |
| Approval | `docs/qa/upgrade-api-version-2026-10.approved` exists (gitignored, local only) | |
| Deploy and release (plan §3.6, O2 to O7) | **NOT STARTED** | |

The repo is on `main`, with all work committed locally and **not pushed**. The upgrade commits run from
`25361e0` (plan) through `debb704` (QA report), followed by this status file.

What's in the code:
- All four `api_version` settings are on `2026-10`.
- All three extensions pin `@shopify/ui-extensions` `2026.10.x`. The lockfile resolves to `2026.10.0`, held back by
  pnpm's release-age policy; accepted.
- The Admin API URL in `shared/models/faq.ts` is on 2026-10.
- pnpm is the only package manager (`package-lock.json` deleted).
- `CLAUDE.md` and `AGENTS.md` are updated and byte-identical.
- Shopify CLI is 4.9.4.

## Open risks to know before resuming

1. **Dev preview is failing on Shopify's side.**
   - Since 2026-10-23 ~15:50, `shopify app dev` bundles all three extensions, then fails at "Preparing dev preview"
     with "Internal error. Looks like something went wrong on our end." Request ID:
     `406f4f3a-d78f-4d6f-8aa3-8fe84a438188-1792795853`.
   - The same code previewed fine at 15:42, and Shopify's status page was green. It matches community reports of
     server-side dev-preview upload failures.
   - `deploy` and `dev clean` may hit the same error. If it persists, take the Request ID to Shopify Partner support.
2. **The store's dev-preview state is unknown.** A preview from the 15:42 session (the 2026-10 code) may still be
   on `theme-evolution-os2.myshopify.com`, which is also the live store.
   - Do **not** run `shopify app dev clean` before the new version is released and confirmed active (plan R13, O4b).
   - Do **not** use `--reset`.
3. **Not verified at runtime:**
   - AC-12, App Home FAQ create/edit/delete against Admin API 2026-10.
   - AC-13, app-tools/Sidekick.
   - Manual-mode, tone and discount-driven free-shipping checks.

   The live-store check in O7 is expanded to cover AC-12.
4. **The FAQ baseline (O2(d)) has never been recorded.** It must be recorded before deploying.

## Resume here: release steps (plan §3.6)

Run these from `~/Projects/Shopify/checkout-extensions`. First re-check O1:
- the tree is clean;
- the `.approved` file exists;
- no `shopify app dev` process is running.

1. **O2:**
   - Record the active version with `shopify app versions list`. Expect `checkout-extensions-2`; this is the rollback target.
   - Record the FAQ count and the list of questions in App Home.
2. **O3:** create the version without releasing it, and note its name:
   ```
   shopify app deploy --no-release --message "upgrade-api-version-2026-10: all extensions on 2026-10"
   ```
3. **O4:**
   - Inspect the new version in the Dev Dashboard. It should show 3 extensions updated and no deletions.
   - Then release it interactively, without `--allow-*` flags:
     ```
     shopify app release --version <new-version-name>
     ```
   - If the confirmation lists any deletion, answer **no**.
4. **O5:** run `shopify app versions list` and confirm the new version is `active`. It can take several minutes.
5. **O4b:** only after O5 confirms, run the command below and save its output:
   ```
   shopify app dev clean --store theme-evolution-os2.myshopify.com
   ```
   - A failure loses nothing; retry later.
   - From here on, never run `shopify app dev` against this store.
6. **O6:** on the live checkout, confirm the free-shipping block renders, and that a US address shows the qualified message.
7. **O7:** in App Home:
   - create, edit and delete `QA TEST – upgrade-api-version-2026-10 – delete me`;
   - confirm the count and questions match the O2 baseline;
   - confirm the dashboard warning is gone.

**If something breaks after release:** in the checkout editor, remove or hide the block and save. Then fix forward
through `docs/process/bug-fix-workflow.md`. Do not re-release `checkout-extensions-2` without first checking
plan §3.5, because a rollback release can delete data the older version lacks.

## Follow-ups (not in scope; pick up after release)

- `docs/dev-fixtures.md` has a stale storefront password; the working one is in the theme project's fixtures.
- `shopify app build` copies three PNGs into `extensions/app-home/`, and they aren't gitignored. Add a `.gitignore` entry.
- The app-tools and app-home tsconfigs have no `include`, so `tsc` type-checks `dist/`. Add an `include`.
- Two known type errors: `Checkout.jsx:223` (`accessibilityLabel` given `string | array`), and
  `FaqPage.jsx:82` (implicit any).
- Document the deploy procedure in `CLAUDE.md` "Deploy targets" now that the app is live, so `/ship` can work.
- Root `package.json` still has the npm-only `workspaces` field (plan D8).
- `CLAUDE.md` line ~271 has kebab-case attribute examples, but 2026-10 uses camelCase.
- The plan's metafield `owner_type` note becomes required at 2027-01. No extension declares metafields today.

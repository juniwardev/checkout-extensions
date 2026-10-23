# Plan review: `upgrade-api-version-2026-10`

**Reviewer:** Plan-Reviewer (adversarial)
**Date:** 2026-10-23
**Plan:** `docs/plans/upgrade-api-version-2026-10.md`
**Pass:** 1
**Verdict scope:** a platform upgrade that is meant to change no behaviour. It touches 5 version surfaces, 2 lockfiles and the project docs. This first pass concentrates on whether the acceptance criteria can tell a correct upgrade from a broken one.

---

## Method and limits of this pass

- I re-read `CLAUDE.md` and `AGENTS.md` in full. Both have 374 lines and their rendered content matches line for line. I could **not** run `cmp`, `git`, `tsc` or `shopify`, because this pass had no shell. Byte identity, the `git diff` of `extensions/app-tools/shopify.d.ts`, and every tsc figure are therefore **not** independently confirmed.
- I called `learn_shopify_api` (`polaris-checkout-extensions`, `polaris-admin-extensions` and `admin`), passing `version: "2026-10"` explicitly to it, to `search_docs_chunks` and to `validate`.
- I checked the plan's claims about installed types against `node_modules` directly. This was the only way to check the `WithGeneratedTools` question without a shell.

## Manifest entries: what I sampled and what I took on trust

**Sampled and confirmed:**

- **All 8 `file:line` citations** in §3.2/§4: the three `api_version` lines, `shopify.app.toml:12`, `shared/models/faq.ts:29`, and the three `@shopify/ui-extensions` specifier lines. They are exact.
- **`CLAUDE.md` anchors** (by grep):
  - `2026-04` × 11 at 5, 7, 13, 110, 116, 136, 176, 183, 208, 244, 341.
  - `100KB` × 3 at 76, 111, 355.
  - `--force` at 54 and 64.
- **The AC-1 pre-state.** Outside `docs/` and the lockfiles, the only matches are the 3 TOMLs, `shopify.app.toml`, `faq.ts`, `CLAUDE.md` and `AGENTS.md`. `.claude/` has none. Nothing else in the repo pins a version: `.graphqlrc.js` has no schema files to point at, `mcp.json` is a package tag, and `extensions/*/manifest.json` is gitignored. **Every version pin is covered.**
- **Lockfile state:**
  - `pnpm-lock.yaml` importers: `~2025.10.12`→`2025.10.15`, `rc`→`2026.7.0-rc.5`, `2026.4.x`→`2026.4.0`.
  - `package-lock.json` has no free-shipping-progress entry, and still carries `rc` and `~2025.10.12`.
  - `.modules.yaml` shows `pnpm@11.5.2`.
- **B_prev.** `docs/qa/free-shipping-progress-report.md` "Build check (Step 3)" reads 22.2 KB original, ~8.7 KB compressed.
- **MCP at 2026-10:**
  - The checkout target list has `contact.render-after` only and `payment-method-list.render-before/after`, so DC-b's target corrections are right.
  - **I closed the plan's own gap on field types.** The `checkout-ui-extensions/2026-10` page lists exactly `boolean, single_line_text_field, multi_line_text_field, number_integer, number_decimal, date, date_time, variant_reference`. The `choices` validation is documented for `single_line_text_field`. DC-b is correct as written.
  - Both changelog quotes are verbatim: the 64 KB limit, and "every existing UI extension uses API version 2026-01 or later".
  - `admin.app.tools.data` is documented at 2026-10. `admin.app.home.render` requires 2026-07 or later.
- **Validator.**
  - I ran the full `Checkout.jsx` logic through `validate` at 2026-10 / `purchase.checkout.block.render`. It reported exactly one error, the `s-progress` `accessibilityLabel` `string | any[]` error. **Reproduced.**
  - Admin GraphQL: I sampled 2 of the 5 operations (`metaobjects` list and `metaobjectUpdate`). Both are valid at 2026-10.
- **App Home JSX (a gap the plan admits; partly closed).**
  - `HomePage` validates clean at 2026-10 / `admin.app.home.render`.
  - For `FaqPage`, every component, prop and slot is recognised. The remaining diagnostics come from the validator ignoring JSDoc `@type` casts, not from the API surface. That is not a substitute for tsc.

**Taken on trust:**

- The npm dist-tag `2026-10` → `2026.10.2`.
- The date 2025-10 left support.
- Whether CLI 4.8.5 accepts `2026-10`.
- All E0/E1 tsc figures.
- The content of the uncommitted `shopify.d.ts` diff against HEAD.

---

## Correctness

The plan solves the stated problem.

- **Every pin is enumerated**, and the target state is coherent.
- **The deploy-blocker reasoning is sourced correctly.** app-tools at 2025-10 is below the 2026-01 floor.
- **D1 is well argued.** `2026.10.x` excludes pre-releases and cannot cross API versions, which fixes the floating `rc`.
- **D3 is a genuine find.** `shared/models/faq.ts` pins its own Admin API version.
- **CLAUDE.md Plan-Reviewer checks:**
  - **Sandbox:** no new code. The single literal edit stays inside a documented `shopify:admin` direct-API fetch.
  - **i18n:** no new strings.
  - **Build:** `shopify app build` is in Step 0, in every commit loop, and in AC-7.
  - **Targets, signals and components:** all confirmed at 2026-10, as listed above.

Where the plan falls short is not the change itself. **Several criteria would pass on a broken build, or go red on a correct one.** The findings below are about that.

---

## Findings

### F1. AC-8 can compare two empty type-checks and pass. REQUIRED (does not block a build; the most important finding)

**What AC-8 is meant to do.** §5 says "the type-compat evidence (E0/E1) and the runtime checks are what protect these jumps". AC-8 is that evidence for a 3-version jump on app-tools and a 2-version jump on free-shipping-progress.

**Why it can be empty.** The three tsconfigs are not mutually compatible:

- `extensions/app-tools/tsconfig.json` and `extensions/app-home/tsconfig.json` set `"moduleResolution": "node"` **and** `"ignoreDeprecations": "6.0"`.
- `extensions/free-shipping-progress/tsconfig.json` sets `"moduleResolution": "node"` with **no** `ignoreDeprecations`.

Step 6 picks **one unpinned** TypeScript version for all runs. The repo has no `typescript` dependency, so `npx -p typescript@<ver>` downloads whatever the Coder names. As I understand TypeScript (I could not run it to confirm):

- Under 5.x, `ignoreDeprecations: "6.0"` is an invalid option value. That affects app-tools and app-home.
- Under 6.x, `moduleResolution: node` is a deprecation error unless it is silenced. That affects free-shipping-progress.
- `tsc` does not report semantic diagnostics when option diagnostics are present.

So with any single version, at least one extension's E0 and E1 may each contain only a `TS5xxx` option error. "E1 = E0" then holds whatever the new package does to the types. That is a **green result on a build nobody type-checked**.

**The brief's figures suggest this is not hypothetical.** The brief reports exactly one semantic error per extension, which no single TS version should produce from these three tsconfigs. The likeliest explanation is that the brief used different TS versions per extension, which the plan cannot reproduce.

**Fix (cheap, and harmless if I'm wrong):**

- Pin `typescript@6.x` and record the exact version.
- Pass `--ignoreDeprecations 6.0` on the command line for all three runs. That needs no tsconfig edit, so there is no scope creep.
- Add a **positive control** to Step 6 and AC-8:
  - E0 must contain the known semantic errors `Checkout.jsx:223` and `FaqPage.jsx:82`.
  - No E0 or E1 may contain any `TS5xxx` option or config diagnostic.
  - If either condition fails, stop. That run did not type-check anything.

### F2. The app-tools `shopify.d.ts` baseline depends on an unexplained working-tree file. REQUIRED (does not block a build)

**What I verified in `node_modules`:**

- The installed `@shopify/ui-extensions@2025.10.15` does **not** export `WithGeneratedTools`. I checked both the pnpm store copy and npm's leftover copy under `extensions/app-tools/node_modules/.ignored/`.
- `2026.7.0-rc.5` **does** export it, in `build/ts/surfaces/admin/api.d.ts`.
- Your brief says the committed file uses `Api & { tools }` and does not reference `WithGeneratedTools`.

**Why that matters.** The `WithGeneratedTools` error is a property of **(uncommitted working-tree file × 2025.10 package)**. It is not a property of app-tools at HEAD, which probably type-checks clean on 2025.10, though I could not run tsc to confirm. The plan never says outright that the committed file fails. But three things in it silently depend on the working tree:

1. **The E0 row** says "app-tools = 1 on 2025.10". It doesn't say which `.d.ts` that refers to.
2. **AC-8(b)** ("the `WithGeneratedTools` error persists if the package was not bumped") only works if E0 contains that error. Two things in Step 0 can change that:
   - Step 0 never pins the file's state. The CLI upgrade followed by the B0 build (steps 1 and 5) may rewrite the file.
   - A Coder who restores the unknown-origin change for hygiene removes the error.

   In either case "E0 minus that diagnostic" is just E0, and (b) can no longer go red.
3. **Step 12's R5 check** ("check `git status`; if the CLI did not regenerate the file, run `dev`") can't be observed for this file. It is already `M`, so `git status` reads the same whether or not the CLI rewrote it.

The commit-body sentence "includes previously uncommitted CLI output" also asserts an origin that nobody has verified.

**Fix:**

- **Step 0 should establish the file's state deliberately:**
  1. Paste the `git diff` into the impl notes and copy the file to the scratchpad.
  2. Restore HEAD with `git checkout -- extensions/app-tools/shopify.d.ts`. Restoring is not hand-editing, and the diff is preserved.
  3. Run the B0 build and record whether it rewrote the file, using `shasum` before and after.

  This answers R5 (does build regenerate?) and the origin question (does the CLI produce the `WithGeneratedTools` form?) in one step. It also measures E0 on committed code.
- **Replace AC-8(b) with a check that tests the right thing:**
  - After C1, `extensions/app-tools/node_modules/@shopify/ui-extensions/build/ts/surfaces/admin/api.d.ts` exports `WithGeneratedTools`.
  - E1(app-tools) contains no diagnostics.
- **Word the commit body by outcome:**
  - If step 3 showed the CLI regenerates the `WithGeneratedTools` form, say "CLI-regenerated".
  - Otherwise say "of unverified origin".

**Minimum acceptable alternative** if the operator wants the working-tree file left alone: record its sha256 at Step 0 step 3, and again after every build or `dev` run. That makes regeneration observable. AC-8(b) must still be replaced as above.

### F3. AC-11 says it catches `deliveryGroups` regressions, but none of its checks use `deliveryGroups`. REQUIRED (does not block a build)

**The stated red-on condition is unreachable.** AC-11 says it goes red on "a host-behaviour change at 2026-10, e.g. in the cost signal or `deliveryGroups` shape". Its five checks are:

- (i) manual mode, below threshold
- (ii) manual mode, at or over threshold
- (iii) tone
- (iv) Spanish locale
- (v) 375px viewport

**None of them reads `shopify.deliveryGroups`.** That signal is only read in auto-detect mode, which is the **default** (`use_shopify_free_shipping_rate !== false`). AC-11 also has no empty-cart check, which is the only path that branches on `shopify.lines`. AC-11 as written would pass if `costAfterDiscounts` were renamed at 2026-10.

**The QA history shows how weak this path's coverage already is.** In `docs/qa/free-shipping-progress-report.md`:

- Check 3 (auto-detect qualified) was **never** confirmed by Playwright. Cloudflare bot protection blocked address entry.
- Checks 3 and 12 only passed in the operator's manual walk-through on 2026-06-11.

**AC-11 (i) also relies on reading the bar's accessibility label.** The prior QA run said directly that "DOM attribute inspection [was] blocked (extension renders in cross-origin checkout iframe)".

**Fix:**

- Add §11 checks 1 (empty cart), 3 (auto-detect qualified from a discount-driven zero-cost option) and 12 (auto-detect suppression).
- Name the operator's manual walk-through as an accepted method for any check that Playwright can't reach, following the 2026-06-11 precedent. Record the method used for each check.
- For (i), allow visual confirmation of the fill or message if the accessibility tree can't be read.
- Restore the checkout-editor settings afterwards.

### F4. AC-7's "64 KB gate not reachable" uses free-shipping-progress's headroom for all three extensions. REQUIRED (does not block a build)

**The headroom figure only measures one extension.** The gate applies to "every extension that reports a size". But its unreachability argument ("would need about +55 KB over B_prev") and R9's "headroom is about 55 KB" both come from **free-shipping-progress's** 8.7 KB. The plan itself says app-home and app-tools have **no** recorded size.

**What a pre-existing overage would do.** app-home bundles `preact`, `preact-iso` and `@preact/signals`, and is probably well under 64 KB. If it were already over, though, AC-7 would go red on a correct upgrade, and the plan gives the Coder no instruction for that case.

**Fix:**

- Limit the "not reachable" wording to free-shipping-progress.
- Add a rule: if B0(e) > L for any extension, stop and escalate. That is a pre-existing deploy blocker, not an upgrade regression.

### F5. Step 0 and AC-9 go red on a correct build because the plan and review are untracked. REQUIRED (does not block a build)

**The conflict.** Git status shows `?? docs/plans/upgrade-api-version-2026-10.md`, and this review will also be untracked. Step 0 expects `git status --porcelain` to show "only ` M extensions/app-tools/shopify.d.ts`". AC-9 requires two things:

- `git diff --stat <base>..HEAD` lists only the files in §4. Neither the plan nor the review is in §4.
- `git status --porcelain` is empty after the last commit.

**Why a correct build fails AC-9 either way:**

- If the Coder commits the two docs, AC-9's file-list check fails.
- If the Coder leaves them uncommitted, AC-9's empty-status check fails.

**Fix:** state that the plan and review are committed in a docs-arc commit **before** Step 0, as `7ed0952` did for the previous fix, and take `<base>` after that commit. Alternatively, exclude those two paths explicitly from both checks.

### F6. AC-14's pathspec may not match any file. REQUIRED (does not block a build)

**The concern.** In `git diff --stat <base>..HEAD -- 'extensions/*/src' shared`, a git wildcard pathspec is matched against the **whole** path. As I understand git, `extensions/*/src` matches a path that *ends* in `/src`, not `extensions/free-shipping-progress/src/Checkout.jsx`. I could not run git to confirm this. If I'm right, AC-14 always shows only `shared/models/faq.ts`. That would erase the one criterion the sweep credits with telling D4 apart from "fix it in scope".

**Fix:**

- List the paths explicitly: `extensions/app-home/src extensions/app-tools/src extensions/free-shipping-progress/src shared`. Or use `':(glob)extensions/*/src/**'`.
- Add a positive control: the same command over `d15838d^..d15838d` must list `Checkout.jsx`.

### F7. Relabelling line 208 certifies two component lists that name components which don't exist. REQUIRED (does not block a build; the text reaches every agent)

**The plan's own rule applies here.** DC-b's rationale is: "Relabelling a list 'at 2026-10' would certify the entries in it". The plan applies that rule to the targets list and the field types. It does not apply it to the component lists, which sit directly under the line-208 header that DC-a relabels to "on `api_version = "2026-10"`".

**What is wrong in those lists.** Compared with the 2026-10 checkout component list returned by `learn_shopify_api`:

- **§4 (lines 261–269)** names 8 components that don't exist: `s-spacer`, `s-pressable`, `s-skeleton`, `s-skeleton-text`, `s-skeleton-image`, `s-thumbnail`, `s-disclosure`, `s-tag`.
- **The Coder list (lines 123–130)** includes `s-pressable`, `s-skeleton` and `s-thumbnail`.

The 2026-10 equivalents are:

| Listed in CLAUDE.md | 2026-10 equivalent |
| :-- | :-- |
| `s-pressable` | `s-clickable` |
| `s-thumbnail` | `s-product-thumbnail` |
| `s-skeleton*` | `s-skeleton-paragraph` |
| `s-disclosure` | `s-details` |
| `s-tag` | `s-chip` |
| `s-spacer` | none (use `gap`) |

**Why this matters on this project.** The first plan here had to be reworked because it named components that don't exist. The plan currently defers these lists to follow-ups.

**Fix:** either fold both lists into DC-b (vetoable under OQ-3, like the rest of DC-b), or at minimum add a one-line note at both lists saying they are unverified at 2026-10.

### NITs (none of these blocks or changes a decision)

- **N1. CLI 4.x upgrades itself.**
  - shopify.dev says: "Starting with Shopify CLI 4.0, Shopify CLI upgrades itself automatically". So D5's "B0 and B1 come from the same CLI" can break mid-run. Record `shopify version` at Step 0 **and** at final verification.
  - `shopify upgrade` also changes a global install that the Liquid theme project shares. Auto-upgrade would do that anyway.
- **N2. `shopify app build` installs dependencies by default.**
  - Its `--skip-dependencies-installation` flag exists for that reason. The plan admits it didn't check which package manager the CLI picks when both lockfiles exist.
  - The tree shows a past npm install:
    - `node_modules/.package-lock.json`
    - a root `node_modules/@shopify/ui-extensions` at `2026.7.0-rc.5`, which pnpm's isolated linker did not create
    - `extensions/app-tools/node_modules/.ignored/`
  - At Step 0, record which manager the build runs (`--verbose`). Clearing the stray npm artifacts is a follow-up.
- **N3. D6 in Commit 1 records a transitional pre-release.**
  - In C1, `npm install --package-lock-only` resolves app-home's still-`rc` specifier to *today's* `rc` dist-tag, probably a 2027-01 RC, and C1's npm lock records it. That is harmless (C2 fixes it), but it could surprise someone reading the history.
  - "If npm fails … stop" blocks the whole upgrade on a file nothing uses. Falling back to OQ-1 (record the failure, skip D6) is a better default.
- **N4. AC-4 has no exact command.** All the other mechanical criteria are in the bash block. Add one, e.g. a `jq` or `rg` line.
- **N5. DC-a's line-136 row is ambiguous.** It doesn't say whether "(re-confirmed at 2026-10, Cart Lines API)" is text to insert or a note for the Coder.
- **N6. DC-a's line-183 replacement adds new policy under a "required" label.**
  - It adds two rules: that all of these surfaces stay on one version, and that dist-tags are banned. That is policy, not a relabel, and it sits in DC-a, which the operator cannot veto.
  - The content is sensible. Naming it in OQ-3 would give the operator a clean choice.
- **N7. The follow-up has documentary support.** Shopify's own direct-API examples use the unversioned `fetch('shopify:admin/api/graphql.json')`. Keeping it a follow-up is fine.
- **N8. AC-7 compares figures from two different tools.** The CLI's "~X KB compressed" is an estimate; the platform enforces the 64 KB limit with its own measurement. At 8.7 KB the difference doesn't matter.
- **N9. AC-1's `faq.ts` check only counts positive matches.** Requiring every `shopify:admin/api/` line under `shared` and `extensions` to say `2026-10` is stricter. Only one URL exists today, so this changes nothing yet.

---

## Specific questions from the brief

- **Is every version pin covered?** Yes, see the manifest section. The `package.json` dot-forms (`2025.10`) are outside AC-1's regex, but AC-2 covers them.
- **Would the ACs and grep checks catch a broken or incomplete upgrade?**
  - **Missed pins:** AC-1 and AC-2 catch them.
  - **Stale lockfiles:** AC-3, AC-4 and AC-5 catch them.
  - **Type regressions:** AC-8 does **not** reliably catch them as written (F1, F2).
  - **Runtime regressions on the default checkout path:** AC-11 does **not** catch them (F3).
  - **In-scope source edits:** AC-14 may not catch them (F6).
- **Lockfile handling:**
  - pnpm handling is sound: `pnpm install` rather than `update`, R_peer is compared, and the AC-3 regex correctly hits both the `packages:` and `snapshots:` keys.
  - npm handling is defensible under the current `CLAUDE.md` convention. See N2 and N3.
- **`CLAUDE.md`/`AGENTS.md` edits:**
  - The anchors are accurate.
  - The DC-b content is correct at 2026-10.
  - The `cp` + `cmp` procedure, with a stop if Step 0 finds a difference, is the right way to keep the files identical.
  - The gap is F7.
- **Sequencing and rollback:**
  - The commit order and per-commit gates are sound.
  - `git revert <C1>^..<C5>` is the correct range syntax.
  - The forward-only caveat after a deploy is properly flagged as unverified (R7).
- **Scope creep:** none in application code; the only source edit is the `faq.ts` literal.
  - DC-b, DC-c and DC-d go beyond a relabel, but are factual, sourced and vetoable.
  - The line-183 policy is the one addition that isn't vetoable (N6).
- **Do the open questions block the Coder?** No.
  - Every OQ has a default.
  - OQ-4 only stops the Coder if `cmp` fails, which is correct behaviour.
  - D5 is executable by the Coder.

## Trajectory

This is the first pass. The plan is unusually thorough, and its self-check manifest held up wherever I sampled it. None of the findings challenges the decisions themselves (D1–D7). All seven REQUIRED items are corrections to criteria or procedure, and each fix is a few lines.

## Required changes

1. **(F1)** Pin `typescript@6.x` and record the version. Run all three tsc invocations with `--ignoreDeprecations 6.0` on the command line. Add a positive control to Step 6 and AC-8: E0 must contain `Checkout.jsx:223` and `FaqPage.jsx:82`, and no E0 or E1 may contain a `TS5xxx` option or config diagnostic. Otherwise stop.
2. **(F2)** Make the state of the app-tools `shopify.d.ts` deliberate at Step 0. Preferred: save the diff, restore HEAD, run the B0 build, and record the sha before and after, so that R5 and the file's origin are both answered. Minimum: track its sha256 at Step 0 and after every build or `dev` run. In both cases:
   - Replace AC-8(b) with a direct check that the installed app-tools package exports `WithGeneratedTools`, and that E1(app-tools) is empty.
   - Say which `.d.ts` the E0 row refers to.
   - Word the commit body according to whether the CLI was shown to produce the file.
3. **(F3)** Add `free-shipping-progress` §11 checks 1, 3 and 12 to AC-11. Name the operator's manual walk-through as an accepted method for any check Playwright can't reach, and record the method per check. Give (i) a fallback for when the accessibility tree can't be read. Restore the editor settings afterwards.
4. **(F4)** Limit AC-7's and R9's "not reachable / ~55 KB headroom" wording to free-shipping-progress. Add a rule: if B0(e) > 64 KB for any extension, stop and escalate it as a pre-existing deploy blocker.
5. **(F5)** State that the plan and this review are committed before Step 0, and take `<base>` after that commit. Alternatively, exclude both files from the Step 0 expectation and from AC-9.
6. **(F6)** Replace AC-14's `'extensions/*/src'` with explicit paths, or `':(glob)extensions/*/src/**'`. Add the positive control: the same command over `d15838d^..d15838d` must list `Checkout.jsx`.
7. **(F7)** Bring the two component lists in `CLAUDE.md` (lines 123–130 and 261–269) under DC-b and correct them against the 2026-10 list, or at minimum annotate both as unverified. Otherwise the line-208 relabel certifies 8 component names that don't exist at 2026-10.

APPROVE WITH CHANGES

---

## Review Pass 2 — 2026-10-23

**Scope of this pass:**

- Confirm that each Pass 1 finding (F1–F7) is actually fixed in revision 1, not just listed as fixed.
- Scrutinise the new material:
  - C0 (pnpm only) and D8.
  - The DC-b and DC-f doc text.
  - The rollback guidance (§3.5) and the operator deploy/release runbook (§3.6).
  - R11–R13 and the rewritten AC-4, AC-7, AC-8, AC-11 and AC-14.
- Look for anything the revision broke elsewhere in the plan.

I re-read `CLAUDE.md`; it is unchanged since Pass 1. I read the whole revised plan, 1176 lines.

**Confirmed by me this pass:**

- **DC-b component names.** Every name the revised DC-b uses or keeps is in the 2026-10 checkout component set. Source: `learn_shopify_api` (`polaris-checkout-extensions`, `version: "2026-10"`).
  - Replacements: `s-clickable`, `s-skeleton-paragraph`, `s-product-thumbnail`, `s-details`, `s-summary`, `s-chip`.
  - Names that stay: `s-stack`, `s-box`, `s-grid`, `s-divider`, `s-text`, `s-heading`, `s-link`, `s-button`, `s-text-field`, `s-checkbox`, `s-select`, `s-choice-list`, `s-number-field`, `s-date-field`, `s-banner`, `s-spinner`, `s-image`, `s-icon`, `s-modal`, `s-tooltip`, `s-badge`, `s-progress`.
  - **Every corrected name exists.**
- **AC-10 regexes against the replacement text.** None of the new text would trip the checks:
  - `s-thumbnail` does not match `s-product-thumbnail`.
  - `s-skeleton[^-]` does not match `s-skeleton-paragraph`.
  - The DC-f and DC-b text contains none of the banned phrases.
- **DC-f anchors.** The line-44 and line-186 anchors match `CLAUDE.md` verbatim. A grep for `npm|lock|yarn` finds no other stale package-manager text. The two lines the plan keeps on purpose (20 and 368) are correctly kept. In `.claude/agents/devops.md` the only stale text is the `--force` flag, which is already a follow-up.
- **Deploy and release flags** (shopify.dev CLI reference):
  - `shopify app release --version <name>` exists, and `--version` is required.
  - `app release` also takes `--allow-updates` and `--allow-deletes`. One of them is required only in non-interactive runs.
  - `shopify app deploy --no-release` and `--message` exist.
  - shopify.dev says: "If you want to create a version, but avoid releasing it to users, then run the deploy command with a `--no-release` flag. You can release the unreleased app version using Shopify CLI's release command, or through the Dev Dashboard."

**Taken on trust from the coordinator's shell checks** (not re-checked):

- `cmp CLAUDE.md AGENTS.md` exits 0. That resolves OQ-4.
- `d15838d` touches only `extensions/free-shipping-progress/src/Checkout.jsx`. The AC-14 control therefore has a valid target.
- The current `git status`.
- The user's reading of `getPackageManager` in CLI 4.8.5.

**Still not run by anyone:** `tsc`, `pnpm dlx`, and the CLI itself, including on the upgraded CLI.

### 1. Pass 1 findings: verified fixed

| Finding | Status | Evidence in revision 1 |
| :-- | :-- | :-- |
| F1 tsc could compare two runs that checked nothing | **Fixed** (but see P2-1 for a new capture defect) | TSV is pinned to one exact `6.x.y` (B2.1). `--ignoreDeprecations 6.0` is passed on every `TSC(e)`. The positive control requires `Checkout.jsx(223,` and `FaqPage.jsx(82,` in E0 **and** E1, plus no `TS5xxx` diagnostic. For app-tools, `exit=0` and `--listFilesOnly` cover the case where a config error would hide an empty program. I also checked whether a `TS6xxx` config error (for example TS6046) could slip past the `TS5xxx` filter. It can't: fsp and app-home would lose their control lines, and app-tools would fail `exit=0`. |
| F2 app-tools `.d.ts` baseline | **Fixed** | A4 saves the diff and a copy, restores HEAD, and expects a clean status. DTS_sha is taken around every build and dev run, which makes R5 observable. E0(app-tools) is measured on HEAD and is not compared. E1(app-tools) = ∅ with `exit=0`. AC-8(b) is now a direct export check. C1.8 words the commit body by outcome and never claims an origin nobody observed. (See P2-N1 for a caveat on the export check, which was my own suggestion.) |
| F3 AC-11 never read `deliveryGroups` | **Fixed** | (vii) auto-detect qualified, with a discount-driven zero-cost option, explicitly not a flat $0. (viii) suppression, then qualification. (vi) has an honest "not reachable at checkout" outcome, with correct reasoning: `lines` is read on every render. Each check records its method, and the operator walk-through is accepted. The accessibility-tree fallback, restoring settings, and stopping `dev` are all included. AC-11's red-on now names (vii) and (viii) as the `deliveryGroups` detectors, and both can be reached. |
| F4 bundle headroom from one extension | **Fixed** | B1.3 stops if B0 > 64 KB. AC-7 is a guard for free-shipping-progress and a test for app-home and app-tools. R9 is re-scoped to match. |
| F5 untracked plan and review | **Fixed** | A0 commits exactly these two paths, and `<base>` is the A0 SHA. A3 is now consistent with A0. |
| F6 AC-14 pathspec | **Fixed** | The paths are listed explicitly. The positive control over `d15838d` runs first, and its target has been shell-verified. |
| F7 component lists | **Fixed** | All 9 lines are covered (126/128/129 and 261/263/265–268), with exact anchors. The names are verified above, and AC-10(c) catches a missed line. |

**Pass 1 NITs.** N1, N2 (with one gap, see P2-2), N4, N5, N6 (now DC-e, vetoable via OQ-6), N8 and N9 are all taken. N9's new URL check comes with a count of 1, so it cannot pass vacuously. N3 is moot. N7 is correctly left as a follow-up.

### 2. New findings

#### P2-1. `TSC(e)` captures pnpm's stdout as well as tsc's. REQUIRED (does not block a build)

**The defect.** `TSC(e)` runs `pnpm --package=typescript@<TSV> dlx tsc … > <scratch>/raw.txt`, then `sort`s the whole file into the E set. `pnpm dlx` prints its own resolution and progress output before it runs the command, for example "Packages: +1" and "Progress: resolved 1, reused 0, downloaded 1, added 1, done". In a non-TTY run pnpm's default reporter writes to **stdout**, as far as I know. I could not run pnpm to confirm this.

**What follows if it does:**

- **E1(app-tools) is never empty**, so C1.7 stops a correct build.
- **E0 and E1 differ.** The first run downloads TypeScript; later runs reuse the cache, so the progress lines differ. `diff E0 E1` then turns AC-8 red on a correct build. This is the mirror image of F1: the criterion goes red on a correct build rather than green on a broken one.

The `npx -y -p` alternative puts its notices on stderr, but the plan presents it as optional.

**Fix:**

- Silence pnpm's reporter: `pnpm --reporter=silent --package=typescript@<TSV> dlx tsc …`. Alternatively, keep only diagnostic lines (`<path>(<line>,<col>): error TSnnnn: …` and their two-space continuation lines) before sorting.
- Add a check to B2: every line of each E0 file must be a diagnostic or a continuation line. Then a regression in the capture shows up at the baseline, not at C1.

If pnpm turns out to write progress to stderr, this costs nothing.

#### P2-2. PM_build has no pass condition when the build installs nothing. REQUIRED (does not block a build)

**Why it matters.**

- B1.4 says to "record the dependency-install command from the log", and both the PM_build row and AC-4 say it "must be pnpm".
- C0 has just done a clean `pnpm install`, so a `shopify app build` may find nothing to install and log **no** install line.
- The plan doesn't say what that means, and a literal reading of AC-4 leaves it red, or undefined, on a correct build.

**The version mismatch.** The user's reading of `getPackageManager` was made on **CLI 4.8.5**. The run uses the upgraded CLI (≥ 4.9.4), so PM_build is the only observation on the CLI that actually runs. With `package-lock.json` deleted and `pnpm-lock.yaml` present, an npm selection is unlikely on any reasonable precedence order, so the risk itself is low.

**Fix.** Define the outcomes:

- An install line naming pnpm is a **pass**.
- No install line is "not invoked", which is **acceptable**. G-npm, which checks for npm artifacts, stays the guard.
- An install line naming npm, yarn or bun means **stop**.

Record the CLI version next to PM_build.

#### P2-3. DC-f's yarn claim is wrong, and G-npm doesn't check for a stray `yarn.lock`. REQUIRED (does not block a build; the text reaches every agent)

**The defect.** The DC-f replacement for line 44 says the CLI "never reads an npm or yarn lockfile, so one would silently go stale". By the precedence the user verified, `getPackageManager` checks **`yarn.lock` first**, before `pnpm-lock.yaml`. So:

- A stray `package-lock.json` would indeed go stale.
- A stray `yarn.lock` would **switch the CLI to yarn**, silently.

This is a false fact in a permanent project doc, and it makes the more dangerous case sound harmless.

**The guard has the same gap.** G-npm checks for `package-lock.json` anywhere and for **tracked** foreign lockfiles. It does not check for an **untracked** `yarn.lock` at the root, which is exactly what an accidental `yarn` produces, and the one that changes CLI behaviour.

**Fix:**

- Reword DC-f, for example: "…never reads `package-lock.json`, so one would silently go stale; a `yarn.lock` would take precedence over pnpm and switch the CLI to yarn."
- Add `test ! -e yarn.lock && echo OK-no-yarn-lock` to G-npm, and update "All four lines" to five.

Keep the new wording free of AC-10's banned phrases.

#### P2-4. §3.6 O3 waits for a change summary that `--no-release` probably skips. REQUIRED (does not block a build; this is an operator runbook)

**The problem.** O3's pass condition is: "When the CLI prompts, the change summary must show the 3 extensions as updated, with no deletions … If it shows a deletion, abort."

The CLI reference lists `--no-release` as an **alternative** to `--allow-updates` and `--allow-deletes` in non-interactive runs ("provide this flag, --allow-updates, or --no-release"). That indicates the add/update/delete confirmation belongs to the *release*, and `deploy --no-release` creates the version without asking. `app release` carries its own `--allow-updates` and `--allow-deletes` flags, and one of them is required when non-interactive. So the summary O3 waits for may never appear, and the operator's only deletion check would silently not run.

**Why it matters here.** The live version's contents aren't recorded anywhere in the plan, so the deletion check is real protection.

**Fix.** Move the "3 extensions updated, no deletions, no unexpected config changes" check to the point where it is shown:

- the `shopify app release --version …` confirmation in O4, run interactively and without `--allow-deletes`; and/or
- the new version's detail page in the Dev Dashboard, inspected between O3 and O4.

Make O3's pass condition simply "a new version is created and its name recorded".

#### P2-5. Step and commit names collide or are stale. REQUIRED (does not block a build; this text reaches the Coder and the operator)

1. **"Final" steps F1–F7 reuse the names of review findings F1–F7.** The plan cites both kinds. For example, §4 says the impl notes are "written after the final checks (F5)", where F5 could mean final step F5 (write the notes) or review finding F5 (untracked files). The revision log and AC-8/AC-9/AC-14 use F-numbers for review findings, while §7 uses them for steps.
2. **Step "B1" and bundle measure "B1(e)" share a name.** B0(e) is measured at step B1, and B1(e) is measured at Final F2. R5's "B1 answers 'does build regenerate it?'" means the step, not the measure.
3. **§3.6 O1 names the wrong final commit.** O1 requires "HEAD is the final commit (C5, or a later QA fix)". The Coder's last commit is **C6** (impl notes), and project precedent commits the QA report too (`86e12c7`, `32cac43`). An operator checking O1 literally would stop.
4. **O1 points at the wrong step.** It says to stop `shopify app dev` "so no dev preview overrides the store during the check in O5". The live checkout check is **O6**.

**Fix:**

- Rename the final steps, for example to Z1–Z7, and update their cross-references.
- Rename either step B1 or the B1(e) measure.
- Change O1 to "HEAD is C6, or the later QA-report or QA-fix commit".
- Change "O5" to "O6" in O1.

### 3. New material that holds up

- **C0 (pnpm only):**
  - It is correctly placed after A0/A4 and before every baseline.
  - `--frozen-lockfile` together with `git diff --quiet -- pnpm-lock.yaml` and the C0.3 `pnpm ls` pre-state proves the reinstall changed no versions.
  - The clean `rm -rf` removes the npm leftovers I found in Pass 1 (`node_modules/.package-lock.json`, `extensions/app-tools/node_modules/.ignored/`).
  - G-npm's `node_modules/.package-lock.json` check is a sharp signal, because npm writes that hidden file on every install and pnpm never does.
- **Could `shopify app build` or `dev` recreate `package-lock.json` or run npm?**
  - With `pnpm-lock.yaml` and `pnpm-workspace.yaml` present and `package-lock.json` deleted, the verified precedence selects pnpm.
  - I found no CLI path that writes an npm lockfile.
  - G-npm checks for artifacts after every build and dev run, which is the right kind of guard. It doesn't matter *how* npm might get invoked; what matters is whether its artifacts appear.
  - The one gap is the `yarn.lock` precedence (P2-3).
- **D8 (keep `workspaces`): agreed.**
  - The CLI reference describes `--skip-dependencies-installation` as "Deprecated, use workspaces instead", which suggests the CLI does consider workspace layout.
  - Removing a field the CLI may read, inside a no-behaviour-change plan, would be the riskier choice.
  - Keeping it is conservative and is guarded by G-npm.
- **§3.5 rollback.**
  - shopify.dev says "You can revert to a previous app version at any time by releasing an older app version." It does not address whether a version below the 2026-01 floor can be re-released after 2026-10-01.
  - So the plan's "effectively forward-only, try the rollback but depend on nothing" stance is the right conservative reading.
  - The containment-first contingency (remove the merchant-placed block) is the right lever. See P2-N4 for one missing detail.
- **R11–R13:**
  - R11: CLI self-upgrade is handled. The delta is marked "not comparable", and the L gate is absolute.
  - R12: covered by G-npm and PM_build, once P2-2 is fixed.
  - R13: dev-preview containment is sound. QA runs on the password-protected dev store and stops `dev`, and O1 re-checks it.
- **Rewritten criteria, two-sided test:**
  - AC-4: red if C0 is skipped, on a habitual `npm install`, or if build picks npm; green on pnpm only.
  - AC-7: a test for app-home and app-tools, a guard for free-shipping-progress.
  - AC-8: red on a type regression, an un-bumped package, a "fixed" D4 error or a run that checked nothing. Green on a correct build once P2-1 is fixed.
  - AC-11: (vii) and (viii) read `deliveryGroups`.
  - AC-14: red on a source tidy-up or on a pathspec that matches nothing.

  **Each can now fail on the broken build it names.**

### 4. NITs (none blocks or changes a decision)

- **P2-N1. AC-8(b)'s export path is unverified at 2026.10.** This was my own Pass 1 suggestion, and I based it on `2026.7.0-rc.5`. It assumes the stable 2026.10.x keeps the `WithGeneratedTools` export in `build/ts/surfaces/admin/api.d.ts`, which no one has checked. If C1.5 counts 0, check `extensions/app-tools/node_modules/@shopify/ui-extensions/package.json` for the version first.
  - If the version is `2026.10.*` and E1(app-tools) is empty, escalate as "export moved".
  - Do not treat it as a failed bump.
  - AC-5 and C1.4 already prove the bump itself.
- **P2-N2. Larger E0 sets are expected under TypeScript 6.x.** If TS 6 enables stricter defaults, E0(free-shipping-progress) may contain extra TS7006 implicit-any diagnostics alongside `Checkout.jsx(223,`. That is expected. AC-8 compares sets, and only the control lines are required. One sentence in B2 would stop a Coder escalating a correct baseline.
- **P2-N3. The NPM_art row contradicts C0.4.** The row says every leftover "must be absent after the C0 clean reinstall". C0.4 says a reappearing root `node_modules/@shopify/ui-extensions` is "not a failure". Make the row match C0.4.
- **P2-N4. Containment needs the editor change saved.** Removing the block takes effect only once the checkout-editor change is saved or published. Say so in §3.5 step 1. Note too that this lever contains only the checkout extension; the admin extensions have no equivalent switch.
- **P2-N5. Stale "unverified" notes.** OQ-4, the N_doc row ("Byte identity is still **not** verified") and the manifest gaps for `cmp` and `d15838d` still read "unverified". The coordinator's shell checks now settle them. Mark OQ-4 resolved.
- **P2-N6. C2.2 and C3.2 pull in an app-tools-only step.** They say "repeat C1.6", whose step 5 compares the file against the saved **app-tools** working-tree copy. Say that step 5 applies to app-tools only.

### 5. Trajectory

- **Pass 1:** 7 REQUIRED findings, two of which could let the core type evidence pass vacuously.
- **Pass 2:** every one of those is genuinely fixed, and the user's new decisions are integrated coherently. 5 smaller REQUIRED items remain:
  - one capture defect that could turn AC-8 red on a correct build;
  - one undefined pass condition;
  - one wrong fact in permanent docs, plus a guard gap;
  - one runbook check placed at a step where it probably can't happen;
  - naming collisions.

Each is a text edit of a few lines. None challenges a decision. I expect Pass 3 to be a confirmation pass.

### Required changes (Pass 2, in the order to fix them)

1. **(P2-1)** Make `TSC(e)` capture only tsc diagnostics. Use `pnpm --reporter=silent … dlx`, or filter to diagnostic and continuation lines before `sort`. Add a B2 check that every E0 line is a diagnostic or a continuation.
2. **(P2-2)** Define PM_build's outcomes in B1.4, the PM_build row and AC-4:
   - pnpm install line = pass;
   - no install line = "not invoked", acceptable with G-npm green;
   - npm/yarn/bun = stop.

   Record the CLI version alongside it.
3. **(P2-3)** Correct DC-f's line-44 text: a `yarn.lock` would take precedence over pnpm, not go stale. Add `test ! -e yarn.lock` to G-npm, and update the line count in AC-4.
4. **(P2-4)** In §3.6, move the "3 extensions updated, no deletions, no unexpected config" check from O3 (`deploy --no-release`, which probably shows no summary) to the O4 release confirmation and/or the Dev Dashboard version detail before release. O3's pass condition becomes "version created, name recorded".
5. **(P2-5)** Fix the naming and references:
   - Rename the final steps (F1–F7 → for example Z1–Z7) and update their references, including §4's "(F5)".
   - Disambiguate step B1 from the B1(e) measure.
   - In O1, change "C5" to "C6, or the later QA-report or QA-fix commit", and "O5" to "O6".

APPROVE WITH CHANGES

---

## Review Pass 3 — 2026-10-23

**Scope of this pass:**

- Confirm each Revision 2 row: P2-1 to P2-5, and P2-N1 to P2-N6.
- Review the new dev-store = live-store material **adversarially**, because the dev store (`theme-evolution-os2.myshopify.com`) is where the released version is active (OQ-7). That covers R13, R14, the AC-11 identity check, Z4 and C1.6, O2, O4b, O6–O8, and §3.5.
- Sweep the whole file for stale step names after the BL/Z renames.

I re-read `CLAUDE.md`; it is unchanged. I read the whole revised plan, 1293 lines.

**Verified with the Shopify Dev MCP this pass** (`search_docs_chunks`, `version: "2026-10"` where versioned):

- **The dev-preview claims in R13 are correct.** shopify.dev "Test apps locally" says the following:
  - "When you stop the app dev command, the dev preview remains on your store … until you clean up the dev preview or uninstall the app."
  - "Cleaning a dev preview restores the active released version of your app to your store. If any extensions or configuration are removed in this process, their related data is deleted as well." The examples given are a checkout-editor placement and configuration, and the metaobjects of a metaobject definition.
  - The `app dev clean` CLI reference says it "restores the app's active version to the selected development store", and that `--store` must be "an existing development store".
- **The Dev Console can show what R14 asks for.** It shows the app name, the developer, the last-update time, whether the preview is connected to app dev, and the extensions in the preview.
- **Whether the Dev Console can be opened without running `dev` is ambiguous.** It has a "Clean dev preview" button, which implies it can. But the 2026-02-24 changelog says: "The Dev Console is available for your app when running `shopify app dev` and opening the admin". See P3-3.
- **Releasing a version deletes metaobjects whose definition it lacks**, after a short delay. From "Manage metaobject definitions": if a TOML metaobject definition is removed and the app is re-deployed, "Shopify deletes the definition and keeps the metaobjects and their values for a short period". Deleting a definition "also deletes all related metaobjects … asynchronously". The same thing therefore happens on a **rollback release** to an older version that lacks `$app:faq`, not only on a preview clean. See P3-2.
- **Release propagation is not instant.** Shopify says "It might take several minutes for app users to be upgraded to the new version." See P3-1.

**Taken on trust:** the coordinator's pnpm 11.9.0 test that `dlx` progress output does not reach stdout. The `--reporter=silent` flag and the BL2.4 capture check make that moot either way.

### 1. Revision 2 rows: verified

| Item | Status | Evidence |
| :-- | :-- | :-- |
| P2-1 | **Fixed** | `--reporter=silent` is on `TSC(e)` and on every `dlx` call. The BL2.4 capture check (`rg -v '^(.+\([0-9]+,[0-9]+\): error TS[0-9]+: .*\|  .*)$'`) prints nothing for a clean capture or an empty file, and catches a "Found N errors" summary line or pnpm noise. AC-8 extends the check to E1. |
| P2-2 | **Fixed** | BL1.4, the PM_build row and AC-4 all define pass / "not invoked" (with G-npm green) / stop, recorded with the CLI version. |
| P2-3 | **Fixed** | The DC-f line-44 text now states the real precedence (`yarn.lock` first, `package-lock.json` last) and the opposite effects of each stray file. The line-186 text covers `yarn.lock`. Neither contains AC-10's banned phrases. G-npm has the `yarn.lock` line, and AC-4 says "five". |
| P2-4 | **Fixed** | O3's pass condition is now "version created, name recorded". O4 (a) inspects the Dashboard version page and (b) runs an interactive `app release` with no `--allow-*` flags. If either shows a deletion, the operator aborts. |
| P2-5 | **Fixed, apart from the leftover names in P3-N1** | Z1–Z7 and BL1–BL3 are used throughout §7. §4 now says "(Z5)". O1 now says "C6, or the later QA-report or QA-fix commit" and points at O6. |
| P2-N1 to P2-N6 | **All taken** | The C1.5 fallback is three-way (moved / removed but clean / failed bump). BL2.6 says extra diagnostics are expected. C0.4 makes the root `@shopify/ui-extensions` record-only. §3.5 says to *save* the editor change, and says only the checkout extension has that switch. OQ-4 and the `d15838d` gap are resolved. C2.2 and C3.2 skip step 5. |
| OQ-6, OQ-7 | **Folded in** | C5.1 applies DC-e. §3.6 names the store. |

**The dev-preview correction is real and correctly diagnosed.** Revision 1's "stop `dev` and the release comes back" was wrong. "Never clean before the new version is released" is the right core rule.

### 2. Live-store safety review

**Phases A, B and C.**

- Phases A and B, and the build steps in C, only run `shopify app build`, which does not write to the store.
- The first write to the live store is the **first `shopify app dev`**: either C1.6.4 (conditional) or Z4.
- `dev` replaces the store's preview with this repo's extensions and config. It adds and updates. It could only *remove* something if the store currently shows an extension or config item that this repo lacks.
- The June QA already ran `dev` against this repo's three extensions, so that is unlikely. But nobody has recorded it before the plan's first write (see P3-N3).
- The intermediate state pushed by C1.6.4 (only app-tools upgraded) is visible on a password-protected store with no buyers. Acceptable.

**QA.**

- AC-11 restores the checkout-editor settings, and AC-12 creates and deletes its own test FAQ. Neither deletes existing data.
- On a store whose FAQs are real, AC-12's test entry should carry an unmistakable name (P3-N4).

**The deletion hazards are concentrated in §3.6 and §3.5.** The three REQUIRED findings below are all there.

### 3. Findings

#### P3-1. O4b cleans before anyone has confirmed the new version is active, and O7 has no baseline to compare against. REQUIRED (does not block a build; operator runbook on live data)

**The ordering problem.** O4b runs immediately after the release command returns. O5 ("the new version shows as active/released") comes **after** it. Shopify says stores may take "several minutes" to be upgraded to a new release.

`dev clean` "restores the active released version … to your store". If a clean during that window gives the store the **old** version, and O2(b) shows the old version lacks any of `app-home`, `app-tools` or the `$app:faq` definition, the clean deletes that data. That is exactly the failure O4b exists to prevent.

I could not establish whether this window exists for a clean. Waiting is free and costs nothing if it doesn't.

**The baseline problem.** O7's pass condition is "the same FAQ entries that existed before O4b". No step records them, so O7 compares against nothing.

**Fix:**

- Reorder to O4 → O5 → O4b.
- Make O4b's precondition "O5 confirms the new version is active".
- If O2(b) recorded that the old version lacks any item in the preview, also wait out the propagation window (O5 already uses about 1 hour), and re-confirm before cleaning.
- Add to O2: record the FAQ entries (count plus questions) before any clean. O7 then compares against that record.

#### P3-2. A rollback release has the same data-deletion hazard as a clean, and §3.5 doesn't warn about it. REQUIRED (does not block a build; operator runbook on live data)

**What §3.5 says now.** Step 2 says to "try a rollback by releasing the previous version". It warns only about running `dev clean` *after* a successful rollback.

**What it misses.** Releasing a version that lacks the `$app:faq` TOML definition deletes that definition, and its metaobjects follow after a short retention. Releasing a version that lacks `app-home` or `app-tools` removes those extensions. So the rollback release itself is the deleting act whenever O2(b) shows the old version is missing any of them. The O8 "if O5–O7 fail" path points straight at this step.

**Fix:**

- In §3.5 step 2 and O8, consult O2(b) first.
- If the old version lacks any item, the rollback deletes it. The interactive release confirmation will list the deletion. Do not accept it without an explicit decision. Prefer containment and fix-forward.
- Add a recovery note: if FAQs vanish after a release or clean, the docs say a definition re-added "before cleanup runs" is recreated and the existing metaobjects are reassociated. So releasing a version that contains `$app:faq` promptly is the recovery path.

#### P3-3. The identity checks don't fail safe in the release direction. REQUIRED (does not block a build)

**AC-11 to AC-13 (testing the preview).** The positive discriminator is the **bundle host**:

- A dev build served from the tunnel (`*.trycloudflare.com`, as the June QA recorded) cannot be the release.
- The Dev Console labels are unconfirmed (the plan's own gap), and the Console's availability without `dev` is ambiguous.

AC-11 currently stops only when "the preview isn't active". Make the **tunnel host a hard gate**: if the checkout or App Home bundle isn't served from the tunnel, stop. Keep the Dev Console reading as corroboration, and treat a Dev Console that can't be read as "unknown", not "pass". (The June QA also needed `?dev=<tunnel_url>` on the checkout URL; the host check makes that detail self-checking.)

**O6 (testing the release).** This direction is a fact attached to the wrong referent. "The bundle is **not** served from a tunnel host" proves only that `dev` isn't running. **A persisted preview after `dev` stops is still a preview**, and I expect its bundles are served from Shopify, not the dead tunnel; I could not verify this. So the tunnel check can't tell release from preview at O6, and identity rests entirely on the Dev Console. Per the changelog, the Dev Console may only be reachable *while `dev` runs*, and starting `dev` would re-create the preview.

**Fix:**

- At O4b, use the CLI (`shopify app dev clean --store …`) and **record its success output**. That is the positive evidence. Drop the Dev Console button as an equal alternative.
- At O6, require that recorded clean, plus the Dev Console showing no preview **if it can be opened without running `dev`**.
- **Never start `shopify app dev` after O4b** to reach the Dev Console.
- If release identity can't be established positively, record O6 as "identity unconfirmed", not as a pass.
- Keep the "not from tunnel" observation as a necessary condition, not a sufficient one.

### 4. NITs (none blocks or changes a decision)

- **P3-N1. Leftover names after the rename sweep.** The manifest claims every step-name hit was renamed (lines 1226–1231), but these remain:
  - **Status line (line 3):** still says "Revision 1 … Ready for review Pass 2". The date line (line 7) still says "(revision 1 on the same day)".
  - **R6 (line 626):** "Step **B1** records whether the CLI on 2025.10 writes that form" should be BL1. This is the exact step-versus-measure collision P2-5 removed.
  - **AC-3 (line 1064):** "R_peer is unchanged from **B3**" should be BL3.

  All are unambiguous in context. Fix them, and correct the manifest's sweep claim.
- **P3-N2. O4(a) relies on a Dashboard view of unknown detail.** The Dev Dashboard version page may not show a per-extension add/update/delete diff. O4(b), the CLI release confirmation, is the binding check, and the plan already requires no deletions in both, so this costs nothing. Say that (b) is authoritative.
- **P3-N3. O2 is recorded after the first write to the store.** O2(a)–(c) record the active version, its contents and the preview state, but only after QA. Recording them once more **before the first `shopify app dev`** (an operator pre-flight, or a Coder stop before C1.6.4/Z4) would show whether the store currently has anything the repo lacks. That is the only case in which `dev` itself could remove anything. It would also show whether a June preview is what the store displays today.
- **P3-N4. Name AC-12's test FAQ unmistakably** (for example "QA TEST – delete me"). This is a store with real FAQ data.
- **P3-N5. C1.6.4 is an optional second write.** It pushes an intermediate build to the live store's preview only to regenerate a `.d.ts`. Z4's `dev` run could serve the same purpose if C1's build doesn't regenerate the file. Optional.

### 5. Trajectory and verdict

- **Pass 1:** 7 REQUIRED.
- **Pass 2:** 5 REQUIRED, all now fixed.
- **Pass 3:** 3 REQUIRED, all confined to the operator runbook (§3.6 and §3.5), and all in the area the user's OQ-7 answer newly exposed. The criteria, the Coder checklist and the docs edits are now in good shape.

These three findings are not cosmetic. They are the only places where the plan, as written, could delete live FAQ data or certify the wrong build. Each fix is a reorder or a few sentences. Once they are folded in I expect to approve. Nothing in the Coder's part of the plan (Phases A–C and Z1–Z7) needs to change.

### Required changes (Pass 3, in the order to fix them)

1. **(P3-1)** Reorder §3.6 to O4 → O5 → O4b. Make O4b's precondition "O5 confirms the new version is active". If O2(b) recorded the old version lacking any item in the preview, also wait out the propagation window and re-confirm before cleaning. Add a pre-clean FAQ record (count and questions) to O2, so O7's "same FAQ entries" has a baseline.
2. **(P3-2)** In §3.5 step 2 and O8:
   - Warn that a rollback release to a version lacking `$app:faq`, `app-home` or `app-tools` deletes them. Check O2(b) first, never accept a release confirmation that lists deletions without an explicit decision, and prefer contain + fix-forward.
   - Add the recovery note: promptly releasing a version that contains `$app:faq` may reassociate the metaobjects.
3. **(P3-3)** Make the identity checks fail safe:
   - **AC-11/12/13:** the tunnel bundle host is a hard gate, with the Dev Console as corroboration; an unreadable Dev Console means "unknown", which means stop.
   - **O4b:** clean with the CLI and record its success output.
   - **O6:** require that recorded clean, plus the Dev Console showing no preview if it can be opened without `dev`. Never start `dev` after O4b. Treat "not from tunnel" as necessary, not sufficient. If identity can't be shown, record "identity unconfirmed", not a pass.

APPROVE WITH CHANGES

---

## Review Pass 4 — 2026-10-23

**Scope of this pass:**

- Confirm each Revision 3 row (P3-1 to P3-3, P3-N1 to P3-N5).
- Read the new §3.6 order row by row for live-store safety on `theme-evolution-os2.myshopify.com`.
- Assess O0 and the Coder's handling when O0 is missing.
- Check the P3-3 identity gates against what I intended.
- Re-read the §3.5 rollback text.
- Spot-check the stale-name sweep.

I re-read `CLAUDE.md`; it is unchanged. In the revised plan I read in full the revision log, §3.4–§3.6, R13/R14, C1.6, Z4–Z7 and AC-11 to AC-13. The rest I grep-swept.

### 1. Revision 3 rows: verified

| Item | Status | Evidence |
| :-- | :-- | :-- |
| **P3-1** | **Fixed** | The execution order is stated explicitly and the table follows it: O0 … O1 → O2 → O3 → O4 → **O5 → O4b** → O6 → O7. O4b's preconditions are O4 succeeded **and** O5 confirms the new version is active. If O2(b) shows the old version missing anything, the operator also waits about 1 hour and re-confirms "immediately before cleaning". If O5 can't confirm, "do not clean". O2(d) records the FAQ count and questions before any release or clean, and O7's pass condition is "count and questions match O2(d)". **O7 is now testable** (see P4-N2 for one caveat about the count). |
| **P3-2** | **Fixed** | §3.5 step 2 now: calls a rollback potentially destructive, with the docs quote; puts containment first and requires checking O2(b) first; allows a rollback only if O2(b) shows nothing missing, and runs it interactively with no `--allow-*` flags; and never accepts a confirmation that lists deletions without an explicit, recorded operator decision. The recovery note (promptly re-release a version that contains `$app:faq`, then re-check against O2(d)) is accurate to the docs. O8 routes FAQ loss to that note and says "check O2(b)" before any rollback. |
| **P3-3** | **Fixed** | Details follow this table. |
| P3-N1 | **Fixed** | The status and date lines are current. R6 says "Step BL1" and AC-3 says "BL3". My sweep for `B[0-3]` as a step name, `Step 0`, `Final F`, `F[1-7].`, "check in O5", "C5, or a later" and "Ready for review Pass 1–3" finds **only historical mentions** in the revision log and the §8 manifest. Every other `F1`–`F7` means a review finding, and the B0/B1 hits are the bundle measures. **No live stale references remain.** |
| P3-N2 | **Fixed** | O4 says (a) is a pre-check and (b) is the binding deletion check. |
| P3-N3 | **Fixed** (see P4-N1 for a gap in where O0 is recorded) | O0 runs before `/implement`. It records (a)–(d), and stops if the store has anything the repo lacks. |
| P3-N4 | **Fixed** | AC-12 names the test FAQ unmistakably and re-checks the count after deleting it. |
| P3-N5 | **Fixed** | C1.6.4 is optional. If it is skipped and Z4 regenerates the `.d.ts`, Z4.3 restores HEAD and records the diff. |

**P3-3 in detail.**

- **AC-11 and AC-12.** The hard gate is a tunnel-served bundle. If the origin is not the tunnel, or can't be determined, identity is unknown, so stop. The Dev Console is corroboration only. If it can't be read, it is recorded as "unknown", is not counted as corroboration, and does not override the gate. If it contradicts the gate, stop.
- **AC-13** is "identity unconfirmed" unless the AC-11 gate passed in the same session and the `dev` log shows the local app-tools build.
- **O4b** runs the CLI only and records its success output verbatim.
- **O6** requires that output, plus "no preview" from the Dev Console where it can be opened without `dev`. It treats "not from tunnel" as necessary but not sufficient, and otherwise records "identity unconfirmed".
- **No `dev` after O4b** is stated in both O4b and O6.

**On the Architect's interpretation of P3-3: yes, it matches what I intended.** My Pass 3 finding text said: the tunnel host is the hard gate; keep the Dev Console as corroboration; treat an unreadable Console as "unknown", not "pass". My one-line summary in the Pass 3 required-changes list ("an unreadable Dev Console means 'unknown', which means stop") was looser than the finding, and I own that inconsistency.

The intent is that **positive tunnel evidence is enough to prove the preview**, because a tunnel-served bundle cannot be the release. An unreadable Console then only fails to *add* evidence; it should not block a run whose identity is already proven. The revised rule gets the direction that matters right: the run stops whenever the *gate* is unknown, and also whenever the Console *contradicts* it.

### 2. §3.6, read row by row for live-store safety

- **O0** (before `/implement`). This is the first look at the store. It writes nothing and stops if the store has anything the repo lacks, the only case in which the plan's first `dev` run could remove something. It is safe.
- **O1.** No `dev` process is running and nothing is cleaned. Safe.
- **O2.** Read-only. (d) is taken while the store shows the QA'd preview. FAQ data is shared between preview and release, so the baseline is valid for O7.
- **O3.** `deploy --no-release` creates a version without releasing it, so nothing changes on the store. Safe.
- **O4.** A deletion listed in either check aborts the release. Releasing a version that contains everything the preview has deletes nothing, and (b) is the binding check. Safe.
- **O5.** Read-only. It is now a gate for O4b.
- **O4b.** It only runs after a confirmed active release, with an extra wait whenever O2(b) shows data at risk. If O4 or O5 fails, nothing is cleaned and the store keeps the QA'd preview.
  - **Is there a failure path that leaves neither a preview nor a working release?** No, with one exception: a clean that lands inside a propagation window longer than the documented "several minutes", and only when the old version lacks data. That is now mitigated by the wait and recoverable through the §3.5 note.
  - A failing clean (O8) leaves the preview, which is the same code as the release. Nothing is lost.
- **O6 and O7.** Read-only, with the identity rules above. Restoring settings isn't needed, because O6 forbids changing them.
- **O8.** Correctly routes each failure: before release, nothing to roll back; FAQ loss, the recovery note; after release, contain first, then O2(b), then a cautious rollback.

**The Coder's side.**

- Phases A, B and C, and Z1–Z3, never write to the store.
- C1.6.4 is skipped when O0 isn't recorded, which is fail-safe. The binding check is E1(app-tools) at C1.7 either way.
- Z4 stops and asks when O0 isn't recorded, which is fail-safe.
- The Coder can therefore finish Phases A–C and Z1–Z3 without the operator, and only Z4 waits. The plan states this in the step texts and the revision log, but not in one place (P4-N1).

### 3. NITs (none would let a broken upgrade or a live-store data loss through)

- **P4-N1. Where O0 is recorded, and how the Coder checks it, is undefined.**
  - O0 says "keep the record for the QA report's Release section", but the Coder must "confirm that O0 is recorded" at Z4 and C1.6.4.
  - If the operator wrote O0 to a new file inside the repo, A3's expected `git status` (only ` M extensions/app-tools/shopify.d.ts`) would stop the Coder. That is fail-safe, but avoidable.
  - Fix: name the location, for example a file outside the repo, or a note handed to the Coder, and add one sentence near §7's start: "Phases A–C and Z1–Z3 need no operator input; Z4 waits for O0."
- **P4-N2. The O2(d) FAQ count is capped at 50.**
  - App Home's list comes from `listFAQs()`, which queries `metaobjects(… first: 50 …)`, so the count shown is min(total, 50), and only the 50 most recently updated questions appear.
  - If O2(d) reads exactly 50, O7 could miss a loss. In that case take the count from the admin's metaobject entries list for the FAQ type instead.
  - It's very unlikely this store has 50 or more FAQs.
- **P4-N3. Spell out what "in the preview" means for the O4b wait test.**
  - After Z4 and QA, the preview equals the repo's set: `app-tools`, `app-home`, `free-shipping-progress`, `$app:faq` and the `app.faq` product metafield.
  - Tell the operator to compare O2(b) against that list. The Dev Console may be "unknown". And wait by default if in doubt.
- **P4-N4. R13's mitigation still says cleaning is safe "after O4".** The O4b row (after O4 **and** O5, plus the wait) is the governing text, so R13 should say "after O4 and O5".
- **P4-N5. AC-12's bundle-origin gate may be hard to observe for App Home.** I could not confirm that the App Home bundle's origin shows in DevTools the way the checkout bundle did in the June QA. If it doesn't, the gate stops AC-12. That is fail-safe, but would stall QA. A short note telling QA to escalate rather than improvise would help.

### 4. Trajectory and verdict

- **Pass 1:** 7 REQUIRED.
- **Pass 2:** 5 REQUIRED.
- **Pass 3:** 3 REQUIRED.
- **Pass 4:** 0 REQUIRED. Every REQUIRED item from Passes 1–3 is verified fixed in the plan text, not just listed.

**Where it ends up:**

- The live-store runbook now orders the release before the clean, waits when data is at risk, records a FAQ baseline that O7 can test, and identifies builds by positive evidence.
- Rollback is treated as potentially destructive.
- The Coder's path never writes to the store without the operator's pre-flight.

The five NITs above are wording and observability improvements. None of them can let a broken upgrade or a live-store data loss through, and the Architect can fold them in during implementation or leave them.

The plan is ready to implement as it stands.

APPROVE

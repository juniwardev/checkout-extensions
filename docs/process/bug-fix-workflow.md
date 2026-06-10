# Bug Fix Workflow Reference

Companion to the feature workflow. Three structural differences shape bug-fix work:

1. **Features start with intent; bugs start with observation.** Investigation phase often comes first.
2. **Regression risk dominates.** A bug fix that introduces a new bug is worse than no fix.
3. **Scope discipline matters more.** Drive-by cleanups are a primary source of regressions.

---

## Bug report template

Every fix starts with `docs/bugs/<slug>.md`:

```markdown
# Bug: <one-line summary>

**Slug:** <kebab-case-id>
**Reported:** <YYYY-MM-DD>
**Severity:** Critical | High | Medium | Low
**Affected scope:** <which extension, which target, which viewport, etc.>

## Steps to reproduce
1. ...

## Expected behavior
...

## Actual behavior
...

## Hypothesis (optional)
...

## Suspected files
...

## Regression risk areas
(Filled by Architect during planning.)
```

---

## Tier selection

| Tier | Bug type | Process |
|---|---|---|
| 1 | Trivial (typo, color, link) | Report → `/implement` → `/qa` → operator approval → deploy |
| 2 | Component-level bug | Report → `/plan` → `/review-plan` → `/implement` → `/qa` → approval → deploy |
| 3 | Complex / mystery | Report → `/investigate` → `/plan` → `/review-plan` → `/implement` → `/qa` → approval → deploy |
| 4 | Hotfix (production down) | Quick fix → manual deploy → retroactive audit trail |

---

## File layout

```
docs/
├── bugs/
│   ├── <slug>.md                              ← report
│   └── <slug>-investigation.md                ← Tier 3 only
├── plans/
│   ├── fix-<slug>.md
│   └── fix-<slug>-impl-notes.md
├── reviews/
│   └── fix-<slug>-review.md
├── qa/
│   ├── fix-<slug>-report.md
│   ├── fix-<slug>.approved
│   └── fix-<slug>-deploy.md
```

The `fix-` prefix makes the audit trail self-documenting in `git log`.

---

## Agent behavior for bug fixes

**Architect** — begins with root cause statement, not just proposed change. Uses investigation doc if present. Fills "Regression risk areas" in the bug report.

**Plan-Reviewer** — verifies fix addresses root cause (not symptom). Demands explicit reproduction-confirmation in verification steps. Pushes back on scope creep.

**Coder** — applies only the planned change. Commit message format: `fix(<extension>): <description> (fixes <slug>)`. Stops and reports if fix doesn't work; does not improvise.

**QA** — reproduces the bug first (against pre-fix state if possible). Then verifies fix. Runs regression checks against the "Regression risk areas" list. Report includes two mandatory lines: `Bug reproduced before fix: yes|no` and `Bug reproduced after fix: yes|no`.

**General** — for `/investigate`, traces code with file:line references. Writes diagnosis, not fix.

---

## Quick decision: which tier?

Ask:

- Is the root cause obvious? → No: Tier 3. Yes: continue.
- Is the fix one localized file? → Yes: Tier 2. No: Tier 3.
- Is the fix one obvious line? → Yes: Tier 1.
- Is checkout broken in production right now? → Yes: Tier 4 regardless.

When in doubt, go up one tier. Over-process is cheaper than missing regression risk.

---

## Worked example: a Tier 3 Checkout UI Extension bug

To illustrate how the workflow plays out on a real Checkout UI Extension bug, suppose this report lands:

> The free-shipping progress bar in the `free-shipping-progress` extension shows the wrong percentage when the customer applies a discount code at checkout. The bar appears to ignore the discount, calculating progress against the pre-discount subtotal instead of the post-discount total. Reproduced on desktop Chrome; not yet confirmed on mobile or other browsers.

This is Tier 3 territory — root cause isn't obvious (could be a hook usage bug, a stale value, a calculation issue, or a mismatch between which API surface the extension queries vs. what it should), and it touches reactive data flow.

### Step 1 — Write the bug report

`docs/bugs/progress-bar-ignores-discount.md` captures the symptom, reproduction steps, expected vs actual behavior, suspected files (likely the extension's main component file), and leaves the regression risk areas blank for the Architect.

### Step 2 — `/investigate`

The General agent reads the bug report, opens the dev tunnel checkout in Playwright, reproduces the bug by adding a discount code and watching the progress bar, then examines the extension's source code (the React component file in `extensions/free-shipping-progress/src/`). It traces which hook the component is reading to calculate progress.

The investigation document (`docs/bugs/progress-bar-ignores-discount-investigation.md`) captures the root cause with file:line references — for example: "The component uses `useSubtotalAmount()` which returns the pre-discount subtotal. To respect discounts, it should use `useTotalAmount()` which returns the customer-facing total after all reductions are applied. See `extensions/free-shipping-progress/src/Checkout.tsx:42`."

Regression risk areas: any other progress calculation, any other extension reading subtotal vs. total (currently only this one extension), the merchant-configured threshold setting interpretation.

### Step 3 — `/plan fix-progress-bar-ignores-discount`

The Architect proposes the minimal change: swap the hook from `useSubtotalAmount()` to `useTotalAmount()`, update the calculation, ensure the component still re-renders reactively (both hooks are reactive, so this is automatic). Verification steps include re-running the reproduction with a discount applied and confirming the bar updates correctly.

### Step 4 — `/review-plan`

The Plan-Reviewer reads the plan and the investigation, confirms the root cause is correctly identified, checks the proposed fix actually addresses it (not just hides the symptom), verifies the verification steps would catch a regression.

### Step 5 — `/implement`

The Coder makes the one-line hook swap, runs `shopify app build` to validate the change passes TypeScript and bundle-size checks, commits with `fix(free-shipping-progress): use useTotalAmount instead of useSubtotalAmount (fixes progress-bar-ignores-discount)`.

### Step 6 — `/qa`

The QA agent opens the dev tunnel checkout via Playwright, reproduces the original symptom against the pre-fix code (if accessible via git), then verifies the fix:
- Apply a discount code, confirm the progress bar updates to reflect the discounted total
- Remove the discount, confirm it reverts correctly
- Try with an empty cart (no progress), full threshold (100%), and over-threshold (capped at 100%)
- Verify mobile and desktop viewports

The QA report includes the two mandatory lines confirming the bug existed before and is gone after.

### Step 7 — Approval and ship

`touch docs/qa/fix-progress-bar-ignores-discount.approved`, then `shopify app deploy` (or `/ship` once that's configured). The operator commits the audit trail.

---

## Why this matters for Checkout UI Extensions specifically

Sandbox runtime bugs (UI elements rendering wrong, hooks returning stale values, API surface mismatches at different extension targets) are particularly hard to diagnose without a structured investigation phase. The bundler doesn't catch most of them; the Shopify CLI doesn't surface them; only running the actual checkout in a browser reveals the symptom.

The squad's discipline — investigation before planning, plan-review before code, browser-based QA against the live checkout — is designed for exactly this kind of bug.

# Plan review: `fix-cartlines-vs-lines-signal-name`

**Reviewer:** Plan-Reviewer (Claude Opus)
**Date:** 2026-06-11
**Plan:** `docs/plans/fix-cartlines-vs-lines-signal-name.md`
**Bug report:** `docs/bugs/cartlines-vs-lines-signal-name.md`
**QA report:** `docs/qa/free-shipping-progress-report.md`
**Verdict scope:** one-line application-code fix; review is proportionate.

---

## What I independently verified

I did not take the plan's claims on faith. I confirmed each of them against the
code and the installed types:

1. **The bug exists exactly where the plan says.** Grep across
   `extensions/*/src/**` returns a single `cartLines` reference:
   `extensions/free-shipping-progress/src/Checkout.jsx:84`:
   `const lines  = shopify.cartLines.value;`. No other occurrence in any
   extension source.

2. **`shopify.lines` is the correct property at `api_version = "2026-04"`.**
   Read directly from the installed
   `@shopify/ui-extensions@2026.4.0` declarations
   (`node_modules/.pnpm/@shopify+ui-extensions@2026.4.0_.../standard.d.ts:590`):
   `lines: SubscribableSignalLike<CartLine[]>;`. A grep for `cartLines` in that
   same file returns zero property matches — the identifier does not exist on the
   `shopify` signals surface. The bug report's citation of "line 602" is off by a
   handful of lines versus my copy (590), but the substance is correct; the line
   number drift is immaterial and not worth blocking on.

3. **The shape is preserved.** `shopify.lines.value` returns `CartLine[]`, the
   same type the code already assumes. The only downstream consumer is the
   empty-cart guard at line 109 (`lines.length === 0`). `Array.length` is valid
   on `CartLine[]`, so no downstream edit is needed. The plan's claim in §3 that
   "the downstream usage is unchanged" is accurate.

4. **The out-of-scope list is accurate.** `CLAUDE.md` already reads
   `shopify.lines` everywhere (lines 16, 108, 117, 136, 284) and explicitly flags
   the `cartLines` confusion and its `useCartLines()` origin. The plan correctly
   states these source-of-truth docs are already corrected and must not be
   touched again.

## Correctness

The fix addresses the **root cause**, not a symptom. The root cause is a single
wrong identifier; the runtime `TypeError: Cannot read properties of undefined
(reading 'value')` is a direct consequence of `shopify.cartLines` resolving to
`undefined`. Renaming to `shopify.lines` removes the undefined access. There is
no deeper cause hiding behind this one — the QA evidence, the type file, and the
single grep hit all converge on the same conclusion. This is as clean a
root-cause fix as a bug gets.

## Scope creep

None. The plan restricts the change to one line and enumerates an explicit
do-NOT-touch list (`CLAUDE.md`, the feature plan, the bug doc, `shopify.extension.toml`,
locales, other extensions, lock files). For a `fix-` plan this is exactly the
discipline required — every untouched file is a regression surface avoided. I
have no push-back here.

## Edge cases and failure modes

- **Empty cart:** `shopify.lines.value` is a populated signal; unlike the old
  `cartLines` it is not `undefined`, so `lines.length` is safe. Worth noting the
  fix also silently resolves the *second* page error QA observed (`Cannot read
  properties of undefined (reading 'length')`) — that was a cascade of the same
  undefined access, not an independent defect.
- **Pre-hydration:** `lines` is a `SubscribableSignalLike`, so `.value` is always
  defined once the signal object exists. The code already guards `settings`,
  `cost.totalAmount`, and `deliveryGroups` defensively; `lines` is not guarded
  with `?? []`, but per the type it is a non-optional signal returning an array,
  so a guard is not strictly required. This is acceptable for a one-line fix and
  should not be expanded into scope.

## Testability and observability gaps

This is the one area where the plan is thin, and it matters for a `fix-` plan.

- **No reproduction-confirmation step.** The plan's verification (§4) is a build
  + grep. That proves the *code changed* and *still compiles* — it does NOT prove
  the *bug is gone*. The original defect passed `shopify app build` cleanly (QA
  confirmed an 8.7 KB bundle built with no errors); the crash only surfaced at
  runtime in a live checkout. A build-only verification for this specific bug is
  therefore insufficient by construction — it re-runs the exact check that missed
  the bug the first time.
- The plan does delegate live-checkout re-verification to QA (§4, final
  paragraph), which is the correct division of labour. But it should explicitly
  state the **pass criterion QA must hit**: the extension renders one of its
  three states in a live checkout with zero `ExtensionUsageError` /
  `Cannot read properties of undefined` entries in the console — i.e., the exact
  errors documented in the QA report (report lines 82-87) must be absent. Naming
  the before/after console signature turns "QA will re-verify" into a falsifiable
  gate. This is the single change I want folded in before implementation.

## Hidden coupling / breaking changes

None. `shopify.lines` is the canonical accessor; no other call site, capability,
or toml setting depends on the old name. `applyCartLinesChange()` (a mutation,
unrelated to the read signal) is not used by this extension, so there is no
naming-confusion risk there.

## Alternatives not considered

For a one-line identifier correction there is no meaningful design alternative,
so the absence of an alternatives section is appropriate. One *defensive*
option the architect could note (not require): adding `?? []` to the `lines`
read for symmetry with the other guarded signals. I would NOT make this
mandatory — it is a style choice, it widens the diff, and the type guarantees
the array is present. Flagging it as explicitly out of scope (which §6 already
does by forbidding any other edit) is the right call.

## Required changes

1. Add an explicit reproduction-confirmation criterion to the verification
   section: QA must confirm, in a live `shopify app dev` checkout, that the
   extension renders a visible state AND that the console no longer emits the
   `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading
   'value')` / `(reading 'length')` errors recorded in
   `docs/qa/free-shipping-progress-report.md`. A build + grep alone cannot prove
   this runtime bug is fixed, because the original defect passed the build clean.

APPROVE WITH CHANGES

---

## Architect response — 2026-06-11

**Required change addressed:** Verification section updated to add an explicit runtime confirmation step (§4 step 3 + checklist step 5). The Coder must now start `shopify app dev`, open a live checkout, confirm the extension renders, and confirm the `ExtensionUsageError: Cannot read properties of undefined` console errors from the QA report are absent. The rationale (build-only is insufficient because the defect passed the original clean build) is documented inline in §4.

---

## Review Pass 2 — 2026-06-11

**Scope of this pass:** confirm the Pass 1 required change (build-only verification
is insufficient — runtime confirmation required) was resolved correctly, check for
new issues introduced by the update, and flag any remaining gaps. Proportionate to a
one-line fix.

### 1. Pass 1 required change — resolved

The single Pass 1 requirement is now satisfied, and satisfied well:

- **§4 step 3** adds an explicit runtime confirmation step: start `shopify app dev`,
  install on the dev store, add a product, open checkout, and confirm (a) the
  extension renders one of its three states and (b) the console is free of the two
  exact error signatures from the QA report —
  `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')`
  and `Cannot read properties of undefined (reading 'length')`. This is the
  falsifiable before/after console signature I asked for in Pass 1, named verbatim
  rather than gestured at.
- **§4 preamble** documents the rationale inline ("build-only is insufficient... the
  original defect passed `shopify app build` cleanly... the crash only surfaces at
  runtime"), so the reasoning survives independent of this review thread.
- **§7 checklist step 5** mirrors the same runtime step in the Coder's actionable
  list, and **step 7** now requires impl notes to record the runtime confirmation
  outcome (not just build result and bundle size). The verification is therefore
  both specified and forced into the audit trail.

This is a complete and correct resolution. The plan no longer re-runs the exact
check (`shopify app build`) that missed the bug the first time as its sole gate.

### 2. New issues introduced by the update — none

The update only added verification text (§4 step 3, §4 preamble, §7 steps 5 and 7).
It did not widen the code change, alter the out-of-scope list, or touch the §3 fix
itself. The one-line diff (`shopify.cartLines.value` → `shopify.lines.value`) is
unchanged. No new scope, no new coupling, no new risk surface introduced.

I re-confirmed the fix target against current source: `Checkout.jsx:84` still reads
`const lines  = shopify.cartLines.value;` and the only consumer is the empty-cart
guard at line 109 (`lines.length === 0`). Both the line reference and the
shape-preservation claim from Pass 1 remain accurate against the code as it stands.

### 3. Remaining gaps — none blocking

- The minor line-number drift in the bug report's type citation ("602" vs my copy's
  590) was already judged immaterial in Pass 1 and remains so. Not worth a change.
- The defensive `?? []` guard on the `lines` read remains correctly out of scope —
  the type guarantees a non-optional array, and widening the diff on a critical
  one-line fix would only add regression surface. The plan's §6 forbidding any other
  edit is the right call.

### Verdict

Both Pass 1 required changes are folded in, no new issues were introduced, and no
blocking gaps remain. The plan is now ready to implement as-is: a verified
root-cause one-line fix with a falsifiable runtime confirmation gate and a tight
out-of-scope boundary.

APPROVE

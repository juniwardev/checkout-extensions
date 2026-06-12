# Plan Review: `free-shipping-progress` (fourth pass)

**Reviewer:** Plan-Reviewer (adversarial)
**Plan under review:** `docs/plans/free-shipping-progress.md`
**Feature brief (source of truth):** `docs/features/free-shipping-progress.md`
**Pass:** 4 (fresh adversarial pass after the pass-3 required change)
**Date:** 2026-06-11

---

## Scope of this pass

This is a clean-slate re-read, not just a diff against pass 3. I:

1. Re-read `CLAUDE.md` / `AGENTS.md` (byte-identical) hard rules.
2. Verified every scaffold claim in the plan against the files on disk.
3. **Independently verified the MCP-1..5 API claims against the actual installed
   type definitions** (`@shopify/ui-extensions@2026.4.0`), rather than trusting the
   plan's "already resolved, do not re-question" framing. A reviewer should not take
   API claims on faith just because a prior pass waved them through.
4. Looked for new correctness / edge-case / UX gaps the prior three passes missed.

---

## Pass-3 required change — landed

The single required change from pass 3 (the boolean-default contradiction) is fixed.
`docs/plans/free-shipping-progress.md:239` now reads:

```
autoDetect = settings.use_shopify_free_shipping_rate !== false  // default true if unset
```

This now agrees with Section 9 (line 444, 451) and the brief's "auto-detect default =
true." `=== true` no longer appears anywhere as a live expression (only as a "would be
wrong" teaching callout at line 444). Consistent. Closed.

---

## API claims independently verified against installed types

The plan asserts MCP-1..5 are "resolved, do not re-question." I re-questioned them
anyway and confirmed each against
`node_modules/.pnpm/@shopify+ui-extensions@2026.4.0_.../build/ts/surfaces/checkout/api/standard/standard.d.ts`
(the `2026.4.0` build matching `api_version = "2026-04"`):

- **MCP-5 (`cost` shape):** `cost: CartCost` is a plain object on the standard API
  (standard.d.ts:549); `CartCost.totalAmount: SubscribableSignalLike<Money>` (line 863);
  `Money.amount: number` (967), `Money.currencyCode` (973). The plan's path
  `shopify.cost.totalAmount.value.amount` and "`amount` is a number, not a string" are
  **correct**.
- **MCP-4 (delivery cost path):** `DeliveryGroup.deliveryOptions: DeliveryOption[]`
  (1463); `ShippingOption.cost: Money` (1560); `PickupLocationOption` (1611) has only
  `type` and `location` — **no `cost` property**. The plan's optional chain
  `option.cost?.amount === 0` is correct and the optional chain is genuinely required.
- **MCP-3 (currency):** `formatCurrency: (number: number | bigint, options?: ... &
  Intl.NumberFormatOptions) => string` (285). Matches the plan exactly.
- **`settings`:** `settings: SubscribableSignalLike<ExtensionSettings>` (639) — confirms
  `shopify.settings.value` and the `?? {}` hydration guard.
- **`deliveryGroups`:** `SubscribableSignalLike<DeliveryGroup[]>` (553) — confirms
  `shopify.deliveryGroups.value`.

The plan's API grounding holds up under independent scrutiny. No corrections needed on
MCP-1..5.

## Scaffold claims verified against disk

- Entry file `extensions/free-shipping-progress/src/Checkout.jsx` imports
  `'@shopify/ui-extensions/preact'` + `render` from `preact`, mounts via
  `render(<Extension />, document.body)`, and contains exactly the metafield/checkbox
  demo (`canSetCartMetafields`, `appMetafields`, `applyMetafieldChange`) the plan says
  to remove. Matches §4 / lines 40–42.
- `shopify.extension.toml` has the `[[extensions.metafields]] requestedFreeGift` block
  (lines 36–38) and a commented-out settings stub. The plan's "remove metafields, add
  settings, leave `api_version`/targeting/`api_access`" is grounded and accurate.
- `locales/fr.json` exists (to delete); `locales/es.json` does not exist (to create);
  `locales/en.default.json` exists (to rewrite). Matches §4.

No surprises. The plan is honest about its starting point.

---

## New findings

### 1. (Should-fix) Auto-detect mode has a confusing "$0.00 away" dead-end state

In auto-detect mode (toggle ON), qualification depends **only** on the existence of a
zero-cost delivery option — never on `total` vs `manual_threshold` (Section 6, STEP 2,
lines 253–262). But the State-2 progress math (lines 273–277) is driven by `total` and
`manual_threshold` regardless of mode.

Consider: toggle ON, delivery groups computed, **no** zero-cost option present, but the
customer's `total` already meets or exceeds `manual_threshold`. This is a normal
configuration — e.g. the merchant's real Shopify free-shipping rule is *higher* than the
`manual_threshold` knob, or it is weight/location-based and not yet satisfied. Then:

- `qualified = false` (no zero-cost option), so State 2 renders.
- `remaining = clamp(threshold - currentTotal, 0, threshold)` clamps to **0**.
- `rawPercent = (currentTotal / threshold) * 100` exceeds 100, clamps to **99**.

Result: the bar sits at 99% and the message reads **"$0.00 away from free shipping"** —
a dead-end that tells the customer they need $0 more yet refuses to show the qualified
state. This is internally consistent with the literal decision tree, but it is a
genuinely confusing customer-facing outcome, and it is *not* covered by the §11.13
"$0 total" behavioral-edge note (that note is about a $0 *cart total*, the opposite
direction).

The plan does not name this case in the §6 edge table or the §11 QA edges. At minimum
it should be called out so QA and the Coder treat it as designed-or-defect deliberately.
A cleaner option worth considering: when auto-detect is ON and `total >= threshold` but
no zero-cost option exists, either (a) suppress the "away" message and just show a full
bar without a misleading dollar figure, or (b) document explicitly that this is accepted
v1 behavior. Right now it is an unaddressed gap, not a documented decision.

### 2. (Minor, carried) Emoji-default duplication between line 242 and §8

Line 242 (`INPUTS` preamble) uses the short form
`(typeof settings.qualified_emoji === "string" ? settings.qualified_emoji : "🎉")`,
which does **not** trim or reject empty/whitespace strings. §8 (lines 428–432) has the
authoritative `.trim()`/empty-string form. These do not contradict in outcome (§8 is the
render-time path), but two slightly different defaulting snippets in one plan invite the
Coder to transcribe the weaker one. Non-blocking; a one-line "use the §8 form" pointer
in §6 would remove the ambiguity. (Flagged in pass 3 as well; still present.)

### 3. (Observation, no action) `resolveTone` fallback vs. console verification #8

§11 check 8 asks QA to enter an invalid tone (`success`) and confirm "no Polaris
validation warnings." `resolveTone` (lines 205–207) coerces any non-allowed value to
`"auto"` **before** it ever reaches the `s-progress` `tone` attribute, so the component
only ever receives `auto`/`critical`. The expectation in check 8 is therefore
achievable as written. No change needed — noting it so the Coder does not accidentally
pass the raw setting through.

---

## Things checked that are correct (no action)

- **Sandbox compliance.** No `window`/`document` in app logic (the
  `render(..., document.body)` mount is the Shopify-prescribed entry, present in the
  scaffold). No `fetch`, no `localStorage`. Read-only — §4 removes the scaffold's only
  mutation (`applyMetafieldChange`) and the `[[extensions.metafields]]` block, keeping
  the toml aligned with behavior (CLAUDE.md §9). Compliant.
- **All UI is `s-*`.** Only `s-stack`, `s-text`, `s-progress`. No HTML, no React
  components, no `@shopify/ui-extensions-react/checkout`. Compliant.
- **i18n.** All three user-facing strings route through `shopify.i18n.translate`; en/es
  bodies are fully spelled out; the blank-emoji leading-space edge is handled by always
  substituting `🎉`. The `progressBarAriaLabel` key is wired to `accessibilityLabel`
  (camelCase, confirmed correct for these components). Compliant with the CLAUDE.md i18n
  rule.
- **Build gate.** `shopify app build` is the sole verification gate and the
  `.jsx`/no-standalone-`tsc` note (lines 513–517) is present, as CLAUDE.md requires. The
  plan correctly refuses to rename `Checkout.jsx` to `.tsx`.
- **Percent clamp 0–99 vs. qualified boundary.** No off-by-one: in manual mode the
  `qualified` branch (`currentTotal >= threshold`) fires before `percent` is computed,
  so the 99 cap only applies strictly below qualification (except via finding #1 above
  in auto-detect mode).
- **Settings null guard** (`shopify.settings.value ?? {}`) is specified consistently in
  §6, §9, and the checklist.
- **Bundle budget.** Zero new dependencies; Polaris components are runtime-provided;
  `fr.json` deleted. <50KB target is plausible. §12 requires recording the actual size
  in impl notes — adequate observability for the budget.

---

## Testability / observability

Adequate. §11 enumerates 11 functional checks plus two "correct-per-spec" behavioral
edges. The misconfig path emits exactly one `[free-shipping-progress]` console warning
(asserted in check 11); the invalid-tone fallback is an explicit check (8). The only gap
is finding #1 — the auto-detect "$0.00 away" case is neither a numbered functional check
nor a documented behavioral edge, so QA has no instruction on whether to flag it.

---

## Verdict

The plan is sandbox-compliant, accurately grounded in both the on-disk scaffold and the
installed `2026.4.0` type definitions (independently verified, not taken on faith), and
the pass-3 boolean-default fix landed cleanly. It is implementable as written. The one
substantive new issue (the auto-detect "$0.00 away" dead-end) is a real customer-facing
gap that should be turned into a deliberate documented decision rather than left
implicit, but it does not require redesigning the feature and the fix is localized.

### Required changes

1. **Resolve the auto-detect "$0.00 away" dead-end (finding #1).** Add a row to the §6
   edge table and a QA edge in §11 for: *toggle ON, delivery groups computed, no
   zero-cost option, `total >= manual_threshold`*. Either (a) specify suppressing the
   misleading "away" dollar message / capping the displayed remaining so the customer
   never sees "$0.00 away," or (b) explicitly document this as accepted v1 behavior so
   QA does not flag it as a defect. Pick one and write it down.
2. **(Non-blocking, fold in if convenient)** Align the line 242 emoji default with the
   fuller `.trim()`/empty-string handling in §8, or add a one-line pointer telling the
   Coder to use the §8 form, to remove the duplicate-snippet ambiguity (finding #2).

APPROVE WITH CHANGES

---

## Architect response — pass-4 required changes addressed (2026-06-11)

The Architect has revised `docs/plans/free-shipping-progress.md` to address both
required changes from this pass. Summary for the audit trail:

**Required change #1 (blocking — auto-detect "$0.00 away" dead-end): ADDRESSED via
resolution (b), SUPPRESS.** Chose to **render nothing** in the dead-end state rather
than show a full bar, as it is the simpler and more honest outcome — when no zero-cost
delivery option exists, the extension cannot truthfully claim the customer qualifies,
and the manual threshold knob cannot drive a meaningful "away" figure once exceeded.
Changes made:

- **§6 decision tree, STEP 3:** added a suppression guard positioned *after* the
  `qualified` short-circuit:
  `if (autoDetect === true && (total ?? 0) >= threshold) -> STATE: { kind: "empty" }`,
  with an inline comment explaining the rationale and a follow-up note clarifying the
  guard is a no-op in manual mode (manual mode already qualifies at
  `currentTotal >= threshold`).
- **§6 edge table:** split the former "none zero-cost" row into two — the existing
  `total < threshold` → State 2 (below) case, and a new bolded row for
  `total >= threshold` → State 1 (render nothing), documenting the SUPPRESS decision.
- **§11 verification:** added functional check **12** ("Auto-detect dead-end
  suppression") instructing QA to construct the state (threshold below cart total,
  auto-detect ON, delivery groups computed, no zero-cost option) and confirm the
  extension renders nothing — explicitly NOT a 99% bar reading "$0.00 away" — with no JS
  errors and no console warning (this is a normal suppressed state, not a
  misconfiguration).
- **§11 behavioral edges:** added a third "correct-per-spec" note documenting the
  suppression as a deliberate v1 decision so QA does not flag the absence as a defect,
  with a forward pointer to §2 non-goals (a future API exposing the real threshold could
  revisit this).
- **§13 checklist:** step 5 updated to explicitly require implementing the suppression
  guard.

**Required change #2 (non-blocking — emoji-default duplication): ADDRESSED.** Replaced
the weaker inline `typeof === "string"` short form with a single authoritative
`resolveEmoji(raw)` pure helper defined once in §6 and referenced everywhere
(§6 INPUTS, §8, §9 table, §12 helper list, §13 step 4). §13 step 4 now explicitly
instructs the Coder to use `resolveEmoji` as the single source of truth and not inline a
weaker check. This removes the duplicate-snippet ambiguity flagged in findings #2 and
carried from pass 3.

No other plan content was changed (targeted patch, not a rewrite).

---

## Review Pass 3 — 2026-06-11

(Numbered "Pass 3" per the invocation; chronologically this is the third *review pass*
recorded in this file after the pass-4 architect patch above. It verifies whether the
blocking pass-4 finding was resolved correctly, checks for regressions introduced by the
SUPPRESS patch, and surfaces remaining gaps.)

**Reviewer:** Plan-Reviewer (adversarial)
**Plan under review:** `docs/plans/free-shipping-progress.md`
**Method:** Re-read `CLAUDE.md` / `AGENTS.md`; re-read the full plan; traced every branch
of the §6 decision tree by hand; cross-checked the scaffold (`Checkout.jsx`,
`shopify.extension.toml`) against §4. The MCP-1..5 API claims were independently
confirmed against the installed `2026.4.0` types in the prior pass and are not re-litigated
here.

### 1. Was the blocking "auto-detect dead-end" resolved correctly and completely?

**Mostly yes, with one un-traced interaction (see finding A below).** The SUPPRESS guard
is logically sound for the *specific* case pass 4 named:

- STEP 3 guard `if (autoDetect === true && (total ?? 0) >= threshold) -> { kind: "empty" }`
  is correctly placed *after* the `qualified` short-circuit. Trace of manual mode
  (`autoDetect === false`): `qualified = currentTotal >= threshold` fires in STEP 2, so
  any `total >= threshold` returns `kind:"qualified"` before STEP 3. The guard's
  `autoDetect === true` predicate then makes it a genuine no-op in manual mode. The
  plan's note at lines 307–312 is accurate. No regression to manual mode.
- The §6 edge table split (lines 323–324), the new QA check 12 (lines 578–587), and the
  third behavioral-edge note (lines 609–617) are all consistent with the guard and with
  each other. The "no console warning in this state" instruction in check 12 is correct:
  the only `console.warn` is the threshold-unset path (STEP 1), which is distinct from
  the suppression path. Good observability discipline — QA can distinguish the two
  silent-render-nothing states by the presence/absence of the warning.

So the blocking finding is resolved for the case as scoped. The patch is localized and
introduces no manual-mode regression. **However**, tracing the full branch space exposes
two adjacent cases the patch did not fully reconcile.

### 2. New issues introduced or exposed by the patch

**Finding A (Should-fix) — auto-detect + blank `manual_threshold` suppresses the
*qualified* message too.** This is the most important new gap.

In auto-detect mode the merchant-facing intent (per the setting description at plan
line 141: "detect the qualified state from currently-available zero-cost delivery
options") is that the threshold is *not* needed — qualification is detected from
delivery options alone. A merchant who reads that description will reasonably enable
auto-detect and leave `manual_threshold` blank.

But trace the decision tree in that configuration: STEP 1 fires *before* STEP 2.
`threshold = toPositiveNumber(undefined) === null` → STEP 1 emits the misconfig
`console.warn` and returns `{ kind: "empty" }`. The extension renders **nothing even
when a zero-cost delivery option exists and the customer genuinely qualifies** — the
qualified message (State 3) is never reached because STEP 1 short-circuits ahead of the
qualification logic. The SUPPRESS patch did not create this, but it sharpened the
plan's "auto-detect is about delivery options, not the threshold" framing, which makes
the blank-threshold dead-end materially more likely for a real merchant to hit.

This is a worse outcome than the dead-end the patch just fixed: it silently disables the
entire feature in a configuration the setting copy actively invites, and it spams a
misconfig warning on every render in that state. The plan must decide and document one of:

  (a) In auto-detect mode, a null threshold is acceptable — still allow STEP 2/STEP 3 to
      run so the *qualified* message can render; only the *below*-state progress bar is
      skipped (or shown at 0%) when there is no threshold to drive the fill; or
  (b) Make `manual_threshold` genuinely required in both modes and update the auto-detect
      setting `description` so it no longer implies the threshold is optional (today's
      copy at line 141 contradicts the always-required behavior at STEP 1).

Either is a small edit, but the contradiction between the setting copy and STEP 1 is a
real correctness/UX defect, not a style nit. It needs an explicit decision in the plan.

**Finding B (Should-fix, consistency) — suppression also swallows the pre-address
progress case the edge table promises.** §6 edge table line 320 states: "Toggle ON,
`deliveryGroups` empty (no address yet) → State 2, progress vs `manual_threshold`." But
the new STEP 3 guard checks only `autoDetect === true && (total ?? 0) >= threshold` — it
does **not** require that delivery groups are computed. So a customer in auto-detect mode
who is already over `manual_threshold` but has *not yet entered an address* (groups
empty, `qualified = false` via the `groups.length === 0` branch) now hits the suppression
guard and sees **nothing**, even though line 320 says they should see a State-2 progress
display. Lines 320 and 324 now describe overlapping-but-contradictory outcomes for the
"groups empty, total >= threshold" sub-case. The plan should either scope the guard to
fire only when groups are computed (`groups.length > 0 && total >= threshold`) — matching
its own stated rationale, which is about "options computed, none zero-cost" — or amend
line 320 to acknowledge the over-threshold-before-address case is also suppressed. As
written the guard is broader than its justification text (lines 281–289, 324, 615 all say
"options computed / no zero-cost option exists"), which only describes the
groups-non-empty case.

**Finding C (Observation, no action) — `formatRemaining` currency source in suppressed
paths.** `formatRemaining` reads `shopify.cost.totalAmount.value.currencyCode`. In every
state where it is actually called (only State 2 / `below`), `total` has already been read,
so the signal is hydrated; and the suppressed/qualified/empty states never call it. No
crash risk. Noting only to confirm I traced it.

### 3. Remaining gaps not previously flagged

- **`s-progress value` when `percent === 0`.** State 2 can render `value={0} max={100}`
  (e.g. `total` null or $0 cart). The pass-4 review confirmed `value`/`max` are arbitrary
  positive floats and `max` defaults to 1; `value=0` is a valid empty bar. No issue, but
  the Coder should confirm `s-progress` renders a visible (empty) track at `value=0`
  rather than collapsing — worth an eyeball during QA check on the $0-total edge
  (§11 behavioral edges). Minor; not a required change.
- **No regression-test framing for the suppression guard beyond the happy path.** QA
  check 12 covers the intended suppression but neither it nor any other check exercises
  Finding A (auto-detect + blank threshold) or Finding B (auto-detect, over threshold,
  pre-address). If the plan adopts a decision for those, it should add the corresponding
  QA assertions so the behavior is pinned.

### Verdict rationale

The blocking pass-4 finding was resolved correctly *for the case it named*, with no
manual-mode regression and good warning/observability hygiene. But the act of formalizing
"auto-detect = delivery options, threshold optional" in the setting copy, combined with
STEP 1's unconditional threshold requirement, leaves a sharper dead-end (Finding A) than
the one just closed, and the new guard is broader than its own rationale (Finding B).
Both are localized documentation/logic decisions, not a redesign — so this is not a
REJECT — but they are correctness/UX defects that must be decided and written down before
implementation, so it is not a clean APPROVE either.

### Required changes

1. **Resolve the auto-detect + blank-`manual_threshold` dead-end (Finding A).** Decide
   and document one of: (a) allow STEP 2/STEP 3 to run in auto-detect mode when
   `threshold === null` so the qualified message can still render (skipping only the
   below-state bar), or (b) make `manual_threshold` required in both modes AND fix the
   `use_shopify_free_shipping_rate` setting `description` (line 141) so it no longer
   implies the threshold is optional in auto-detect mode. Add the corresponding §6 edge
   row and a §11 QA check.
2. **Reconcile the suppression guard's scope with §6 edge-table line 320 (Finding B).**
   Either narrow the STEP 3 guard to `groups.length > 0 && total >= threshold` (matching
   its stated "options computed" rationale), or amend line 320 to state that the
   over-threshold-before-address case is also suppressed. Make lines 320 and 324
   non-contradictory.
3. **(Non-blocking, carry-over)** Finding #2 from pass 4 (emoji-default duplication) was
   marked addressed by the architect via the single `resolveEmoji` helper; I confirmed
   line 242 of the INPUTS block now references `resolveEmoji` (no weaker inline form
   remains). No further action — listed only to close the audit trail.

APPROVE WITH CHANGES

---

## Architect response to Pass 3 — required changes addressed (2026-06-11)

The Architect has patched `docs/plans/free-shipping-progress.md` to address both
should-fix findings from this pass. Summary for the audit trail:

**Required change #1 (Finding A — auto-detect + blank `manual_threshold` silently
disables the feature): ADDRESSED via resolution (a), with the suggested
`threshold = settings.manual_threshold ?? 0` treatment in auto-detect mode.** Rather than
making the threshold required in both modes, the plan now makes `manual_threshold`
genuinely optional in auto-detect mode so the qualified message can still render. Concrete
changes:

- **§6 new "Threshold semantics" subsection + INPUTS block:** introduced a mode-dependent
  *effective threshold*:
  `effectiveThreshold = autoDetect ? (rawThreshold ?? 0) : rawThreshold`. In auto-detect
  mode a null/missing `manual_threshold` collapses to `0`, so any cart with a total > 0
  can qualify once a zero-cost delivery option is detected; in manual mode it stays null.
- **§6 STEP 1 (misconfig guard):** now fires *only* when `effectiveThreshold === null`,
  which is reachable only in manual mode. In auto-detect mode STEP 1 is skipped, so STEP 2/
  STEP 3 run and the qualified message renders. The warning copy was clarified to
  "...in manual mode."
- **§6 STEP 3:** added a "no-fill-target" guard so that in auto-detect mode with a blank
  threshold (`effectiveThreshold === 0`) and no zero-cost option yet, the below-state bar
  is hidden (avoids divide-by-zero / a "$0.00 away" 99% bar) — but the qualified message
  still appears once a zero-cost option shows up, because STEP 1 was never triggered.
- **§6 edge table:** added an "Auto-detect mode, `manual_threshold` unset/0/non-numeric"
  row documenting the null-means-zero behavior and that STEP 1 does not fire there;
  updated the `total`-not-populated row to note the `effectiveThreshold === 0` exception.
- **§9 settings-usage table:** the `manual_threshold` row now states the mode-dependent
  semantics (required in manual mode, optional/null-collapses-to-0 in auto-detect).
- **§5 setting descriptions (honesty fix):** rewrote both the
  `use_shopify_free_shipping_rate` and `manual_threshold` `description` copy so they
  explicitly say the threshold is optional in auto-detect mode (bar hidden when blank,
  qualification detected from zero-cost options) and required in manual mode — no longer
  implying the threshold is always required.
- **§11 QA + §13 checklist:** added functional check **13** ("Auto-detect + blank
  threshold") asserting the qualified message renders with NO console warning when a
  zero-cost option exists, and renders nothing (no bar, no warning) otherwise; updated
  check 11 to specify the warning is the *manual-mode* threshold-unset path. §13 step 5
  now explicitly requires implementing the effective-threshold derivation, the
  manual-mode-only STEP 1 guard, and the no-fill-target guard.

**Required change #2 (Finding B — suppression guard fires before delivery groups are
computed): ADDRESSED by scoping the guard to `groups.length > 0`.** The STEP 3 suppression
guard now reads
`if (autoDetect === true && groups.length > 0 && (total ?? 0) >= effectiveThreshold)`,
matching its own stated "options computed, none zero-cost" rationale. Concrete changes:

- **§6 STEP 3 guard + placement note:** added the `groups.length > 0` precondition and an
  inline comment explaining that the pre-address below-state progress bar promised by the
  edge table must not be swallowed.
- **§6 edge table (reconciled the contradiction):** the former single "groups empty (no
  address yet)" row was split into two non-contradictory rows — `total < threshold` →
  State 2 (below) and a new bolded `total >= threshold` → State 2 (below, near-full /
  clamped bar), the latter explicitly noting the suppression guard does NOT fire pre-
  address because it requires `groups.length > 0`. The suppression row was re-worded to
  say "options computed (`groups.length > 0`)" so the two rows describe a single
  consistent outcome for the "groups empty, total >= threshold" sub-case.
- **§11 QA + §13 checklist:** added functional check **14** ("Auto-detect, over
  threshold, pre-address") asserting a below-state bar (not a suppressed/blank render)
  while `deliveryGroups` is empty, then a transition to the suppressed state once options
  resolve with no zero-cost option. §13 step 5 now references the `groups.length > 0`
  scoping explicitly.

These were targeted patches to §5, §6, §9, §11, and §13 — no unrelated plan content was
changed and no scope was expanded.

---

## Review Pass 4 — 2026-06-11

**Reviewer:** Plan-Reviewer (adversarial)
**Plan under review:** `docs/plans/free-shipping-progress.md` (revised after the Pass-3
architect patch above)
**Method:** Re-read `CLAUDE.md` / `AGENTS.md` hard rules. Re-read the full revised plan.
Hand-traced every branch of the now-patched §6 decision tree for the two Pass-3 findings
plus adjacent cases. Re-verified the scaffold on disk against §4. **Independently
re-confirmed the load-bearing API claims (MCP-3/4/5) against the installed
`@shopify/ui-extensions@2026.4.0` type file** rather than trusting the "do not
re-question" framing — and in doing so found one API-accuracy gap the prior three passes
missed (Finding 1 below).

### 1. Were the two Pass-3 findings resolved correctly and completely?

**Yes to both. I hand-traced each.**

**Finding A (auto-detect + blank threshold silently disabled the feature) — RESOLVED.**
Trace with `autoDetect = true`, `rawThreshold = null` → `effectiveThreshold = (null ?? 0)
= 0`:
- STEP 1 checks `effectiveThreshold === null`. It is `0`, not `null`, so STEP 1 does
  **not** fire — no misconfig warning, feature not disabled. Correct.
- STEP 2 runs. If a zero-cost option exists → `qualified = true` → STEP 3 returns
  `{ kind: "qualified" }`. The qualified message now renders in exactly the config the
  setting copy invites. The original defect is gone.
- If no zero-cost option exists: with `effectiveThreshold === 0`, either the
  `groups.length > 0` suppression guard fires (`total >= 0` is always true) or the
  dedicated `effectiveThreshold === 0` no-fill-target guard fires — both return
  `{ kind: "empty" }`, hiding the bar. No divide-by-zero, no "$0.00 away" at 99%. Matches
  the documented intent. Complete.
- The setting-copy honesty fix (§5, line 141/147) now states the threshold is optional in
  auto-detect mode, so copy and logic no longer contradict. The Pass-3 root cause is
  closed at both the logic and documentation level.

**Finding B (suppression guard fired before delivery groups were computed) — RESOLVED.**
Trace with `autoDetect = true`, `rawThreshold = 25`, `total = 40`, `groups = []`:
- STEP 2: `groups.length === 0` → `qualified = false`.
- STEP 3 suppression guard now reads `autoDetect && groups.length > 0 && (total ?? 0) >=
  effectiveThreshold`. `groups.length > 0` is **false**, so the guard does **not** fire.
- Falls through to the `below` branch: `remaining = clamp(25 - 40, 0, 25) = 0`,
  `percent = clamp(round(160), 0, 99) = 99` → `{ kind: "below", percent: 99 }`. The
  pre-address near-full bar the edge table promises (line 378) renders. Correct.
- Once an address is entered and `groups.length > 0` with no zero-cost option, the guard
  fires and the state transitions to suppressed (render-nothing). The edge table rows
  (lines 377–382) and QA checks 12 and 14 describe this single consistent outcome with no
  remaining contradiction. Complete.

Both findings are genuinely closed, not papered over. The guard's text and its rationale
("options computed, none zero-cost") now match its code.

### 2. New issues introduced by the latest patch

**No regressions to manual mode or to the previously-passing cases.** I re-traced manual
mode (`autoDetect === false`): `effectiveThreshold = rawThreshold` (stays null when
unset) so STEP 1 still fires the misconfig warning, and `qualified = currentTotal >=
effectiveThreshold` still short-circuits before STEP 3, making both auto-detect guards
no-ops in manual mode. The `effectiveThreshold` indirection did not perturb manual mode.

One interaction worth recording (no action): in auto-detect mode with a *positive*
threshold and `groups.length > 0` and `total >= threshold` and no zero-cost option, the
order of the two STEP-3 guards is correct — the `groups.length > 0` suppression guard
fires first and returns `{ kind: "empty" }` before the `effectiveThreshold === 0` guard
is ever evaluated. No double-handling, no unreachable-branch bug. Traced and clean.

### 3. Remaining gap not previously flagged — `isZeroCost` reads the wrong cost field (Should-fix)

This is the one substantive finding of this pass, and it is an **API-accuracy gap in the
core auto-detect detection logic**, not a UX nit. The prior three passes verified that
`option.cost?.amount` exists and is a number (it does, MCP-4 is correct as far as it
goes) but none checked **whether `cost` is the right field to test for "free shipping."**

Reading the installed `2026.4.0` types directly:

- `ShippingOption.cost: Money` is documented as *"The cost of this delivery option
  **before any shipping discounts are applied**. Compare with `costAfterDiscounts` to
  show savings."* (standard.d.ts:1557–1560)
- `ShippingOption.costAfterDiscounts: Money` is *"The cost ... **after** shipping
  discounts have been applied. **This is the price the buyer actually pays for
  shipping.**"* (standard.d.ts:1561–1564)
- `PickupPointOption` has the same `cost` / `costAfterDiscounts` pair (1597–1604).

The plan's `isZeroCost(option)` (line 232) tests `option.cost?.amount === 0` — the
**pre-discount** price. But the single most common way a Shopify store offers free
shipping is a free-shipping **discount/automatic discount** (or a "free shipping over $X"
rule implemented as a discount), which zeroes out `costAfterDiscounts` while leaving
`cost` at the carrier's positive base rate. In that very common configuration the plan's
detector returns `false` and the customer who *does* qualify for free shipping never sees
the qualified message — the headline feature silently fails for the most typical merchant
setup.

A rate that is genuinely $0 at source (a merchant-defined "Free Shipping" flat rate priced
at 0) would still be caught by `cost`, so the plan is not *always* wrong — but it misses
the discount-driven case, which is at least as common and is exactly what "auto-detect free
shipping" merchants will expect to work. The plan should test `costAfterDiscounts.amount
=== 0` (the price the buyer actually pays), or test *both* (`(option.costAfterDiscounts ??
option.cost)?.amount === 0`) to be safe. Note `PickupLocationOption` still has neither
field, so the optional chain is still required either way.

This also has a QA consequence: §11 checks 3 and 12 instruct QA to "push the cart over the
store's free-ship rule" to make a zero-cost option appear. If that store rule is
implemented as a discount, those checks would *fail against the current `cost` logic* —
so the gap is detectable in QA, but only if QA happens to use a discount-based rule; a
$0-flat-rate test would mask it. The plan should pin this down before implementation.

### 4. Carried-forward / closed items

- **Pass-3 Finding A / B:** closed (traced above).
- **Pass-4 emoji-default duplication:** confirmed closed — §6 INPUTS (line 283) now
  references the single `resolveEmoji` helper; no weaker `typeof === "string"` inline form
  remains as a live snippet. Audit trail closed.
- **MCP-1/2 (settings field type, `s-progress` tone/`accessibilityLabel`):** unchanged
  since prior passes; not re-litigated. MCP-3/4/5 re-confirmed against
  `@shopify/ui-extensions@2026.4.0` this pass (formatCurrency:285, Money.amount:967,
  CartCost.totalAmount:863, cost:549, deliveryOptions:1463, PickupLocationOption has no
  cost:1611). All hold except the `cost`-vs-`costAfterDiscounts` semantics gap in
  Finding 3.

### 5. Observation, no action

- The `formatCurrency` vs `formatNumber` choice is correct — both exist in the type file
  (274 / 285); `formatCurrency` sets currency style internally and is the right pick for a
  money figure. Traced to confirm.
- §11 QA coverage for the two Pass-3 findings (checks 13 and 14) is present and asserts the
  right observable outcomes (qualified-message-with-no-warning, pre-address below-bar then
  transition). Good regression pinning for those two cases.

### Verdict rationale

The two Pass-3 should-fix findings are fully and correctly resolved with no manual-mode
regression — I traced both branch spaces by hand and the guards now match their stated
rationale. The latest patch introduced no new logic defects. However, an independent
re-read of the installed `2026.4.0` types surfaced a real correctness gap that survived
three prior passes: `isZeroCost` tests the pre-discount `cost` field, so the auto-detect
feature will silently fail to detect the most common (discount-driven) free-shipping
configuration. That is a single-line logic fix plus a QA-method clarification, not a
redesign, so this is not a REJECT — but it is a genuine correctness defect in the headline
code path that must be decided and written into the plan before implementation, so it is
not a clean APPROVE.

### Required changes

1. **Fix `isZeroCost` to test the price the buyer actually pays (Finding 3).** Change the
   §6 helper (line 232) and the MCP-4 note (lines 218–237) to detect zero on
   `costAfterDiscounts` — e.g. `(option.costAfterDiscounts ?? option.cost)?.amount === 0`
   — so discount-driven free shipping (the most common merchant setup) is detected. Keep
   the optional chain for `PickupLocationOption` (which has neither field). Add a one-line
   note in §10 / §6 distinguishing `cost` (pre-discount, line 1557–1560 of the type file)
   from `costAfterDiscounts` (buyer-paid, line 1561–1564).
2. **Clarify the auto-detect QA method (checks 3 and 12) so it exercises the real free-
   shipping path.** Specify that the dev-store free-shipping rule used to make a zero-cost
   option appear should be the kind merchants actually use (a free-shipping discount /
   "free shipping over $X" rule), and that QA must confirm detection fires on
   `costAfterDiscounts`, not only on a $0 flat rate — otherwise the test can pass while
   Finding 3 is still latent.

APPROVE WITH CHANGES

---

## Architect response to Pass 4 — required change addressed (2026-06-11)

The Architect has patched `docs/plans/free-shipping-progress.md` to address the single
should-fix finding (Finding 3) from this pass. Summary for the audit trail:

**Required change #1 (Finding 3 — `isZeroCost` tests the pre-discount `cost` field and
silently misses discount-driven free shipping): ADDRESSED via the "test both, fall back
to `cost`" predicate.** The zero-cost predicate everywhere it appears in the plan was
changed from `option.cost?.amount === 0` to `(option.costAfterDiscounts ?? option.cost)?.amount === 0`.
This tests the buyer-paid price (`costAfterDiscounts`) first — so a free-shipping
discount that zeroes `costAfterDiscounts` while leaving `cost` positive is now detected,
which is the most common real merchant setup — and falls back to `cost` when
`costAfterDiscounts` is absent so a genuinely flat-$0 rate still registers. The optional
chain is retained because `PickupLocationOption` has neither field. Concrete changes:

- **MCP-4 one-line summary (top of plan, item 4):** updated to
  `(option.costAfterDiscounts ?? option.cost)?.amount === 0` with a note that it tests the
  buyer-paid price after shipping discounts.
- **§6 MCP-4 resolved section:** the `isZeroCost` helper body now uses the
  `costAfterDiscounts ?? cost` predicate; the surrounding type notes were expanded to
  distinguish `cost` (pre-discount, standard.d.ts:1557–1560) from `costAfterDiscounts`
  (buyer-paid, standard.d.ts:1561–1564), noting both `ShippingOption` and
  `PickupPointOption` carry the pair and `PickupLocationOption` carries neither. Added an
  explicit paragraph explaining why the discount-driven case is the common one and must be
  detected.
- **§10 signal inventory:** the `shopify.deliveryGroups.value` row now distinguishes the
  two money fields and states that `isZeroCost` tests `costAfterDiscounts` first (falling
  back to `cost`) so discount-driven free shipping is detected.
- **§13 checklist:** MCP-4 line (step 1) and the pure-helpers step (step 4) updated to
  specify the `(option.costAfterDiscounts ?? option.cost)?.amount === 0` predicate and to
  call out that testing `cost` alone would miss discount-driven free shipping (Pass 4
  finding).

**Required change #2 (clarify auto-detect QA method, checks 3 and 12): ADDRESSED.** Both
QA checks now specify that the dev-store free-shipping rule used to surface a zero-cost
delivery option MUST be a discount-driven rule (a Shopify shipping discount / "free
shipping over $X" automatic discount that zeroes `costAfterDiscounts`), NOT a flat-$0
shipping rate. Concrete changes:

- **§11 check 3:** added an explicit requirement that the rule be discount-driven, that QA
  confirm detection fires on `costAfterDiscounts`, and a note that a flat-$0 rate would
  mask a regression if the predicate were reverted to `cost`-only.
- **§11 check 12 (contrast step):** the "satisfy the free-shipping rule" contrast step now
  requires the same discount-driven rule for the same reason — a flat-$0 rate would still
  register via the `cost` fallback and would therefore mask a broken `costAfterDiscounts`
  detection path.

This was a targeted patch to the MCP-4 summary, §6, §10, §11 (checks 3 and 12), and §13 —
no unrelated plan content was changed and no scope was expanded.

---

## Review Pass 5 — 2026-06-11

**Reviewer:** Plan-Reviewer (adversarial)
**Plan under review:** `docs/plans/free-shipping-progress.md` (revised after the Pass-4
architect patch above)
**Method:** Re-read `CLAUDE.md` / `AGENTS.md` hard rules. Re-read the full revised plan.
Re-read the scaffold on disk (`src/Checkout.jsx`, `shopify.extension.toml`) against §4.
**Independently re-read the installed `@shopify/ui-extensions@2026.4.0` type definitions**
(`node_modules/.pnpm/@shopify+ui-extensions@2026.4.0_.../build/ts/surfaces/checkout/api/standard/standard.d.ts`)
to verify the Pass-4 `costAfterDiscounts` fix against the actual types, rather than
trusting the architect's response summary. The Shopify Dev MCP is not registered in this
environment, so verification was against the installed `2026.4.0` types (the authoritative
on-disk source for `api_version = "2026-04"`), as in prior passes.

### 1. Was the Pass-4 finding (`isZeroCost` testing `cost` instead of `costAfterDiscounts`) resolved correctly and completely?

**Yes — the fix is correct and applied consistently across every location.** I grepped the
plan for every occurrence of the predicate and confirmed all of them now read
`(option.costAfterDiscounts ?? option.cost)?.amount === 0`:

- **MCP-4 top-of-plan summary** (line 35): updated, notes it tests the buyer-paid price.
- **`isZeroCost` helper** (§6, lines 246–248): the body is the corrected predicate.
- **MCP-4 resolved section** (§6, lines 218–251): expanded to distinguish `cost`
  (pre-discount) from `costAfterDiscounts` (buyer-paid), and explains why the
  discount-driven case is the common one that must be detected.
- **§10 signal inventory** (line 574): the `deliveryGroups` row now states `isZeroCost`
  tests `costAfterDiscounts` first, falling back to `cost`.
- **§13 checklist** (steps 1 and 4, lines 762, 776–780): both reference the corrected
  predicate and explicitly warn that testing `cost` alone misses discount-driven free
  shipping.

No stale `option.cost?.amount === 0`-only form remains anywhere as a live snippet (`cost`
only appears now in explanatory contrast text). The fix is complete, not partial.

**The QA-method clarification is also complete.** §11 check 3 (lines 631–638) and check 12
contrast step (lines 664–670) both now mandate a *discount-driven* free-shipping rule (a
Shopify shipping discount / "free shipping over $X" automatic discount that zeroes
`costAfterDiscounts` while leaving `cost` positive), explicitly forbid a flat-$0 rate as
the test vehicle, and state that a flat-$0 rate would mask a regression because it would
still register via the `cost` fallback. This is exactly the regression-pinning the Pass-4
required change #2 asked for, and it correctly closes the "test can pass while the bug is
latent" hole. Good.

**Independent type verification of the corrected predicate:**

- `ShippingOption` (standard.d.ts:1548–1569) and `PickupPointOption` (1588–1609) each
  carry `cost: Money` (1560 / 1600) and `costAfterDiscounts: Money` (1564 / 1604). The
  doc comments confirm `costAfterDiscounts` is "the price the buyer actually pays for
  shipping" (1562 / 1602). The fix tests the right field. Confirmed.
- `PickupLocationOption` (1611–1620) has only `type` and `location` — neither cost field.
  For it, `(undefined ?? undefined)?.amount === 0` evaluates to `undefined === 0` → `false`,
  so a pickup location is never falsely treated as free shipping. The optional chain is
  genuinely load-bearing here. Confirmed correct.
- `Money.amount: number` (967) — the `=== 0` numeric comparison is sound; no string-coercion
  bug. `DeliveryGroup.deliveryOptions: DeliveryOption[]` (1463) — the `.some(isZeroCost)`
  property access is correct.

The fix is correct against the actual `2026.4.0` types, not merely against the architect's
self-report.

### 2. New issues introduced by the latest patch

**No new logic defects.** The Pass-4 patch only touched the zero-cost predicate and the two
QA checks; it did not alter the decision tree, the effective-threshold derivation, or the
suppression/no-fill-target guards traced clean in Pass 4. The predicate change is a strict
improvement (detects a superset of the previously-detected free-shipping configurations)
and cannot cause a *false* qualified state: it still only returns `true` when an option's
buyer-paid (or, in fallback, base) cost is exactly `0`. No manual-mode interaction (manual
mode never calls `isZeroCost`). Re-traced — clean.

### 3. Minor accuracy nit in the fix's stated rationale (non-blocking, no change required)

One small inaccuracy in the *justifying comment*, not the code: the plan repeatedly says
the `?? option.cost` fallback exists because `costAfterDiscounts` "may be absent" on a
flat-$0 rate (§6 lines 239, 243–244; §13 step 1). Per the installed `2026.4.0` types,
`costAfterDiscounts` is typed as **non-optional `Money`** on both `ShippingOption` and
`PickupPointOption` (standard.d.ts:1564, 1604) — it is never absent on the two option
types that have a cost at all. For a genuine flat-$0 rate, `costAfterDiscounts.amount`
would itself be `0` and the *primary* test catches it; the `?? option.cost` branch is
therefore purely defensive and is never load-bearing under the typed contract (the only
type lacking the field is `PickupLocationOption`, which lacks *both* fields and is correctly
handled by the trailing `?.`). This makes the code *more* robust, not less, so it is
harmless — but the stated reason ("costAfterDiscounts may be absent on flat-$0 rates") is
technically wrong and could mislead a future maintainer. Optional: the Coder may note in
impl-notes that the fallback is defensive-only given the non-optional typing. **Not a
required change** — the predicate behavior is correct as written.

### 4. Remaining gaps not flagged across all five passes

I re-scanned the full plan and scaffold for anything still open. Nothing rises to a
required change. Two items worth recording so the Coder/QA have them in view:

- **`local`-type shipping options.** `ShippingOption.type` is `'shipping' | 'local'`
  (standard.d.ts:1552), and `DeliveryOption` also includes `'pickupPoint'` and `'pickup'`.
  `isZeroCost` operates on the `cost`/`costAfterDiscounts` fields, which exist on both
  `ShippingOption` (covers `'shipping'` and `'local'`) and `PickupPointOption`, so a
  zero-cost *local delivery* or *pickup-point* option would also register as "free
  shipping." This is consistent with the feature intent ("you can get free delivery") and
  matches the §11 "qualifies on availability, not selection" behavioral note. No action —
  noting only that the predicate intentionally treats any zero-cost delivery option,
  including local/pickup-point, as qualifying. The Coder should not add a `type === 'shipping'`
  filter unless the brief later narrows the definition of "free shipping."
- **`s-progress` empty-track render at `value=0`** (carried from Pass 3, still un-pinned):
  the $0-total / 0% case renders `value={0} max={100}`. Already flagged as a QA eyeball
  item in the Pass-3 section; QA check on the $0-total behavioral edge should confirm the
  track renders visibly rather than collapsing. Minor; not blocking.

### 5. Carried-forward / closed items

- **Pass-4 Finding 3 (`isZeroCost` cost field) + QA-method clarification:** both closed,
  verified against the `2026.4.0` types this pass (§1 above).
- **Pass-3 Findings A / B (blank-threshold dead-end; pre-address suppression scope):**
  remain closed; the Pass-4 patch did not touch the guards. Re-confirmed the
  `effectiveThreshold` derivation and the `groups.length > 0`-scoped suppression guard are
  still present and unchanged in §6.
- **Pass-4 emoji-default duplication:** closed; §6 INPUTS references the single
  `resolveEmoji` helper, no weaker inline form remains.
- **MCP-1/2/3/5 (settings field type, `s-progress` tone/`accessibilityLabel`,
  `formatCurrency`, `cost.totalAmount` shape):** re-confirmed against `2026.4.0` types
  this pass where load-bearing (`formatCurrency` at standard.d.ts:285,
  `Money.amount`:967, `CartCost.totalAmount`:863, `cost: CartCost`:549). All hold.

### Verdict rationale

The single Pass-4 should-fix finding (`isZeroCost` reading the pre-discount `cost` field) is
fully and correctly resolved: the corrected `(option.costAfterDiscounts ?? option.cost)?.amount === 0`
predicate is applied consistently in all six locations, verified against the actual
installed `2026.4.0` types — it tests the buyer-paid price, correctly handles the
no-cost-field `PickupLocationOption` via the optional chain, and cannot produce a false
qualified state. The required QA-method clarification (discount-driven rule, not a flat-$0
rate) landed in checks 3 and 12 and properly closes the latent-bug-masking hole. The patch
introduced no new logic defects and did not perturb the previously-verified decision tree
or guards. The only new observation is a minor inaccuracy in the fallback's *justifying
comment* (`costAfterDiscounts` is typed non-optional, so the fallback is defensive-only,
not required for flat-$0 rates) — this makes the code more robust, not less, and is a
non-blocking documentation nit, not a correctness defect. No remaining required changes
across all five passes. The plan is sandbox-compliant, accurately API-grounded, internally
consistent, and ready to implement as-is.

APPROVE

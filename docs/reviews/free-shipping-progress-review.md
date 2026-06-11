# Plan Review: `free-shipping-progress`

**Reviewer:** Plan-Reviewer (adversarial)
**Plan under review:** `docs/plans/free-shipping-progress.md`
**Feature brief (source of truth):** `docs/features/free-shipping-progress.md`
**Scaffold inspected:** `extensions/free-shipping-progress/src/Checkout.jsx`, `shopify.extension.toml`, `locales/en.default.json`, `locales/fr.json`
**Date:** 2026-06-11

I did not write this plan and approached it skeptically. Overall the plan is strong: it is grounded in the on-disk scaffold, the five MCP items are resolved and internally cited, the state machine is explicit, and sandbox compliance is sound. There is, however, one concrete consistency defect (the verification section still describes the pre-MCP-2 tone palette) plus a handful of smaller gaps worth folding in before implementation. Verdict is at the bottom.

---

## 1. Sandbox compliance — PASS

- No browser APIs proposed. All data reads go through `shopify.*.value` signals.
- `render(<Extension />, document.body)` uses `document.body`, but this is the scaffold's own entry contract (`@shopify/ui-extensions/preact` provides the sandboxed `document` shim), present in the existing `Checkout.jsx`. The plan correctly preserves it rather than introducing new browser-global usage. Not a violation.
- No `fetch`, no `localStorage`, no `window`. The component is explicitly read-only (no mutations), so no capability declaration is needed in the TOML. Good — and the plan correctly removes the now-unused `[[extensions.metafields]] requestedFreeGift` block and the `canSetCartMetafields` instruction check.
- Only `s-stack`, `s-text`, `s-progress` used. All are Polaris web components per CLAUDE.md §4. PASS.

## 2. Signal-access correctness — PASS (matches the verified types)

- `shopify.cartLines.value` (array) — correct.
- `shopify.cost.totalAmount.value.amount` and `.value.currencyCode` — correct per MCP-5. The plan explicitly corrects the earlier wrong path `shopify.cost.value.totalAmount` to `shopify.cost.totalAmount.value`, which matches "cost is a plain `CartCost`, `totalAmount` is the signal."
- `shopify.deliveryGroups.value ?? []` — correct (`SubscribableSignalLike<DeliveryGroup[]>`).
- `shopify.settings.value` — read via `.value`, consistent with the signal pattern.
- `group.deliveryOptions` and `option.cost?.amount` — correct per MCP-4, including the optional chain for `PickupLocationOption` which has no `cost`.

No remaining wrong signal paths found.

## 3. Component-attribute correctness — PASS

- `s-progress` `tone={state.tone}` constrained to `'auto' | 'critical'` (MCP-2) — correct.
- `accessibilityLabel` (camelCase) rather than `aria-label` — correct, and the plan calls this out explicitly.
- `value={percent} max={100}` with `percent` a 0–99 integer — valid per MCP-2 (value/max are arbitrary positive floats). No concern.
- `s-stack gap="base"` — `gap` is a standard token attribute; reasonable. (Coder should confirm `"base"` is a valid gap token at 2026-04; it is used elsewhere in the scaffold's `s-stack gap="base"`, so it is grounded.)

## 4. Settings schema — PASS

- All four field types are MCP-1-legal: `boolean`, `number_decimal`, `single_line_text_field`, `single_line_text_field`. No `choice`. Correct.
- Defaults are applied in code, not TOML — correct, since TOML cannot declare defaults at this api_version.
- No missing fields versus the brief's four-setting table. No unnecessary fields.

## 5. i18n completeness — PASS with one note

- Three keys (`progressMessage`, `qualifiedMessage`, `progressBarAriaLabel`) cover every user-facing string in the JSX. No hardcoded user-facing text in any snippet.
- The `console.warn` misconfiguration string is developer-facing (console only, never rendered), so it is correctly exempt from i18n. Good.
- Note (non-blocking): the translation key is `progressBarAriaLabel` while the JSX attribute is `accessibilityLabel`. This key/attribute name mismatch is purely cosmetic (the key name is internal) and matches the brief's key list, so it is fine — but the Coder should not "fix" the key name to match the attribute, because the brief and both locale files pin `progressBarAriaLabel`.

## 6. Logic correctness — mostly sound; see edge notes

- State machine (Section 6) is well-ordered: empty cart → misconfig guard → qualification → emit. Tagged union is clean.
- `toPositiveNumber`: rejects non-finite and `<= 0`. Correct for a threshold (a `0` threshold is meaningless and would cause divide-by-zero in `rawPercent`; rejecting it routes to "render nothing"). Good defensive choice.
- `clamp` and `resolveTone` are correct.
- Boolean default subtlety (`!== false` so unset → auto-detect `true`) is handled correctly and called out in Section 9. This matches the brief's `true` default. Good catch by the architect.
- Percent capped at 99 matches the brief ("0% to 99%"). No off-by-one.
- `isZeroCost(option)` returns `false` when `cost` is undefined — correct for pickup options.

Edge concerns to flag (none are blockers, but should be acknowledged in impl notes):

- **(a) Genuine $0 cart total in manual mode.** `toPositiveNumber(total)` returns `null` for a `0` total, then `currentTotal = total ?? 0 = 0`. Qualification is `0 >= threshold` → `false`, progress 0%. Correct behavior, but note that a non-empty cart whose total is legitimately `0` (e.g., a 100%-off discount) will render "render nothing" only if the cart is empty — here it renders State 2 at 0%, showing "{full threshold} away from free shipping." That is arguably odd UX (a fully-discounted cart showing distance to free shipping) but it is consistent with the brief and not a defect. Worth a one-line QA note.
- **(b) Auto-detect "any zero-cost option = qualified."** `groups.some(g => g.deliveryOptions.some(isZeroCost))` treats the mere *existence* of a free option as qualified, even if the customer has a paid option selected. This matches the brief verbatim ("If a zero-cost option exists → State 3"), so it is correct-to-spec — but it is a product decision worth surfacing to QA: a customer who could pick free pickup but selected paid express will still see "you qualify." Acceptable per brief; flag for sign-off.
- **(c) `settings.value` could be `undefined`.** Section 6 reads `settings.use_shopify_free_shipping_rate` etc. directly off `shopify.settings.value`. If `shopify.settings.value` itself is `undefined`/null before hydration, every `settings.x` read throws. The plan assumes `settings` is always an object. Low risk (settings are static merchant config, generally present), but the Coder should guard with `const settings = shopify.settings.value ?? {}` to be safe. Recommend adding this to the plan.

## 7. Tone-narrowing consistency — FAIL (one stale section)

The MCP-2 narrowing from five tones to `['auto', 'critical']` is applied correctly in: Section 5 TOML description, Section 6 `ALLOWED_TONES`/`resolveTone`, Section 7 JSX comment, the Section 9 settings table, and the brief itself.

**It is NOT applied in Section 11 (Build & verification), item 8**, which still reads:

> "8. **Tone customization** → each of `primary/success/warning/critical/neutral` changes the bar fill; an invalid value falls back to `primary`."

This is the pre-MCP-2 palette and the wrong fallback (`primary` instead of `auto`). `primary`, `success`, `warning`, `neutral` are not valid `s-progress` tones at 2026-04, so this verification step is unrunnable as written and contradicts the rest of the plan. The brief's own verification item 8 already has the correct version ("between `auto` and `critical` ... invalid value (e.g. `success`) ... falls back to `auto`"). This must be corrected so QA does not test against impossible values.

## 8. File-list completeness — PASS

Section 4 covers all five files the brief requires (Checkout entry, TOML, en.default.json, es.json create, fr.json delete). Cross-checked against disk:

- `es.json` does not currently exist → "Create" is correct.
- `fr.json` exists → "Delete" is correct.
- `en.default.json` rewrite drops the four scaffold keys (`welcome`, `iWouldLikeAFreeGiftWithMyOrder`, `addAFreeGiftToMyOrder`, `metafieldChangesAreNotSupported`); since the rewritten component references none of them, no dangling key lookups remain. PASS.

One minor mismatch with the brief: the brief's "Files affected" table names the entry file `Checkout.tsx (or scaffolded equivalent)`, while the actual scaffold is `Checkout.jsx`. The plan correctly resolves this to `.jsx` and explicitly says "do not rename to `.tsx`." Good — the plan is more accurate than the brief here.

## 9. Performance — PASS

Zero new dependencies; only `preact` + `@shopify/ui-extensions/preact` (already present). All logic is small inline pure functions. Deleting `fr.json` slightly reduces bundle. The <50KB target is plausible. No risky imports. The plan keeps `shopify app build` as the size-recording step.

## 10. Missing concerns

- **Type safety:** the entry file is `.jsx` (not `.tsx`), so there is no compile-time checking of signal shapes or the tagged union. The plan does not call this out. Given the scaffold is JSX and CLAUDE.md says do not rename, this is acceptable — but the impl notes should record that `shopify app build` is the only type/sandbox gate and that signal-shape correctness rests on the MCP-verified paths, not on `tsc`. Recommend a one-line acknowledgement.
- **No error boundary:** if `resolveState()` throws (e.g., concern 6c), the whole extension fails to render. A `settings ?? {}` guard (6c) plus the existing `?? []`/`?? 0` guards make a throw unlikely, so a full error boundary is not required — but the Coder should ensure every signal read in the hot path is null-guarded.
- **`qualified_emoji` length:** a merchant could paste a long string (not just an emoji) into `qualified_emoji`. The plan trims and defaults blank/whitespace to `🎉`, but does not cap length. Low risk; the brief does not require validation beyond non-empty. No change required, just noting.

---

## Required changes (fold in before implementation)

1. **Fix Section 11 verification item 8** to use the MCP-2 tone set: test `auto` and `critical` only, and confirm an invalid value falls back to **`auto`** (not `primary`). Remove all references to `primary/success/warning/neutral`. This is the one hard inconsistency in the plan.
2. **Add a `settings` null guard** to Section 6 (e.g., `const settings = shopify.settings.value ?? {}`) so the destructuring reads cannot throw before settings hydrate (concern 6c).
3. **Record in the plan / impl-notes** that, because the entry file is `.jsx`, `shopify app build` is the sole type/sandbox gate and signal-shape correctness depends on the MCP-verified paths (no `tsc` coverage). Acknowledge edge concerns 6a and 6b as known, accepted, to-be-QA'd product behaviors.

These are small, scoped edits; the plan's architecture, signal paths, settings schema, and i18n are otherwise correct and ready.

APPROVE WITH CHANGES

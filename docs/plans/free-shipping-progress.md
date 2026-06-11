# Implementation Plan: `free-shipping-progress` Checkout UI Extension

**Status:** READY FOR PLAN REVIEW

**Slug:** `free-shipping-progress`
**Author:** Architect
**Date:** 2026-06-11 (revised)
**Source of truth:** `docs/features/free-shipping-progress.md`
**API version:** `2026-04` (Preact + Polaris web components, global `shopify` signals object)

---

## MCP grounding note (must read)

The project `CLAUDE.md` and `AGENTS.md` require calling `learn_shopify_api`
targeting `polaris-checkout-extensions` at `api_version = "2026-04"` **once at the
start of any work**, followed by `search_docs_chunks` to verify component
attributes, setting field types, and signal shapes. The Shopify Dev MCP was **not
registered in the Architect's environment**, so those calls could not be executed
during planning. The CLAUDE.md directive is conditional ("IF the Shopify Dev MCP
is registered"), so this plan does not violate it — but it does mean a handful of
API specifics below are grounded only in the on-disk scaffold and type
declarations, not in live MCP confirmation.

All five **[VERIFY MCP-N]** items are now **resolved** — `learn_shopify_api` +
`search_docs_chunks` were run against `polaris-checkout-extensions` at `2026-04`,
and the type file
`build/ts/surfaces/checkout/api/standard/standard.d.ts` in
`@shopify/ui-extensions` was read directly. Each tag in the plan has been replaced
with the confirmed value. The five items were:

1. `choice` field type → **NOT supported**; use `single_line_text_field` (MCP-1)
2. `s-progress` attributes → `tone: 'auto'|'critical'` only; `accessibilityLabel` (MCP-2)
3. Currency formatter → `shopify.i18n.formatCurrency(number, Intl.NumberFormatOptions)` (MCP-3)
4. Delivery option cost → `option.cost?.amount === 0` (number, optional chain for PickupLocation) (MCP-4)
5. `cost.totalAmount` shape → `shopify.cost.totalAmount.value.amount` (number); `shopify.cost.totalAmount.value.currencyCode` (MCP-5)

What **is** confirmed from on-disk ground truth (do not re-question):

- The entry file is `src/Checkout.jsx` (JSX, not TSX). It imports
  `'@shopify/ui-extensions/preact'` and `render` from `preact`, and renders into
  `document.body` via an exported `async () => { render(<Extension />, document.body) }`.
- Data is exposed as **Preact signals** read through `.value`. The scaffold uses
  `shopify.instructions.value...` and `shopify.appMetafields.value`. By the same
  pattern: `shopify.cartLines.value`, `shopify.cost.value`,
  `shopify.deliveryGroups.value`, `shopify.settings.value`.
- `shopify.i18n.translate(key, params)` is the translation call (used in the scaffold).
- The `shopify` global is typed as
  `import('@shopify/ui-extensions/purchase.checkout.block.render').Api` (`shopify.d.ts`).
- Polaris web components are globally registered `s-*` JSX elements; no import needed.

---

## 1. Summary

Render a free-shipping progress bar inside the Shopify checkout that reactively
shows the customer how close their cart is to qualifying for free shipping, using
Polaris web components (`s-*`) and the global `shopify` signals object at
`api_version = "2026-04"`. The merchant configures four settings (auto-detect
toggle, manual threshold, progress bar tone, qualified emoji); the extension
resolves one of three render states (empty / below-threshold / qualified) and uses
the manual threshold to drive the progress bar fill in both toggle modes because
the Checkout API does not expose the merchant's real free-shipping threshold value.

---

## 2. Non-goals (carried verbatim from the feature brief)

- Customer-facing customization of message text beyond translations.
- Multiple progressive thresholds (free shipping at $50, free gift at $100, etc.).
- Animation or transitions on the progress bar fill changes.
- Persistence of any state across sessions.
- Integration with marketing tools (Klaviyo, Attentive) or analytics events.
- A dismiss button or "remind me later" UX.
- Additional locales beyond English and Spanish (French, German, etc., are deferred).
- Reading the merchant's actual free-shipping threshold value (not exposed by the
  Checkout API; if Shopify adds this surface in a future API version, a follow-up
  plan can switch to it).

---

## 3. Extension target

- **Target:** `purchase.checkout.block.render` (already configured in
  `shopify.extension.toml`; do not change). Generic block; the merchant places it
  via the checkout editor.
- **API surface provided at this target** (typed via
  `@shopify/ui-extensions/purchase.checkout.block.render`): the reactive `shopify`
  signals object including `shopify.cartLines`, `shopify.cost`,
  `shopify.deliveryGroups`, `shopify.settings`, `shopify.shippingAddress`, plus
  `shopify.i18n` (translate + currency formatting) and `shopify.extension`.
- **Data-availability caveat:** `shopify.deliveryGroups` is typically empty until
  the customer has entered enough address information to compute shipping options.
  The threshold logic in Section 6 treats an empty `deliveryGroups` as
  "not yet qualified" (State 2). Confirmed: `deliveryGroups: SubscribableSignalLike<DeliveryGroup[]>`
  is present in `StandardApi` (standard.d.ts:553).

---

## 4. Files to modify

| File | Action |
| :--- | :--- |
| `extensions/free-shipping-progress/src/Checkout.jsx` | **Rewrite.** Replace the scaffolded free-gift metafield demo with the free-shipping-progress component (state resolution + three render states). Keep the Preact entry shape: `import '@shopify/ui-extensions/preact'`, `import {render} from "preact"`, and `export default async () => { render(<Extension />, document.body) }`. |
| `extensions/free-shipping-progress/shopify.extension.toml` | **Edit.** Add the four settings under `[extensions.settings]` / `[[extensions.settings.fields]]` (Section 5). Remove the scaffolded `[[extensions.metafields]]` block for `requestedFreeGift` (the rewritten component no longer reads/writes that metafield). Leave `api_version`, `[[extensions.targeting]]`, and `api_access` untouched. |
| `extensions/free-shipping-progress/locales/en.default.json` | **Rewrite.** Replace the scaffolded keys with the three keys in Section 8. |
| `extensions/free-shipping-progress/locales/es.json` | **Create.** Spanish translations (Section 8). Does not currently exist. |
| `extensions/free-shipping-progress/locales/fr.json` | **Delete.** Out of scope for v1. |

No other extensions or app-level files (`shopify.app.toml`, root `package.json`,
`.shopify/`) are modified. The entry-module path in `shopify.extension.toml`
stays `./src/Checkout.jsx` — do **not** rename to `.tsx`.

> Note on `[[extensions.metafields]]`: the scaffolded `requestedFreeGift` metafield
> and the `canSetCartMetafields` instruction check are part of the demo only. The
> free-shipping-progress feature does not use cart metafields, so the metafields
> block is removed to keep the toml aligned with what the extension actually does
> (CLAUDE.md §9 pre-save audit). The rewritten component does **not** call any
> mutation (`applyMetafieldChange`, `applyAttributeChange`, etc.); it is read-only.

---

## 5. Settings schema (`shopify.extension.toml`)

Four fields. TOML **cannot declare default values** for settings fields at this
api_version, so every default listed below is applied **in code** (Section 9), not
in the toml. The merchant sees empty/unset fields until they configure them; the
component must tolerate unset values.

### Proposed TOML

```toml
[extensions.settings]

[[extensions.settings.fields]]
key = "use_shopify_free_shipping_rate"
type = "boolean"
name = "Auto-detect free shipping from delivery options"
description = "When enabled, detect the qualified state from currently-available zero-cost delivery options. When disabled, use the manual threshold below."

[[extensions.settings.fields]]
key = "manual_threshold"
type = "number_decimal"
name = "Manual free shipping threshold"
description = "Cart total at which free shipping applies. Drives the progress bar in both modes; also used for qualified-state detection when auto-detect is off."

[[extensions.settings.fields]]
key = "progress_bar_tone"
type = "single_line_text_field"  # verified MCP-1: "choice" not supported at 2026-04 (MCP search + standard.d.ts). Supported types: boolean, single_line_text_field, multi_line_text_field, number_integer, number_decimal, date, date_time, variant_reference.
name = "Progress bar tone"
description = "Semantic tone for the progress bar fill. One of: auto, critical. Defaults to auto. (s-progress only accepts 'auto' or 'critical'.)"

[[extensions.settings.fields]]
key = "qualified_emoji"
type = "single_line_text_field"
name = "Qualified state emoji"
description = "Emoji shown next to the \"You qualify for free shipping\" message."
```

### MCP-1 resolved — `choice` field type not supported

`type = "choice"` does **not** exist in the settings API at `api_version = "2026-04"`.
The MCP returned the exhaustive supported-type list: `boolean, single_line_text_field,
multi_line_text_field, number_integer, number_decimal, date, date_time, variant_reference`.
(verified via `search_docs_chunks` against the Settings API docs)

`progress_bar_tone` uses `single_line_text_field` (shown in TOML above). Runtime
code validates the value against the allowed set `{"auto", "critical"}` — **note
this is narrower than the original plan's {primary, success, warning, critical,
neutral}**, because `s-progress` only accepts `tone="auto"` or `tone="critical"`
(see MCP-2 below). Fallback is `"auto"`.

---

## 6. Threshold resolution logic

All reads use `.value` (Preact signals). The component reads the four settings,
the cart total, the cart lines, and the delivery groups, then returns a tagged
union describing the render state. Pure helpers are defined inline.

### Inline pure helpers

```js
// Coerce an arbitrary settings value to a positive finite number, else null.
function toPositiveNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

// Clamp n into [min, max].
function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

// verified MCP-2: s-progress tone only accepts 'auto' | 'critical' (standard.d.ts + MCP docs)
const ALLOWED_TONES = ["auto", "critical"];

function resolveTone(raw) {
  return ALLOWED_TONES.includes(raw) ? raw : "auto";
}
```

### MCP-4 resolved — delivery option cost path

Confirmed from `standard.d.ts` (lines 1451–1515):

- `DeliveryGroup.deliveryOptions: DeliveryOption[]` — property name is `deliveryOptions`.
- `DeliveryOption = ShippingOption | PickupPointOption | PickupLocationOption`
- `ShippingOption.cost: Money` and `PickupPointOption.cost: Money` — both have cost.
- `PickupLocationOption` (type `'pickup'`) has **no `cost` property** — needs optional chain.
- `Money.amount: number` — it's a JavaScript number, not a money string.

Zero-cost detection (confirmed shape, no longer defensive):

```js
// verified MCP-4: option.cost.amount is a number; PickupLocationOption has no cost.
function isZeroCost(option) {
  return option.cost?.amount === 0;
}
```

The delivery group's options array property is `deliveryOptions` (confirmed: `DeliveryGroup.deliveryOptions: DeliveryOption[]` in standard.d.ts:1463).

### Decision tree (drives `resolveState()` — see Section 7 for the tagged union)

```
INPUTS (all via .value):
  lines      = shopify.cartLines.value            // array
  total      = toPositiveNumber(shopify.cost.totalAmount.value.amount)  // verified MCP-5: shopify.cost is CartCost (plain object); totalAmount is the signal; Money.amount is a number
  groups     = shopify.deliveryGroups.value ?? [] // array
  settings   = shopify.settings.value ?? {}
  autoDetect = settings.use_shopify_free_shipping_rate === true   // default true if unset (Section 9)
  threshold  = toPositiveNumber(settings.manual_threshold)        // null if unset/invalid
  tone       = resolveTone(settings.progress_bar_tone)            // 'auto' fallback (MCP-2: only 'auto'|'critical' supported)
  emoji      = (typeof settings.qualified_emoji === "string" ? settings.qualified_emoji : "🎉")

STEP 0 — empty cart:
  if (lines.length === 0) -> STATE: { kind: "empty" }   // render nothing

STEP 1 — misconfiguration guard:
  if (threshold === null):
      console.warn('[free-shipping-progress] manual_threshold is unset, zero, or invalid; rendering nothing.')
      -> STATE: { kind: "empty" }                       // render nothing

STEP 2 — qualification:
  if (autoDetect === true):
      // Toggle ON: detect from delivery options.
      hasZeroCostOption = groups.some(g => (g.deliveryOptions ?? []).some(isZeroCost))
      if (groups.length === 0):
          // delivery groups not computed yet (no/insufficient address) -> not yet qualified
          qualified = false
      else if (hasZeroCostOption):
          qualified = true                              // includes "all options zero-cost"
      else:
          qualified = false
  else:
      // Toggle OFF: manual comparison.
      // total may be null if cost signal not ready; treat null total as 0 progress, not qualified.
      currentTotal = total ?? 0
      qualified = currentTotal >= threshold

STEP 3 — emit state:
  if (qualified):
      -> STATE: { kind: "qualified", emoji }
  else:
      currentTotal = total ?? 0
      remainingNum = clamp(threshold - currentTotal, 0, threshold)
      // percent fill: cap at 99 so the bar never reads "100%" while below qualified.
      rawPercent   = (currentTotal / threshold) * 100
      percent      = clamp(Math.round(rawPercent), 0, 99)
      -> STATE: {
           kind: "below",
           tone,
           percent,                 // 0..99 integer
           remaining: remainingNum, // number, to be currency-formatted at render
         }
```

### Edge / misconfiguration cases (all handled above)

| Case | Resolution |
| :--- | :--- |
| Cart empty (`lines.length === 0`) | State 1 (render nothing). |
| `manual_threshold` unset / 0 / non-numeric | `console.warn('[free-shipping-progress] ...')`, render nothing. |
| Toggle ON, `deliveryGroups` empty (no address yet) | State 2, progress vs `manual_threshold`. |
| Toggle ON, options exist, at least one zero-cost | State 3 (qualified). |
| Toggle ON, options exist, **all** zero-cost | State 3 (qualified) — covered by `.some(isZeroCost)`. |
| Toggle ON, options exist, none zero-cost | State 2. |
| Toggle OFF, `total >= threshold` | State 3 (qualified). |
| Toggle OFF, `total < threshold` | State 2. |
| `total` signal not yet populated | Treated as `0` → State 2 at 0% (never crashes). |
| `progress_bar_tone` unset/invalid | Falls back to `auto` (`resolveTone`; MCP-2). |
| `qualified_emoji` unset/non-string | Falls back to `🎉`. |

---

## 7. Component design

`resolveState()` returns a **tagged union** keyed on `kind`
(`"empty" | "qualified" | "below"`). The `Extension` component calls
`resolveState()` and switches on `kind`. Because all inputs are Preact signals read
via `.value` inside render, the component re-renders reactively when cart total,
lines, delivery groups, or settings change (covers the discount-code reactive
update scenario without any explicit subscription).

### State 1 — `kind: "empty"`

```jsx
return null;   // render nothing
```

### State 2 — `kind: "below"`

Layout: a vertical stack containing the "away from free shipping" message and the
progress bar.

```jsx
const remaining = formatRemaining(state.remaining);   // Section 8 currency call
return (
  <s-stack gap="base">
    <s-text>
      {shopify.i18n.translate("progressMessage", { remaining })}
    </s-text>
    <s-progress
      value={state.percent}        /* 0..99 integer; max={100} valid — value/max are arbitrary positive numbers */
      max={100}
      tone={state.tone}            /* verified MCP-2: tone accepts 'auto' | 'critical' only */
      accessibilityLabel={shopify.i18n.translate("progressBarAriaLabel", { percent: state.percent })}
                                   /* verified MCP-2: attribute is accessibilityLabel (camelCase), not aria-label */
    />
  </s-stack>
);
```

### State 3 — `kind: "qualified"`

```jsx
return (
  <s-text>
    {shopify.i18n.translate("qualifiedMessage", { emoji: state.emoji })}
  </s-text>
);
```

### MCP-2 resolved — `s-progress` attribute schema

Confirmed from MCP `search_docs_chunks` (Progress component docs at 2026-04):

| Attribute | Confirmed value |
| :--- | :--- |
| Tone attribute name | `tone` (correct guess) |
| Allowed tone values | **`'auto' \| 'critical'` only** — NOT primary/success/warning/neutral. `auto` adapts to context; `critical` is red/error. |
| Value/max convention | `value` and `max` are arbitrary positive floats; the component renders `value/max` as the fill. `max` defaults to `1`. Using `value={percent} max={100}` (0–99 integer out of 100) is valid. |
| Accessibility attribute | `accessibilityLabel` (camelCase JSX) — NOT `aria-label`. |

Consequence for the plan:
- `ALLOWED_TONES` is `["auto", "critical"]` and fallback is `"auto"` (updated in Section 6).
- The `progress_bar_tone` setting description updated to "One of: auto, critical."
- The merchant can only meaningfully choose between neutral/adaptive and error-red — the setting is still useful for stores that want to signal urgency (`critical`) vs. the default look (`auto`).
- `accessibilityLabel` replaces `aria-label` in the JSX (updated above).

---

## 8. i18n plan

Three translation keys. All user-facing text goes through
`shopify.i18n.translate(key, params)` (confirmed pattern from the scaffold). No
hardcoded strings in JSX.

### `locales/en.default.json` (full contents)

```json
{
  "progressMessage": "{{remaining}} away from free shipping",
  "qualifiedMessage": "{{emoji}} You qualify for free shipping!",
  "progressBarAriaLabel": "Free shipping progress: {{percent}}% to threshold"
}
```

### `locales/es.json` (full contents)

```json
{
  "progressMessage": "Te faltan {{remaining}} para envío gratis",
  "qualifiedMessage": "{{emoji}} ¡Has obtenido envío gratis!",
  "progressBarAriaLabel": "Progreso de envío gratis: {{percent}}% del umbral"
}
```

### [VERIFY MCP-3] — Currency formatting

The `remaining` value must be formatted respecting the checkout locale and
currency. The expected call is:

```js
// verified MCP-3 + MCP-5: formatCurrency exists; Money.amount is a number (no conversion needed)
function formatRemaining(amountNumber) {
  const currency = shopify.cost.totalAmount.value.currencyCode; // verified MCP-5: Money.currencyCode (CurrencyCode string)
  return shopify.i18n.formatCurrency(amountNumber, { currency }); // verified MCP-3: (number | bigint, Intl.NumberFormatOptions?) => string
}
```

### MCP-3 resolved — currency formatting call signature

Confirmed from `standard.d.ts` (lines 284–287):

```typescript
formatCurrency: (number: number | bigint, options?: {
    inExtensionLocale?: boolean;
} & Intl.NumberFormatOptions) => string;
```

- Method name: `shopify.i18n.formatCurrency` — confirmed (not `formatNumber`, not `currency`).
- `amount` argument: `number | bigint`. `Money.amount` is already a `number` (MCP-5), so no `Number()` conversion is needed in `formatRemaining`.
- `currency` option comes from `Intl.NumberFormatOptions.currency` (ISO 4217 string from `Money.currencyCode`).
- Note: the MCP best-practices guide mentioned `formatNumber()` for "currency formatting" — that is generic advice. The dedicated `formatCurrency` method (which sets `style: 'currency'` internally) is the correct choice here.

### Blank `qualified_emoji` / leading-space handling

`qualifiedMessage` is `"{{emoji}} You qualify..."` with a literal space after the
interpolation. If the merchant leaves `qualified_emoji` blank, the rendered string
would start with a leading space (`" You qualify..."`). Mitigation in code:

```js
const rawEmoji = settings.qualified_emoji;
const emoji = (typeof rawEmoji === "string" && rawEmoji.trim() !== "")
  ? rawEmoji.trim()
  : "🎉";
```

Because the default `🎉` is always substituted when blank/whitespace, the leading
space never appears in normal operation. (Do not strip the space from the
translation template itself — Spanish and future locales rely on it.)

---

## 9. Merchant settings usage

| Setting key | Type | Drives | Code default (applied in `resolveState`, not TOML) |
| :--- | :--- | :--- | :--- |
| `use_shopify_free_shipping_rate` | `boolean` | Selects qualification mode (auto-detect vs manual). | `true` — treat unset as `true` (`=== true` would make unset `false`; instead use `settings.use_shopify_free_shipping_rate !== false` so unset/`true` → auto-detect, only explicit `false` → manual). |
| `manual_threshold` | `number_decimal` | Progress-bar fill target in both modes; qualified detection in manual mode. | None — if unset/invalid → `console.warn` + render nothing (Section 6 Step 1). |
| `progress_bar_tone` | `single_line_text_field` (verified MCP-1: `choice` not supported at 2026-04) | `s-progress` `tone` attribute. Note: `s-progress` only accepts `'auto'` \| `'critical'` (MCP-2); `ALLOWED_TONES` and fallback updated accordingly. | `auto` (via `resolveTone`). |
| `qualified_emoji` | `single_line_text_field` | Emoji in `qualifiedMessage`. | `🎉` (when blank/whitespace/non-string). |

> Default-handling subtlety for the boolean: the brief default is `true`. Since
> TOML cannot set defaults, an unconfigured boolean may arrive as `undefined`.
> Use `settings.use_shopify_free_shipping_rate !== false` so the auto-detect
> default is `true` and only an explicit merchant "off" switches to manual mode.
>
> Always guard the settings read: `const settings = shopify.settings.value ?? {}`.
> The signal may be `undefined` for a brief window before the settings object
> hydrates; without the guard, any property access on `undefined` throws and the
> extension crashes.

---

## 10. Signal inventory

All accessors are reactive Preact signals read via `.value` inside `Extension`'s
render, which is what makes the component update reactively.

| Accessor | Why |
| :--- | :--- |
| `shopify.cartLines.value` | Detect empty cart (State 1); presence of items gates rendering. |
| `shopify.cost.totalAmount.value` | Current cart total (post-discount) for manual-mode qualification and progress fill. Verified MCP-5: `shopify.cost` is `CartCost` (plain object); `CartCost.totalAmount` is `SubscribableSignalLike<Money>`; access via `shopify.cost.totalAmount.value`. `Money = { amount: number, currencyCode: CurrencyCode }` — `amount` is a JS number. |
| `shopify.deliveryGroups.value` | Auto-detect mode: scan delivery options for a zero-cost (free) shipping option. |
| `shopify.settings.value` | Read the four merchant settings. Guard with `?? {}` (see Section 9) — the signal may be `undefined` before hydration. |
| `shopify.i18n.translate(...)` | Resolve all user-facing strings. |
| `shopify.i18n.formatCurrency(amount, { currency })` | Format the `remaining` amount in checkout currency/locale. Verified MCP-3: `(number \| bigint, Intl.NumberFormatOptions?) => string`. |
| `shopify.extension` | Not required by feature logic; available if needed for diagnostics only. (Listed for completeness; not used in the render path.) |

The scaffold's `shopify.instructions.value.metafields.canSetCartMetafields` check
and `shopify.appMetafields.value` access are **removed** — the feature does not use
metafields.

### MCP-5 resolved — `shopify.cost.totalAmount` shape

Confirmed from `standard.d.ts` (lines 847–864 for `CartCost`, lines 963–974 for `Money`):

```typescript
// CartCost (plain object on shopify.cost — NOT a signal itself):
interface CartCost {
  totalAmount: SubscribableSignalLike<Money>;
  // ... subtotalAmount, totalShippingAmount, totalTaxAmount
}

// Money:
interface Money {
  amount: number;          // JS number, e.g. 29.99 — NOT a string
  currencyCode: CurrencyCode;  // e.g. 'CAD', 'USD'
}
```

**Two corrections from the original plan assumptions:**
1. Access path: `shopify.cost.totalAmount.value.amount` — NOT `shopify.cost.value.totalAmount.amount`. `shopify.cost` is a plain `CartCost` object; `totalAmount` is the signal within it.
2. `amount` is a **number**, not a string. `toPositiveNumber` still handles it correctly (the `typeof value === "number"` branch), but no `Number()` cast is needed.

---

## 11. Build & verification

### Build

```bash
cd ~/Projects/Shopify/checkout-extensions
shopify app build
```

> **Note — entry file is `.jsx`, not `.tsx`:** The extension entry module is
> `src/Checkout.jsx`. There is no TypeScript compilation step (`tsc`) separate from
> the Shopify CLI build. `shopify app build` is the single gate for type checking,
> sandbox compliance, and bundle-size validation. Do not add or run a standalone
> `tsc` step.

Must complete with no errors; the `free-shipping-progress` bundle must report a
size well under the ~100KB compressed budget (target <50KB — Section 12).

### Functional verification (carried from the brief summary; run via `shopify app dev` + Playwright against `theme-evolution-os2.myshopify.com`)

1. **Empty cart** → extension renders nothing.
2. **Toggle ON, no zero-cost option** (manual_threshold 50.00, $20 cart, address
   filled) → bar ~40%, message "$30.00 away from free shipping".
3. **Toggle ON, zero-cost option appears** (cart pushed over the store's free-ship
   rule) → qualified message, no bar.
4. **Toggle OFF, below threshold** (threshold 100.00, $20 cart) → bar ~20%,
   message "$80.00 away from free shipping".
5. **Toggle OFF, at threshold** → qualified message.
6. **Toggle OFF, above threshold** → qualified message.
7. **Reactive discount update** → applying/removing a discount moves the bar
   down/up without reload.
8. **Tone customization** → in the checkout editor, switch `progress_bar_tone`
   between `auto` and `critical`; confirm the bar fill styling shifts accordingly
   (auto adapts to the checkout theme; critical renders the error/red treatment).
   Enter an invalid value (e.g. `success`) and confirm the runtime `resolveTone`
   fallback silently substitutes `auto` with no JS errors or Polaris validation
   warnings in the console.
9. **Locale switching** → Spanish checkout shows Spanish strings.
10. **Mobile viewport (375px)** → no overflow.
11. **Console** → no JS errors, no Preact warnings, no Polaris component validation
    errors. Misconfig (threshold unset) emits exactly one
    `[free-shipping-progress]` warning and renders nothing.

### Behavioral edges (QA awareness — correct per spec, not bugs)

The following behaviors are **correct per the feature brief** and should be
explicitly verified by QA as designed, not flagged as defects:

**$0 cart total (fully discounted, non-empty cart):** A cart with one or more line
items whose total has been fully discounted to $0.00 renders **State 2 (below
threshold) at 0% fill**, NOT State 3 (qualified) and NOT State 1 (empty). State 1
is triggered by `cartLines.length === 0` only; State 3 requires either a zero-cost
delivery option (auto-detect) or `total >= threshold` (manual). A $0 total
satisfies neither when `threshold > 0`.

**Auto-detect qualifies on option availability, not selection:** In auto-detect
mode, the extension treats the **existence** of any zero-cost delivery option in
`deliveryGroups` as the qualified signal — even if the customer currently has a
paid option selected. Qualification responds to what is *available*, not what is
*chosen*. This is intentional: the goal is to communicate eligibility ("you CAN
get free shipping"), not the current selection.

---

## 12. Performance note

Target <50KB compressed is achievable:

- Zero new dependencies. The extension imports only `@shopify/ui-extensions/preact`
  and `preact` (already in `package.json`); Polaris `s-*` components are provided by
  the runtime and are not bundled.
- All logic is small inline pure functions (`toPositiveNumber`, `clamp`,
  `resolveTone`, `isZeroCost`, `resolveState`, `formatRemaining`) — no utility
  libraries.
- Three locale JSON files are tiny (three keys each; `fr.json` deleted reduces
  bundle slightly vs the scaffold).
- No images, no fonts, no animation libraries.

Run `shopify app build` and record the reported bundle size in the impl notes.

---

## 13. Implementation checklist (for the Coder)

> MCP-1 through MCP-5 are **pre-resolved** in the plan — do not repeat MCP research.
> All `[VERIFY MCP-N]` tags have been replaced with confirmed values. The Coder
> should read the resolved sections before writing code; do **not** re-verify
> items that are already locked. Still call `learn_shopify_api` once at session
> start (CLAUDE.md requirement), then proceed directly to implementation.

1. **MCP grounding.** Call `learn_shopify_api` (`polaris-checkout-extensions`, `2026-04`) once at session start. All five MCP items are already resolved in this plan:
   - MCP-1: `choice` not supported → `single_line_text_field` for `progress_bar_tone`.
   - MCP-2: `tone` is `'auto' | 'critical'`; `accessibilityLabel` attribute; value/max are arbitrary floats.
   - MCP-3: `shopify.i18n.formatCurrency(number | bigint, Intl.NumberFormatOptions?) => string`.
   - MCP-4: `group.deliveryOptions`; `option.cost?.amount === 0` (number); PickupLocationOption has no cost.
   - MCP-5: `shopify.cost.totalAmount.value.amount` (number); `shopify.cost.totalAmount.value.currencyCode`.
2. **Settings TOML.** Edit `shopify.extension.toml`: add `[extensions.settings]`
   with the four fields (Section 5), using the MCP-confirmed `progress_bar_tone`
   Use `single_line_text_field` for `progress_bar_tone` (MCP-1 resolved). Remove the scaffolded `[[extensions.metafields]] requestedFreeGift`
   block. Leave `api_version`, targeting, and `api_access` unchanged.
   Run `shopify app build`.
3. **Locales.** Rewrite `locales/en.default.json` (Section 8 English), create
   `locales/es.json` (Section 8 Spanish), delete `locales/fr.json`.
   Run `shopify app build`.
4. **Pure helpers.** In `src/Checkout.jsx`, add `toPositiveNumber`, `clamp`,
   `ALLOWED_TONES`, `resolveTone`, and `isZeroCost` (with the MCP-confirmed cost
   path) as inline pure functions.
5. **State resolver.** Implement `resolveState()` returning the tagged union
   (`empty | qualified | below`) per the Section 6 decision tree, including the
   settings null guard (`shopify.settings.value ?? {}`), the boolean-default
   subtlety (`!== false`), the misconfig `console.warn`, the empty-`deliveryGroups`
   handling, and the `percent` clamp to 0–99.
6. **Currency formatter.** Implement `formatRemaining` using the MCP-confirmed
   `shopify.i18n.formatCurrency` signature and the confirmed `currencyCode` path.
7. **Component render.** Rewrite `Extension` to call `resolveState()` and switch on
   `kind`: `null` for empty; `s-stack` + `s-text` + `s-progress` (with confirmed
   `tone`/value/`aria-label` attributes) for below; `s-text` for qualified. Keep
   the entry export shape (`render(<Extension />, document.body)`). Remove all
   scaffolded metafield/instruction/checkbox code.
8. **Pre-save audit (CLAUDE.md §9).** Confirm: only `s-*` components in JSX; all
   data via `shopify.*.value`; all strings via `shopify.i18n.translate`; imports
   only from `preact` / `@shopify/ui-extensions/preact`; no `react`, no browser
   APIs, no mutations; no unused imports. Run `shopify app build` and record the
   bundle size.
9. **Impl notes.** Write `docs/plans/free-shipping-progress-impl-notes.md`
   documenting the MCP-confirmed answers for MCP-1..5, the final
   `progress_bar_tone` field type chosen, the recorded bundle size, and any place
   where the live API differed from this plan's assumptions.
10. **Commit.** `feat(free-shipping-progress): free-shipping progress bar with
    auto-detect/manual modes and en/es locales`.
```

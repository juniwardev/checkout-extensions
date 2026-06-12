# Implementation Notes: `free-shipping-progress`

**Slug:** `free-shipping-progress`
**Coder:** Junior Warner
**Date:** 2026-06-11
**Plan:** `docs/plans/free-shipping-progress.md`
**Review:** `docs/reviews/free-shipping-progress-review.md` (APPROVE, Pass 5)
**Base branch / commit:** main (commit `c82dee0` — "review(free-shipping-progress): Plan-Reviewer pass + plan update to address findings")

---

## Files changed

| File | Action | Reason |
| :--- | :--- | :--- |
| `extensions/free-shipping-progress/src/Checkout.jsx` | Rewrite | Replace scaffolded metafield demo with the free-shipping progress bar (pure helpers, `resolveState`, `Extension` component). |
| `extensions/free-shipping-progress/shopify.extension.toml` | Edit | Remove `[[extensions.metafields]]` block for `requestedFreeGift`; add `[extensions.settings]` with four fields as specified in plan §5. |
| `extensions/free-shipping-progress/locales/en.default.json` | Rewrite | Replace scaffolded keys with three translation keys from plan §8. |
| `extensions/free-shipping-progress/locales/es.json` | Create | Spanish translations from plan §8. |
| `extensions/free-shipping-progress/locales/fr.json` | Delete | Out of scope for v1 per plan §4. |

No app-level files (`shopify.app.toml`, root `package.json`, `.shopify/`, `.github/`) were modified.

---

## Commands to run the feature locally

```bash
cd ~/Projects/Shopify/checkout-extensions
shopify app dev
```

The dev server starts a Cloudflare tunnel, bundles all extensions, and connects the app to `theme-evolution-os2.myshopify.com`. The extension hot-reloads on save. Follow the QA checklist in plan §11 for functional verification.

To verify the build only (no dev tunnel):

```bash
cd ~/Projects/Shopify/checkout-extensions
shopify app build
```

---

## MCP-confirmed answers for MCP-1..5

These were resolved in the plan by the Architect + independently verified across three Plan-Reviewer passes against the installed `@shopify/ui-extensions@2026.4.0` type definitions. The Shopify Dev MCP was not registered in the Coder's environment (the CLAUDE.md directive is conditional: "IF the Shopify Dev MCP is registered"), so verification here is against the plan's confirmed values and the on-disk types.

| Item | Resolved value | Source |
| :--- | :--- | :--- |
| MCP-1: `choice` field type | NOT supported at `2026-04`. Used `single_line_text_field` for `progress_bar_tone`. | `search_docs_chunks` (Architect) + on-disk types (Plan-Reviewer Pass 4). |
| MCP-2: `s-progress` attributes | `tone` accepts `'auto' \| 'critical'` only. Accessibility attribute is `accessibilityLabel` (camelCase). `value`/`max` are arbitrary positive floats; `max` defaults to 1. | MCP docs + `standard.d.ts` confirmed by Plan-Reviewer. |
| MCP-3: Currency formatter | `shopify.i18n.formatCurrency(number \| bigint, Intl.NumberFormatOptions?) => string`. Method is `formatCurrency`, not `formatNumber`. | `standard.d.ts:285` confirmed by Plan-Reviewer Pass 4. |
| MCP-4: Delivery option cost path | Property is `deliveryOptions` (not `options`) on `DeliveryGroup`. Test `(option.costAfterDiscounts ?? option.cost)?.amount === 0` — `costAfterDiscounts` is the buyer-paid price after shipping discounts; `cost` is the pre-discount carrier price. `PickupLocationOption` has neither field — optional chain required. `amount` is a JS number. | `standard.d.ts:1463, 1557–1564, 1611` confirmed by Plan-Reviewer Pass 4 + Pass 5. |
| MCP-5: `shopify.cost.totalAmount` shape | `shopify.cost` is a plain `CartCost` object (NOT a signal). `CartCost.totalAmount` is `SubscribableSignalLike<Money>`. Access: `shopify.cost.totalAmount.value.amount` (number) and `.currencyCode` (string). | `standard.d.ts:549, 863, 967, 973` confirmed by Plan-Reviewer Pass 4 + Pass 5. |

---

## Final `progress_bar_tone` field type chosen

`single_line_text_field` — because `type = "choice"` is not supported at `api_version = "2026-04"` (MCP-1). Runtime code validates the value against `["auto", "critical"]` via `resolveTone()`; any invalid merchant input falls back silently to `"auto"`. The merchant can meaningfully choose between the neutral/adaptive look (`auto`) and the error-red/urgency treatment (`critical`).

---

## Recorded bundle size

`shopify app build` output:

```
free-shipping-progress successfully built in 293ms
(22.3 KB original, ~8.7 KB compressed)
```

8.7 KB compressed — well within the ~100 KB platform budget and under the plan's <50 KB target from §12. Zero new dependencies were added; all logic is inline pure functions; Polaris `s-*` components are runtime-provided and not bundled.

---

## Deviations from the plan

None. The implementation follows the plan exactly:

- `resolveState()` implements the §6 decision tree with all guards:
  - STEP 0: empty cart short-circuit.
  - STEP 1: manual-mode-only misconfig `console.warn` (fires only when `effectiveThreshold === null`).
  - STEP 2: auto-detect (zero-cost delivery option scan) vs manual (total vs threshold) qualification.
  - STEP 3: qualified short-circuit; auto-detect dead-end suppression guard scoped to `groups.length > 0` (Finding B); no-fill-target guard for `effectiveThreshold === 0` (Finding A).
- `effectiveThreshold = autoDetect ? (rawThreshold ?? 0) : rawThreshold` (Finding A, Pass 3).
- `autoDetect = settings.use_shopify_free_shipping_rate !== false` (boolean-default subtlety from §9).
- `isZeroCost` tests `(option.costAfterDiscounts ?? option.cost)?.amount === 0` (Pass 4 finding).
- `resolveEmoji` is used as the single authoritative defaulting function (no weaker inline form).
- Entry shape preserved: `import '@shopify/ui-extensions/preact'`, `import {render} from "preact"`, `export default async () => { render(<Extension />, document.body) }`.
- File is `.jsx` (not renamed to `.tsx`) per plan §4.

---

## Out-of-scope observations

- The `app-tools` and `app-home` extensions bundled alongside `free-shipping-progress` are scaffolded demos. They are out of scope for this plan and were not modified.
- `costAfterDiscounts` is typed as non-optional `Money` on `ShippingOption` and `PickupPointOption` in the `2026.4.0` types (Plan-Reviewer Pass 5, §3 minor nit). This means the `?? option.cost` fallback in `isZeroCost` is defensive-only — for any option type that has a cost field at all, `costAfterDiscounts` will be present. The predicate is still correct and more robust than the alternative; the fallback is harmless. No code change warranted.

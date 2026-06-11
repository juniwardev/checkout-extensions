# Feature Brief: Free-Shipping Progress Bar

**Slug:** `free-shipping-progress`
**Extension:** `extensions/free-shipping-progress/` (already scaffolded)
**Extension type:** Checkout UI Extension (Polaris web components + Preact, `api_version = "2026-04"`)
**Extension target:** `purchase.checkout.block.render` (generic block, merchant places via checkout editor)

> **Revision note:** This brief was revised after initial Architect investigation surfaced two facts that changed the design: (1) the 2026-04 Shopify Checkout UI Extensions API uses Preact + Polaris web components (`s-*` elements + a global `shopify` signals object), NOT React + hooks; and (2) the Checkout API does not expose the merchant's free-shipping threshold value directly. The brief below reflects the actual platform constraints.

---

## Summary

A progress bar component that renders inside the Shopify checkout and shows the customer how close they are to qualifying for free shipping. Updates reactively as the customer adds, removes, or modifies items in their cart, and as discount codes are applied or removed.

The merchant can toggle whether the extension auto-detects the "qualified for free shipping" state from currently-available delivery options, or relies entirely on a manual threshold value. In both modes, the manual threshold drives the progress bar's visual fill calculation, because no Checkout API surface exposes the merchant's threshold rule directly.

---

## Stack constraints

This extension runs in the Shopify Checkout UI Extension sandboxed runtime, `api_version = "2026-04"`. Specific implementation rules:

- **UI primitives:** Use Polaris web components from the Shopify checkout component set: `s-progress`, `s-box`, `s-text`, `s-heading`, `s-stack`, `s-banner`, etc. Do NOT use React-style components (`<BlockStack>`, `<Text>`) — those are from an older API version not used here.
- **Rendering:** Components are rendered via Preact, not React. Standard React patterns (hooks like `useState`) are NOT available. Use Preact equivalents and the `shopify` global signals object for reactive state.
- **Data access:** Use the global `shopify` signals object to access cart and checkout state reactively. Common accessors at `purchase.checkout.block.render` target include `shopify.cartLines`, `shopify.cost.totalAmount`, `shopify.shippingAddress`, `shopify.deliveryGroups`. (Architect to verify exact surface against Shopify Dev MCP.)
- **No browser APIs:** No DOM access, no `window`, no `document`, no `localStorage`, no direct `fetch` to arbitrary URLs.
- **Imports:** Only from Shopify-provided packages and the extension's own `src/` and `locales/`.

---

## Behavior

Three display states based on cart contents and qualification status:

### State 1 — Empty cart

If the cart has zero items (`shopify.cartLines` is empty), the extension renders nothing. No banner, no progress bar, no placeholder.

### State 2 — Below threshold (not qualified)

If the cart is not yet qualified for free shipping (see threshold logic below):

- Display a message: "{{remaining}} away from free shipping" where `{{remaining}}` is the formatted difference between the manual threshold and the current cart total in the active currency.
- Display an `s-progress` component filled from 0% to 99% representing the percentage of the threshold reached.
- The progress bar tone (color) comes from the `progress_bar_tone` setting (see Settings below).

### State 3 — Qualified (toggle-mode-dependent)

If the cart meets the qualification criteria:

- Display a congratulatory message: "{{emoji}} You qualify for free shipping!" where `{{emoji}}` is the configured emoji.
- No progress bar in this state.

---

## Threshold source — merchant-configurable toggle

The merchant chooses qualification detection mode via a boolean setting:

### Option A — Auto-detect from delivery options (toggle enabled, recommended default)

When `use_shopify_free_shipping_rate` is `true`:

- The extension watches `shopify.deliveryGroups` for any delivery option with a zero cost (free shipping currently available to this customer).
- If a zero-cost option exists → render State 3 (qualified).
- If no zero-cost option exists → render State 2 (below threshold), with the progress bar calculated against `manual_threshold`.

This mode respects merchant-configured shipping rules dynamically — if a customer's cart meets ANY free-shipping condition (subtotal threshold, weight threshold, location-based, etc.), the qualified state shows. But because the API doesn't expose the actual threshold value, the progress bar still uses `manual_threshold` as the visual target.

### Option B — Use manual threshold only (toggle disabled)

When `use_shopify_free_shipping_rate` is `false`:

- The extension compares `shopify.cost.totalAmount.amount` against `manual_threshold`.
- If `totalAmount >= manual_threshold` → render State 3 (qualified).
- Otherwise → render State 2 with progress calculated against `manual_threshold`.

This mode is simpler and entirely under merchant control — useful when the merchant wants a specific spending threshold messaging that doesn't depend on the actual shipping configuration.

### Edge case — toggle ON but no delivery groups available yet

Early in checkout, before the shipping address is filled in, `shopify.deliveryGroups` may be empty. Treat this as "not yet qualified" and render State 2.

### Edge case — toggle ON, delivery groups exist, all are zero-cost

Render State 3 (qualified). All customers see free shipping available.

---

## Settings schema (shopify.extension.toml)

Four merchant-configurable settings:

| Setting key | Type | Name | Description | Default |
| :--- | :--- | :--- | :--- | :--- |
| `use_shopify_free_shipping_rate` | `boolean` | Auto-detect free shipping from delivery options | When enabled, detect qualified state from currently-available zero-cost delivery options. When disabled, use the manual threshold below. | `true` |
| `manual_threshold` | `number_decimal` | Manual free shipping threshold | The cart total at which free shipping applies (used for progress bar visualization in both modes; used for qualified-state detection when auto-detect is disabled). | `75.00` |
| `progress_bar_tone` | `single_line_text_field` | Progress bar tone | Semantic tone for the progress bar fill. Allowed values: `primary`, `success`, `warning`, `critical`, `neutral`. Defaults to `primary`. | `primary` |
| `qualified_emoji` | `single_line_text_field` | Qualified state emoji | Emoji shown next to the "You qualify for free shipping" message. | `🎉` |

The Coder must validate `progress_bar_tone` at runtime against the allowed set and fall back to `primary` if the merchant enters something invalid.

If `choice` is a supported setting type in `api_version = "2026-04"`, prefer it over `single_line_text_field` for `progress_bar_tone` so the merchant gets a dropdown instead of free-text. Architect to verify.

---

## Internationalization

User-facing strings must use the localization API with translation keys defined in the extension's `locales/` directory. Two locales required for v1:

- `locales/en.default.json` — English (default)
- `locales/es.json` — Spanish

The scaffolded `fr.json` is OUT OF SCOPE for v1 and should be deleted.

### Translation keys

```json
{
  "progressMessage": "{{remaining}} away from free shipping",
  "qualifiedMessage": "{{emoji}} You qualify for free shipping!",
  "progressBarAriaLabel": "Free shipping progress: {{percent}}% to threshold"
}
```

Spanish translations should be natural and culturally appropriate, not literal. Reasonable phrasings:

- `progressMessage`: "Te faltan {{remaining}} para envío gratis"
- `qualifiedMessage`: "{{emoji}} ¡Has obtenido envío gratis!"
- `progressBarAriaLabel`: "Progreso de envío gratis: {{percent}}% del umbral"

The Architect or Coder should verify against the Polaris web components localization API (likely `shopify.i18n.translate()` or similar) for the exact invocation syntax.

---

## Files affected

| File | Action |
| :--- | :--- |
| `extensions/free-shipping-progress/src/Checkout.tsx` (or scaffolded equivalent) | Implement the component |
| `extensions/free-shipping-progress/shopify.extension.toml` | Add the four settings under `[[extensions.settings.fields]]` |
| `extensions/free-shipping-progress/locales/en.default.json` | Add English translation keys |
| `extensions/free-shipping-progress/locales/es.json` | Add Spanish translations |
| `extensions/free-shipping-progress/locales/fr.json` | Delete (out of scope for v1) |

No other extensions or app-level files should be modified.

---

## Verification

### Build verification

`shopify app build` completes without errors. Bundle size for the `free-shipping-progress` extension stays under 100KB compressed (target: <50KB for this simple extension).

### Browser-based functional verification (via Playwright through the dev tunnel)

1. **Empty cart:** Open checkout with no items. Confirm the extension renders nothing.
2. **Toggle ON, no zero-cost delivery option:**
   - Configure the dev store with a free shipping rate threshold (e.g., free shipping over $50) but ensure the cart is under that threshold.
   - Enable `use_shopify_free_shipping_rate` in the checkout editor.
   - Set `manual_threshold` to `50.00`.
   - Add a $20 product to cart.
   - Open checkout, fill shipping address to populate delivery groups.
   - Confirm: progress bar shows ~40% filled, message reads "$30.00 away from free shipping" (or localized equivalent).
3. **Toggle ON, zero-cost delivery option appears:**
   - Same setup as #2, but add enough product to push cart total over $50.
   - Confirm: qualified message renders ("🎉 You qualify for free shipping!") with no progress bar.
4. **Toggle OFF (manual mode), below threshold:**
   - Disable `use_shopify_free_shipping_rate`.
   - Set `manual_threshold` to `100.00`.
   - Add a $20 product to cart.
   - Confirm: progress bar shows ~20% filled, message reads "$80.00 away from free shipping".
5. **Toggle OFF, at threshold:** Add items totaling exactly the threshold. Confirm qualified message renders.
6. **Toggle OFF, above threshold:** Add items over threshold. Confirm qualified message renders.
7. **Reactive update with discount code:** Start in below-threshold state. Apply a discount code that pushes the total below the previous level. Confirm progress bar updates downward reactively. Remove discount, confirm bar returns.
8. **Tone customization:** Change `progress_bar_tone` in the editor to each of the allowed values (`primary`, `success`, `warning`, `critical`, `neutral`). Confirm the progress bar fill color updates correspondingly.
9. **Locale switching:** With browser/checkout locale set to Spanish, confirm all extension strings render in Spanish.
10. **Mobile viewport:** Resize browser to 375px width. Confirm bar and message render correctly without overflow.

### Console verification

No JavaScript errors. No Preact warnings. No Polaris web component validation errors.

---

## Out of scope (explicitly excluded from this build)

- Customer-facing customization of message text beyond translations.
- Multiple progressive thresholds (free shipping at $50, free gift at $100, etc.).
- Animation or transitions on the progress bar fill changes.
- Persistence of any state across sessions.
- Integration with marketing tools (Klaviyo, Attentive) or analytics events.
- A dismiss button or "remind me later" UX.
- Additional locales beyond English and Spanish (French, German, etc., are deferred).
- Reading the merchant's actual free-shipping threshold value (not exposed by the Checkout API; if Shopify adds this surface in a future API version, a follow-up plan can switch to it).

---

## Definition of done

Feature is complete when:

- All four merchant settings are configurable in the checkout editor.
- All three behavior states render correctly in both toggle modes.
- All verification scenarios above pass.
- English and Spanish translations work and switch correctly based on locale.
- French locale is removed.
- Bundle size is within target.
- No console errors during normal operation.
- The feature is signed off by the operator (touch `docs/qa/free-shipping-progress.approved`).
- Audit trail (plan, reviews, impl-notes, QA report) is committed to git.

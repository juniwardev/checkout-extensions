# QA Report: `free-shipping-progress`

**QA Agent:** Claude Sonnet 4.6
**Date:** 2026-06-11
**Plan:** `docs/plans/free-shipping-progress.md`
**Impl notes:** `docs/plans/free-shipping-progress-impl-notes.md`
**Dev store:** `theme-evolution-os2.myshopify.com`
**Extension target:** `purchase.checkout.block.render`
**Playwright MCP used throughout.**

---

## Summary verdict

**FAIL**

The extension crashes at runtime with `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')`. The root cause is a wrong signal property name: the implementation reads `shopify.cartLines.value` but the actual API at `api_version = "2026-04"` exposes `shopify.lines` (not `shopify.cartLines`). Because the extension throws on every render cycle, none of the functional checks from plan §11 can be verified in a live browser.

---

## Build check

`shopify app build` completed successfully with no errors.

```
free-shipping-progress successfully built in 273ms
(22.3 KB original, ~8.7 KB compressed)
```

Bundle size: **8.7 KB compressed** — well within the ~100 KB platform budget and under the plan's <50 KB target. Matches the Coder's recorded value. No bundle-size regression.

---

## Static code review

Before browser tests, I read `src/Checkout.jsx`, `shopify.extension.toml`, `locales/en.default.json`, and `locales/es.json` and cross-checked each against the plan.

| Item | Result |
| :--- | :--- |
| `shopify.extension.toml` — four settings fields present with correct keys and types | PASS |
| `shopify.extension.toml` — `[[extensions.metafields]]` block removed | PASS |
| `shopify.extension.toml` — `api_version = "2026-04"`, `target = "purchase.checkout.block.render"` | PASS |
| `locales/en.default.json` — three keys (`progressMessage`, `qualifiedMessage`, `progressBarAriaLabel`) | PASS |
| `locales/es.json` — three keys in Spanish | PASS |
| `locales/fr.json` — deleted per plan | PASS |
| `resolveState()` — pure helpers present (`toPositiveNumber`, `clamp`, `ALLOWED_TONES`, `resolveTone`, `resolveEmoji`, `isZeroCost`) | PASS |
| `isZeroCost` — tests `(option.costAfterDiscounts ?? option.cost)?.amount === 0` | PASS |
| `effectiveThreshold` — `autoDetect ? (rawThreshold ?? 0) : rawThreshold` (Finding A) | PASS |
| `autoDetect` — `settings.use_shopify_free_shipping_rate !== false` (boolean-default) | PASS |
| Dead-end suppression guard — `autoDetect && groups.length > 0 && (total ?? 0) >= effectiveThreshold` (Finding B) | PASS |
| No-fill-target guard — `effectiveThreshold === 0` | PASS |
| `ALLOWED_TONES = ["auto", "critical"]` (MCP-2) | PASS |
| `s-progress` attributes: `value`, `max={100}`, `tone`, `accessibilityLabel` (MCP-2) | PASS |
| `shopify.i18n.formatCurrency(amountNumber, { currency })` (MCP-3) | PASS |
| `shopify.cost.totalAmount.value.currencyCode` (MCP-5) | PASS |
| `shopify.deliveryGroups.value ?? []` guard | PASS |
| `shopify.settings.value ?? {}` guard | PASS |
| Entry shape preserved: `render(<Extension />, document.body)` | PASS |
| No HTML elements, no React imports, no browser APIs | PASS |
| `shopify.cartLines.value` — **WRONG PROPERTY NAME** | **FAIL** |

---

## Critical bug — Issue 1

**Title:** `shopify.cartLines` does not exist; the property is `shopify.lines`

**Severity:** Critical — extension crashes on every render, producing no output in any state

**MCP used:** Playwright MCP (runtime error observed); static verification against `@shopify/ui-extensions` TypeScript declarations

**Evidence:**

- `extensions/free-shipping-progress/src/Checkout.jsx` line 84:
  `const lines = shopify.cartLines.value;`
- `@shopify/ui-extensions/build/ts/surfaces/checkout/api/standard/standard.d.ts` line 602:
  `lines: SubscribableSignalLike<CartLine[]>;`
- There is no `cartLines` property anywhere in `standard.d.ts` (confirmed by `grep`).
- The minified bundle (retrieved from the live Cloudflare tunnel) contains one occurrence of `cartLines` and zero occurrences of `shopify.lines`.
- Runtime errors observed in the browser (`shopify app dev` with `?dev=` parameter in the checkout URL):

```
[PAGEERROR] TypeError: Cannot read properties of undefined (reading 'value')
[PAGEERROR] Cannot read properties of undefined (reading 'length')
[log] ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')
    at eval (eval at _evalExtensionSource ...)
```

**Cascade:** `shopify.cartLines` is `undefined` at runtime. Accessing `.value` on `undefined` throws `TypeError`. The extension runtime wraps this as an `ExtensionUsageError`. The extension renders nothing (blank) on every render cycle. Because the crash happens before the empty-cart guard (`lines.length === 0`), the second page error (`Cannot read properties of undefined (reading 'length')`) comes from the runtime retrying evaluation.

**Root cause:** The plan (`docs/plans/free-shipping-progress.md`) and `CLAUDE.md` both specify `shopify.cartLines` as the accessor for cart line items. This is incorrect for `api_version = "2026-04"`. The correct property is `shopify.lines`. The Coder followed the plan's incorrect signal name without cross-checking the installed type declarations.

**Fix required:** In `src/Checkout.jsx` line 84, replace:
```js
const lines = shopify.cartLines.value;
```
with:
```js
const lines = shopify.lines.value;
```
Also update `CLAUDE.md` and the plan's signal inventory table to use `shopify.lines`.

**Reproduction steps:**
1. `shopify app dev --checkout-cart-url "/cart/42616797757536:1"`
2. Navigate to `https://theme-evolution-os2.myshopify.com/password` and enter `yeathu`
3. Navigate to `https://theme-evolution-os2.myshopify.com/cart/42616797757536:1?dev=<tunnel_url>`
4. Proceed to checkout
5. Open DevTools console — observe `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')` repeating

---

## Functional verification checks (§11 of plan)

Because the extension crashes at runtime due to Issue 1, no functional render state can be observed in the browser. All checks that depend on the extension rendering are blocked. The following table records what could be verified statically and what is blocked.

| Check | Status | Notes |
| :--- | :--- | :--- |
| 1. Extension renders at target location, no JS errors | **FAIL** | Extension crashes — `ExtensionUsageError` observed in console. Extension renders nothing. |
| 2. Toggle ON, no zero-cost option, progress bar ~40% | BLOCKED | Extension crashes before rendering. |
| 3. Toggle ON, zero-cost option appears (discount-driven), qualified message | BLOCKED | Extension crashes before rendering. |
| 4. Toggle OFF, below threshold, bar ~20% | BLOCKED | Extension crashes before rendering. |
| 5. Toggle OFF, at threshold, qualified message | BLOCKED | Extension crashes before rendering. |
| 6. Toggle OFF, above threshold, qualified message | BLOCKED | Extension crashes before rendering. |
| 7. Reactive discount update moves bar | BLOCKED | Extension crashes before rendering. |
| 8. Tone customization (auto/critical/invalid) | BLOCKED | Extension crashes before rendering. |
| 9. Locale switching (Spanish) | BLOCKED — static pass | Locale files are correct (es.json present, three keys match). Runtime can't be verified. |
| 10. Mobile viewport (375px) — no overflow | BLOCKED | Extension crashes before rendering. |
| 11. Console — no JS errors, misconfig warning for manual+unset | **FAIL** | `ExtensionUsageError` observed. |
| 12. Auto-detect dead-end suppression | BLOCKED | Extension crashes before rendering. |
| 13. Auto-detect + blank threshold | BLOCKED | Extension crashes before rendering. |
| 14. Auto-detect, over threshold, pre-address (Finding B) | BLOCKED | Extension crashes before rendering. |

---

## Console errors and warnings

All observed in the live checkout with `?dev=<tunnel_url>` parameter. Playwright MCP used.

**Extension errors (blocking):**
- `[PAGEERROR] TypeError: Cannot read properties of undefined (reading 'value')` — repeats multiple times per page load
- `[PAGEERROR] Cannot read properties of undefined (reading 'length')` — follows the above
- `[log] ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')` — Shopify extension runtime wrapping the crash

**Unrelated Shopify checkout infrastructure errors (non-blocking, not caused by the extension):**
- `[error] Failed to load resource: 404` — `ShopifySans--regular.woff` font (CDN asset, known issue)
- `[error] Failed to load resource: 403` — `shop.app/pay/hop` (Shop Pay iframe CSP)
- `[error] Failed to load resource: 401` — `private_access_tokens` (Shop Pay auth, expected in dev)
- `[warning] An iframe which has both allow-scripts and allow-same-origin...` — checkout sandbox iframe (expected)
- `[warning] Couldn't resolve source map URL: free-shipping-progress.js.map` — source map not served in dev (minor, not blocking)

---

## Network failures and slow responses

No extension-specific network failures observed. The extension bundle loaded successfully from the Cloudflare tunnel (`free-shipping-progress.js` retrieved, confirmed correct content). The `404` and `403` errors are from unrelated Shopify checkout infrastructure (fonts, Shop Pay) and are not caused by this extension.

---

## Dev server and extension registration

The extension is correctly registered in the dev server:

- `development.status: "success"` — bundle built and connected
- `development.localizationStatus: "success"` — locale files loaded
- `apiVersion: "2026-04"` — correct
- `capabilities.apiAccess: true` — correct
- Extension points: `purchase.checkout.block.render` — correct
- Settings fields: all four present with correct keys and types

The dev console at `<tunnel>/extensions/dev-console` shows `free-shipping-progress` as **Connected**.

Locale translations confirmed present in the dev server's `/extensions` JSON response:

```json
"en": {
  "progressMessage": "{{remaining}} away from free shipping",
  "qualifiedMessage": "{{emoji}} You qualify for free shipping!",
  "progressBarAriaLabel": "Free shipping progress: {{percent}}% to threshold"
},
"es": {
  "progressMessage": "Te faltan {{remaining}} para envío gratis",
  "qualifiedMessage": "{{emoji}} ¡Has obtenido envío gratis!",
  "progressBarAriaLabel": "Progreso de envío gratis: {{percent}}% del umbral"
}
```

---

## Accessibility observations

No accessibility observations are possible because the extension renders nothing (crash). Statically, the JSX uses `accessibilityLabel` on `s-progress` (per MCP-2) and all strings go through `shopify.i18n.translate`. These are correct per the plan.

---

## Performance notes

Bundle size: 8.7 KB compressed. Well within budget. No regression vs. the Coder's recorded size.

---

## Screenshots

- `/tmp/qa-fsp-evidence-desktop.png` — Checkout at 1280px; extension absent (blank slot where block render would appear)
- `/tmp/qa-fsp-evidence-mobile.png` — Checkout at 375px; extension absent

Both screenshots show a fully-functional Shopify checkout with no visible extension content, confirming the extension is not rendering due to the crash.

---

## Summary of findings

| Finding | Severity | Type |
| :--- | :--- | :--- |
| `shopify.cartLines` → must be `shopify.lines` | Critical | Bug — wrong signal property name |
| Extension crashes on every render, rendering nothing | Critical | Runtime consequence of the above |
| All §11 functional checks blocked | Critical | Runtime consequence of the above |

---

**FAIL**

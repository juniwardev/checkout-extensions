# Impl notes: `fix-cartlines-vs-lines-signal-name`

**Coder:** Claude Sonnet 4.6
**Date:** 2026-06-11
**Plan:** `docs/plans/fix-cartlines-vs-lines-signal-name.md`
**Review:** `docs/reviews/fix-cartlines-vs-lines-signal-name-review.md` (APPROVE, Pass 2)
**Commit:** d15838d `fix(free-shipping-progress): use shopify.lines instead of shopify.cartLines (fixes cartlines-vs-lines-signal-name)`
**Base branch/commit before fix:** 90c21dd

---

## Files changed

| File | Reason |
| :--- | :--- |
| `extensions/free-shipping-progress/src/Checkout.jsx` line 84 | Renamed `shopify.cartLines.value` to `shopify.lines.value` — the only correct accessor for cart line items at `api_version = "2026-04"`. |

No other files were changed. All items on the §6 out-of-scope list were left untouched.

---

## Build result

`shopify app build` completed cleanly with no errors or warnings:

```
free-shipping-progress successfully built in 266ms
(22.2 KB original, ~8.7 KB compressed)
```

Bundle size: **8.7 KB compressed** — identical to the QA-recorded baseline. No regression.

---

## Grep confirmation

```
grep -r "cartLines" extensions/free-shipping-progress/src/
# → No cartLines references found
```

Zero remaining `cartLines` references in extension source. `shopify.lines.value` is confirmed at line 84.

---

## Runtime confirmation

The plan's §4 step 3 and §7 step 5 require starting `shopify app dev` and confirming the extension renders in a live checkout with the two documented console errors absent. This runtime step requires an interactive dev server and a live browser session against `theme-evolution-os2.myshopify.com` — it cannot be scripted headlessly from this agent session.

**Status: deferred to QA.**

This is consistent with the plan's §4 (final paragraph): "Full functional re-verification of all §11 plan checks (previously blocked by the crash) is QA's responsibility and will be covered in the follow-up `/qa` run, not here." The Coder's part of the runtime step (confirming no console errors) is the pass criterion QA must verify in the follow-up `/qa` run using the procedure in `docs/dev-fixtures.md`.

The QA pass criterion (from §4 step 3 of the plan) is:
- The extension renders one of its three states (below-threshold, qualified, or empty/suppressed) in a live checkout with a product in cart.
- The browser console is free of `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')` and `Cannot read properties of undefined (reading 'length')`.

---

## Commands to run the feature locally

```bash
# From repo root
cd ~/Projects/Shopify/checkout-extensions
shopify app dev
# Then: open the dev store, add a product, go to checkout, confirm the extension renders.
```

---

## Deviations from the plan

None. The fix is exactly the one line specified in §3. The out-of-scope list was followed strictly.

The runtime confirmation step (§7 step 5) was not executed in this Coder session because it requires an interactive browser against the live dev store — this is QA territory per the plan's own §4 final paragraph.

---

## Out-of-scope observations

None noted during this implementation.

---

## Bug fix verification approach

For QA's reproduction-then-verify procedure (referencing the original bug report at `docs/bugs/cartlines-vs-lines-signal-name.md`):

**Steps to reproduce the original bug (before fix):**
1. Run `shopify app dev`.
2. Install the app on `theme-evolution-os2.myshopify.com`.
3. Add any product to cart (e.g., `/products/the-complete-snowboard`).
4. Open checkout.
5. Observe: extension does not render; browser DevTools console shows `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')` and `Cannot read properties of undefined (reading 'length')`.

**Verification that the bug is resolved (after fix):**
1. Run `shopify app dev` on commit d15838d or later.
2. Install the app on `theme-evolution-os2.myshopify.com`.
3. Add any product to cart and open checkout.
4. Observe: extension renders one of its three states (below-threshold progress bar, qualified message, or empty/suppressed).
5. Confirm DevTools console is free of `ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')` and `Cannot read properties of undefined (reading 'length')`.

Both error strings must be absent from the console across a full checkout session (add product → checkout → enter address → view shipping options) to call the bug resolved.

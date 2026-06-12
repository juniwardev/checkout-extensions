# Bug: Extension crashes on every render — `shopify.cartLines` does not exist at api_version 2026-04

**Slug:** `cartlines-vs-lines-signal-name`
**Reported:** 2026-06-11
**Severity:** Critical (extension is non-functional)
**Affected scope:** `extensions/free-shipping-progress` (all states, all browsers, all viewports)

## Steps to reproduce

1. Run `shopify app dev` against the dev store.
2. Add any product to cart and open checkout.
3. Observe the dev console.

## Expected behavior

Extension renders one of its three states (empty / below-threshold / qualified) based on cart contents.

## Actual behavior

Extension crashes on every render with:

```
ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')
```

The crash happens because `shopify.cartLines` is `undefined` at this api_version.

## Root cause

At `api_version = "2026-04"`, the installed `@shopify/ui-extensions@2026.4.0` types expose cart line items as `shopify.lines` (typed as `SubscribableSignalLike<CartLine[]>` per `standard.d.ts:602`), NOT as `shopify.cartLines`. The legacy React + hooks API used `useCartLines()`, and that naming pattern leaked into:

- The plan's §10 signal inventory.
- The project-level `CLAUDE.md` "Data Access" section.

The Coder followed the plan faithfully. The bug originated upstream of the implementation.

## Suspected files

- `extensions/free-shipping-progress/src/Checkout.jsx:84` — the live bug.
- `~/Projects/Shopify/checkout-extensions/CLAUDE.md` — source material to correct.
- `docs/plans/free-shipping-progress.md` §10 — source material to correct.
- `docs/plans/free-shipping-progress-impl-notes.md` — likely references the wrong name too.

## Regression risk areas

**Other extensions in this repo:** No other extension source files currently reference `cartLines` (confirmed by grep across `extensions/` excluding `node_modules`). The only affected file is `extensions/free-shipping-progress/src/Checkout.jsx:84`.

**Future extensions:** Any new extension that needs cart line data is at risk of repeating this mistake because `CLAUDE.md` (now corrected) was the authoritative signal-name reference for all agents. The corrected note in `CLAUDE.md` §5 Coder section explicitly flags the `cartLines` vs `lines` confusion and its origin, which should prevent recurrence.

**Signal name confusion patterns to watch for in future plans and code reviews:**

| Wrong name (React + hooks era) | Correct name at `api_version = "2026-04"` | Note |
| :--- | :--- | :--- |
| `shopify.cartLines` | `shopify.lines` | Confirmed via `standard.d.ts:602` |
| `useCartLines()` | `shopify.lines.value` | Hook pattern does not exist in Preact signals API |
| `useDeliveryGroups()` | `shopify.deliveryGroups.value` | Verify — hook-style accessors generally do not exist |
| `useApplyCartLinesChange()` | `shopify.applyCartLinesChange(...)` | Mutation pattern; verify spelling against installed types |
| `useExtensionCapability()` | `shopify.extension` | Verify |

The general rule: whenever a plan or review references a `use*()` hook pattern for data access, it is almost certainly from the older React + hooks API and will not work here. All data access must go through `shopify.<signal>.value`. When uncertain, verify against the installed `@shopify/ui-extensions@2026.4.0` types at `node_modules/.pnpm/@shopify+ui-extensions@2026.4.0_.../build/ts/surfaces/checkout/api/standard/standard.d.ts`.

## Reference

QA report at `docs/qa/free-shipping-progress-report.md` includes full reproduction and type-file evidence.

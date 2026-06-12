# Bug-fix plan: `fix-cartlines-vs-lines-signal-name`

**Bug report:** `docs/bugs/cartlines-vs-lines-signal-name.md`
**QA report:** `docs/qa/free-shipping-progress-report.md`
**Severity:** Critical (extension is non-functional)
**Affected extension:** `free-shipping-progress`

---

## 1. Problem statement

The `free-shipping-progress` extension crashes on every render with
`ExtensionUsageError: TypeError: Cannot read properties of undefined (reading 'value')`.
The root cause is a wrong signal property name: `src/Checkout.jsx:84` reads
`shopify.cartLines.value`, but at `api_version = "2026-04"` cart line items are
exposed as `shopify.lines` (typed `SubscribableSignalLike<CartLine[]>` in
`@shopify/ui-extensions@2026.4.0` at `standard.d.ts:602`). There is no
`cartLines` property at this API version. `shopify.cartLines` resolves to
`undefined`, so `.value` throws and the extension renders nothing in any state.
The error was missed in review because the incorrect `cartLines` name originated
upstream — it was specified in both the project `CLAUDE.md` "Data Access" section
and the plan's §10 signal inventory (a leftover from the legacy React + hooks
`useCartLines()` pattern). The Coder followed the plan faithfully; the build
passed because the property reference is syntactically valid TypeScript, so the
defect only surfaced at runtime.

## 2. Scope

This is a single-line application-code fix.

**Files that change:**

- `extensions/free-shipping-progress/src/Checkout.jsx` — line 84 only.

**Files that do NOT change (already corrected by the Architect, or out of scope):**

- `CLAUDE.md` — already corrected to reference `shopify.lines`.
- `docs/plans/free-shipping-progress.md` (§10 signal inventory) — already corrected.
- `docs/bugs/cartlines-vs-lines-signal-name.md` — already corrected.
- All other files (see §6 Out of scope).

## 3. The fix

In `extensions/free-shipping-progress/src/Checkout.jsx`, line 84:

```js
// before
const lines = shopify.cartLines.value;

// after
const lines = shopify.lines.value;
```

No other lines change. The downstream usage (`lines.length === 0` empty-cart
guard and any iteration over `lines`) is unchanged — `shopify.lines.value`
returns the same `CartLine[]` shape the code already expects.

## 4. Verification steps

After making the one-line change, the Coder must:

1. Run `shopify app build` from the repo root and confirm it completes with no
   errors and the `free-shipping-progress` bundle builds cleanly (expected bundle
   size ~8.7 KB compressed, matching the last recorded value — no regression
   expected from a property rename).
2. Confirm via grep that `cartLines` no longer appears in
   `extensions/free-shipping-progress/src/` and that `shopify.lines.value` is
   present at line 84.

**Important — build-only is insufficient to prove this fix:** the original defect
passed `shopify app build` cleanly (8.7 KB clean build, QA-confirmed) because the
wrong property name is syntactically valid TypeScript. The crash only surfaces at
runtime. Therefore the fix requires a runtime confirmation step:

3. Start `shopify app dev`, install the app on the dev store, add a product to
   cart, and open checkout. Confirm:
   - The extension renders (any of its three states — below-threshold, qualified,
     or empty/suppressed — is acceptable depending on cart and settings).
   - The browser console is free of `ExtensionUsageError: TypeError: Cannot read
     properties of undefined (reading 'value')` and `Cannot read properties of
     undefined (reading 'length')` — the exact errors documented in the QA report.

Full functional re-verification of all §11 plan checks (previously blocked by the
crash) is QA's responsibility and will be covered in the follow-up `/qa` run, not
here.

## 5. Commit message

```
fix(free-shipping-progress): use shopify.lines instead of shopify.cartLines (fixes cartlines-vs-lines-signal-name)
```

## 6. Out of scope — do NOT touch

The Coder must make ONLY the one-line change in §3. Specifically, do NOT:

- Edit `CLAUDE.md`, `docs/plans/free-shipping-progress.md`, or
  `docs/bugs/cartlines-vs-lines-signal-name.md` — these source-of-truth
  documents have already been corrected by the Architect.
- Touch any other line in `Checkout.jsx` (no refactors, no renaming of the
  `lines` local variable, no changes to the empty-cart guard or helper functions).
- Modify `extensions/free-shipping-progress/shopify.extension.toml` (settings,
  target, capabilities, or `api_version`).
- Modify locale files (`locales/en.default.json`, `locales/es.json`) — confirmed
  correct by QA.
- Touch any other extension in `extensions/` — grep confirms no other extension
  references `cartLines`.
- Modify `shopify.app.toml`, lock files, or any generated/build artifacts.

## 7. Implementation checklist for the Coder

1. Open `extensions/free-shipping-progress/src/Checkout.jsx`.
2. At line 84, change `shopify.cartLines.value` to `shopify.lines.value`.
3. Run `shopify app build`; confirm clean compile and no bundle-size regression.
4. Grep `extensions/free-shipping-progress/src/` to confirm zero remaining
   `cartLines` references.
5. Start `shopify app dev`, open the dev-store checkout with a product in cart,
   and confirm the extension renders and the console is free of the
   `ExtensionUsageError` / `Cannot read properties of undefined` errors from the
   QA report (see §4 step 3).
6. Commit with the message in §5.
7. Write impl notes to `docs/plans/fix-cartlines-vs-lines-signal-name-impl-notes.md`
   recording the build result, bundle size, and runtime confirmation outcome.

---

## Sign-off

**Architect:** Approved (drafting + runtime-verification step in response to Pass 1 finding).
**Plan-Reviewer:** APPROVED — 2026-06-11, Pass 2.

Review artifact: `docs/reviews/fix-cartlines-vs-lines-signal-name-review.md`.
Bug report: `docs/bugs/cartlines-vs-lines-signal-name.md`.

Cleared for /implement.

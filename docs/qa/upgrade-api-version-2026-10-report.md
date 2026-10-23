# QA Report: `upgrade-api-version-2026-10`

**QA Agent:** Claude Sonnet 5.5
**Date:** 2026-10-23
**Plan:** `docs/plans/upgrade-api-version-2026-10.md` (revision 3), AC-11 to AC-13, R13, R14
**Impl notes:** `docs/plans/upgrade-api-version-2026-10-impl-notes.md` (Z4 and Z7 sections)
**Store:** `theme-evolution-os2.myshopify.com` (dev store and live store, OQ-7)
**Dev session under test:** the operator's `shopify app dev` (PID 98516), left running. I did not start, stop or clean it.
**Tunnel host:** `casio-boost-systems-seeing.trycloudflare.com`
**Browser tool:** Playwright MCP throughout. Chrome DevTools MCP was not needed.

---

## Summary verdict

**PASS WITH NITS. Approval is conditional on the operator manual walk-through listed in "Needs operator manual walk-through".**

What was proven live:
- The checkout bundle under test is served from the dev tunnel and is byte-identical to the local 2026-10 build.
- The extension renders at 1280px and 375px with no extension console errors.
- The `deliveryGroups` / `deliveryOptions` auto-detect path works on 2026-10. A free option gives the qualified message, and a destination with no free option suppresses the block.
- Spanish locale works.

What was **not** verified, and must not be read as a pass:
- AC-12 (App Home runtime and the D3 Admin GraphQL 2026-10 CRUD): blocked, because the admin requires a Shopify login.
- AC-13 (Sidekick): identity unconfirmed.
- AC-11 (i) to (iii): they need checkout-editor setting changes on the live store.

No defect was found. The FAIL criteria in the plan did not trigger.

---

## Identity gate (AC-11 hard gate, R14)

**PASSED for the checkout extension.**

How the tunnel host was obtained (non-destructive): `curl http://localhost:60420/extensions` (the local dev server behind PID 98534's `cloudflared`) returns the `root.url`, `socket.url` and `devConsole.url`. No shopify command was run to find it.

| Evidence | Result |
| :-- | :-- |
| Playwright network request #331 (1280px load): `GET https://casio-boost-systems-seeing.trycloudflare.com/extensions/dev-01da4e1d-86c7-dbc9-2474-713794b1f56e9780c703/assets/purchase.checkout.block.render/main.js` | 200 |
| Same request again on the 375px load (#284) | 200 |
| UUID `01da4e1d-...` | `free-shipping-progress`, target `purchase.checkout.block.render`, `apiVersion` `2026-10` in the dev server JSON |
| sha256 of the tunnel-served bundle vs `.shopify/dev-bundle/01da4e1d-.../dist/free-shipping-progress.js` | Both `b101f605dd9c...`. Identical |
| Dev Console | Not opened (admin login needed). **Recorded as "unknown"**. It is not counted as corroboration |
| Also seen | `extensions.shopifycdn.com/partners-extensions-scripts-bucket/ui_extension/handle/free-shipping-progress/version/dev-e2a3d1ee-...js` (request #208). The `dev-` version path is Shopify's hosted dev-preview copy, i.e. preview, not release. The tunnel bundle is the gate |

The dev server `/extensions` JSON reports all three extensions at `apiVersion: 2026-10`, status `success`: app-home (`admin.app.home.render`), app-tools (`admin.app.tools.data`) and free-shipping-progress.

**App Home / app-tools (static only).** The tunnel serves the app-home bundle (`84e66d4b15e5f9f1...`) and the app-tools bundle (`9773b106d001...`). Both hashes equal the local `.shopify/dev-bundle` copies. The app-home bundle contains exactly one `admin/api/2026-10` string, so D3 is in the served build. This is curl evidence only, **not** the DevTools-in-admin gate AC-12 asks for (see below).

---

## Checkout editor settings (AC-11 precondition)

I could not read the checkout-editor settings, because there is no admin access. I changed none, so there was nothing to restore. The rendered output implies the following (inferred only):
- Auto-detect is ON, the default.
- Threshold is blank or 0 (the bar is at 99% with "$0.00 away").
- There are **two** placements of the block. They render with different emoji: `✅ You qualify for free shipping!` and `🎉 You qualify for free shipping!`. The June report saw one placement. This is a merchant configuration observation, not an upgrade finding.

---

## AC-11 checks (free-shipping-progress, plan section 11)

Fixture: `The Complete Snowboard - Ice`, $699.95, via the `/cart/42616797757536:1` permalink.
Password: the password in this repo's `docs/dev-fixtures.md` (stale value, redacted) was **rejected**. The sibling `theme-evolution-os2/docs/dev-fixtures.md` password (the same store) worked. See Nits.

| # | Check | Viewport | Method | Result |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Renders at the merchant-placed block position, pre-address (check 14 shape) | 1280 | Playwright | **PASS**. `$0.00 away from free shipping`, progressbar `Free shipping progress: 99% to threshold`, at the top of the main column |
| 1 | Same | 375 | Playwright | **PASS**. Renders, `scrollWidth` 375 = viewport 375, no horizontal overflow |
| 1 | Console | 1280 and 375 | Playwright | **PASS**. No extension errors. No `ExtensionUsageError`, no `cartLines` and no `Cannot read properties` messages. See Console |
| 3 | Auto-detect, qualified. US address (San Francisco 94103) gives Standard = FREE and Express = $15.00 | 1280 | Playwright | **PASS (shape)**. Both placements switch to `✅/🎉 You qualify for free shipping!`, with no progress bar. This is reactive: the bar went to the qualified message after the address was entered. This reads `deliveryGroups` / `deliveryOptions` / `costAfterDiscounts` on 2026-10. **Caveat:** I can't tell whether Standard's FREE comes from a flat $0 rate or a discount-driven `costAfterDiscounts`. The plan asks for the discount-driven variant. A discount-driven run is left to the operator (below) |
| 12 | Auto-detect suppression. A Canadian address (Toronto M5H 2N2) leaves only "International Shipping $30.00" and no zero-cost option | 1280 | Playwright | **PASS**. No free-shipping text renders in the main document. The extension renders nothing. No console warning |
| 12b | Then satisfy the rule and expect qualified | 1280 | Playwright | **PASS (partial)**. The US address qualified (check 3). I did not switch back to US in the same session after the Canada run |
| (iv) / 9 | Spanish locale | 375 | Playwright | **PASS**. At `/es-us`: `Te faltan $0.00 para envío gratis` |
| (v) / 10 | No overflow at 375px | 375 | Playwright | **PASS**. `scrollWidth` = `innerWidth` = 375 |
| (vi) / 1 | Empty cart | n/a | Playwright | **Not reachable at checkout**. After `/cart/clear.js`, `/checkout` redirected to the storefront `/`. Checkout has no remove-line control. `shopify.lines` is read on every render (STEP 0) and covered by every other check |
| (i) | Manual mode, below threshold | n/a | none | **NOT RUN. Needs operator.** Requires changing `use_shopify_free_shipping_rate` in the live checkout editor |
| (ii) | Manual mode, at or over threshold | n/a | none | **NOT RUN. Needs operator** |
| (iii) | Tone (auto / critical / invalid) | n/a | none | **NOT RUN. Needs operator.** The accessibility tree is readable (not hidden in an iframe), but the tone needs an editor change |

Screenshots:
- `docs/qa/screenshots/upgrade-2026-10-checkout-1280.png`: pre-address state.
- `docs/qa/screenshots/upgrade-2026-10-checkout-1280-address.png`: US address, qualified.
- `docs/qa/screenshots/upgrade-2026-10-checkout-1280-suppressed-CA.png`: Canada, suppressed.
- `docs/qa/screenshots/upgrade-2026-10-checkout-375.png`: mobile.

---

## AC-12: App Home runtime. NOT VERIFIED. Needs operator.

- Playwright was sent to `admin.shopify.com/store/theme-evolution-os2/apps/checkout-extensions-203` and redirected to `accounts.shopify.com` login. There is no admin session, and I have no credentials. I did not log in.
- The hard gate (the App Home bundle's origin visible in DevTools inside the admin) therefore can't be shown. Per the plan, identity is unknown for the browser path. I **escalated rather than improvised**.
- I created no test FAQ, edited none and deleted none. The FAQ count is unchanged and untouched.
- Static corroboration: the tunnel serves an app-home bundle that equals the local build and contains `admin/api/2026-10`.
- The FAQ count baseline (O2(d)) was skipped by the operator (impl notes, addendum). The operator should record it before the walk-through. If the list reads exactly 50, `listFAQs` is capped at `first: 50`, so use the metaobject entries list in the admin for the true count.

## AC-13: app-tools / Sidekick. IDENTITY UNCONFIRMED.

- The gate half holds. The AC-11 gate passed in this same `dev` session, and the dev server JSON shows the app-tools bundle (`admin.app.tools.data`, `apiVersion 2026-10`) with `development.status: success`.
- The `dev` log itself (the terminal in PID 98516's session) is not readable by me. The AC-13 identity condition says to record "identity unconfirmed" if either part is missing, so that is the status.
- Sidekick is not reachable without admin access. **Not verifiable.**

---

## Bundle size

`shopify app build` ran, with no permission denial and no store contact. Exit success. The CLI is 4.9.4 (the same as in the impl notes).

| Extension | Coder (impl notes) | QA | Limit (L) |
| :-- | :-- | :-- | :-- |
| app-tools | ~0.9 KB (2.1 KB orig) | ~0.9 KB (2.1 KB orig) | 64 KB |
| app-home | ~9.5 KB (27.5 KB orig) | ~9.5 KB (27.5 KB orig) | 64 KB |
| free-shipping-progress | ~7.9 KB (22.2 KB orig) | ~7.9 KB (22.2 KB orig) | 64 KB |

Reference: the previous QA run recorded free-shipping-progress at ~8.7 KB compressed (22.2 KB original, ~0.8 KB smaller after the CLI and package change). All are far under 64 KB, with no regression.

The three `shopify.d.ts` hashes are unchanged by the build (`6be4399d`, `24bd339d`, `56d3336d`, equal to the Coder's).

**Cleanup:** the build dropped `graphql-logo.png`, `polaris-icon.png` and `preact-logo.png` into `extensions/app-home/`. I moved them to the scratchpad (`.../scratchpad/pngs/`). My own Playwright output folder `.playwright-mcp/` was also moved to the scratchpad. `git status --porcelain` now shows only `?? docs/qa/screenshots/`, which holds this report's screenshots. For commit, the parent should add it together with the report. No tracked file changed. Neither `package-lock.json` nor `yarn.lock` exists. PID 98516 is still running.

---

## Console errors and warnings

Playwright, the checkout page with `?dev=`:
- **Error (1, baseline infrastructure):** `401 .../private_access_tokens` (Shop Pay auth). The same 401 was in the June report.
- **Warnings (baseline infrastructure, none from the extension):**
  - `integrity` attribute ignored on preload.
  - `Couldn't resolve source map URL free-shipping-progress.js.map` (the same as June).
  - sandbox `allow-scripts allow-same-origin` iframe.
  - `NetworkUniversalProvider` (Shop Pay).
  - unused-preload warnings.
- **Extension errors:** none. No `ExtensionUsageError`, `cartLines` or `Cannot read properties`. No `[free-shipping-progress]` misconfiguration warning, which is expected in auto-detect mode.
- Not seen in this run: the June 404 font and 403 `shop.app/pay/hop` errors.
- The password-page console error appears before login (the gate page), unrelated.

## Network failures and slow responses

No extension-specific failures. The tunnel `main.js` returned 200 on each load. The `GET .../extensions` tunnel root returned 200. There was no Cloudflare bot challenge this time. Playwright was not blocked on checkout address entry in this run (June's checks 3, 12 and 13 were blocked then).

## Accessibility observations

- `s-progress` is exposed as `progressbar "Free shipping progress: 99% to threshold"`. The label is localised through `shopify.i18n.translate`, and the Spanish string renders.
- The extension's accessibility tree is readable from Playwright's snapshot (it is not hidden in a cross-origin iframe), so the AC-11 (i) accessibility-label check can be done directly.
- No accessibility regressions were seen.

## Performance notes

Bundle sizes are unchanged from B0 (0% delta). Nothing else was measured.

---

## Per-AC results

| AC | Result | Notes |
| :-- | :-- | :-- |
| AC-11 identity gate (checkout) | **PASS** | Tunnel host recorded. Hash identical to the local build. Dev Console: unknown |
| AC-11 checks 1, 3, 12 (auto-detect, `deliveryGroups`) | **PASS** | Checks 3 and 12 are demonstrated live. 3 is flat-vs-discount-driven unproven |
| AC-11 (iv) Spanish, (v) 375px | **PASS** | |
| AC-11 (vi) empty cart | Not reachable at checkout | Recorded per the plan |
| AC-11 (i), (ii), (iii) manual mode and tone | **NOT RUN, operator** | Need live checkout-editor changes |
| AC-12 App Home CRUD (D3 at runtime) | **NOT VERIFIED, operator** | No admin session. Browser identity gate unmet. No FAQs touched |
| AC-13 app-tools / Sidekick | **Identity unconfirmed. Sidekick not verifiable** | |
| Bundle size (AC-7 area) | **PASS** | Matches the Coder's numbers. All under 64 KB |
| Cleanliness (AC-9 area) | **PASS** | `git status` has only my screenshots dir. `.d.ts` hashes unchanged |

---

## Needs operator manual walk-through

Run all of these on `theme-evolution-os2.myshopify.com` while the `shopify app dev` session (PID 98516) is still running. Do not run `dev clean` (R13).

1. **AC-12 identity (hard gate).** Open the app in the store admin, then DevTools, Network. Confirm the App Home bundle (`.../extensions/dev-83247469-.../assets/admin.app.home.render/main.js`) loads from `casio-boost-systems-seeing.trycloudflare.com`. If the tunnel host has changed, read the current one from `http://localhost:60420/extensions`. Optionally open the Dev Console (`https://<tunnel>/extensions/dev-console`) to corroborate. If the origin can't be seen, stop and record "identity unknown".
2. **AC-12 baseline.** Before editing, record the FAQ count and questions (this is O2(d), which was skipped). If the count is exactly 50, use the admin metaobject entries list, because `listFAQs` caps at `first: 50`.
3. **AC-12 CRUD.** Check that the HomePage `welcome` heading renders and the FAQ list loads, and look for GraphQL `errors` in the response. Then **create** a FAQ named exactly `QA TEST – upgrade-api-version-2026-10 – delete me`, **edit** it, and **delete** it. Confirm the FAQ count is back to the step-2 value and that the console has no extension errors. Touch no other FAQ.
4. **AC-13.** If Sidekick is available, ask it to list FAQs and confirm `list_faqs` is invoked. Also read the `app dev` terminal log for the `app-tools` build and any registration error, and record both. Otherwise record "not verifiable: Sidekick unavailable".
5. **AC-11 (vii), discount-driven variant (optional but planned).** With auto-detect ON and an address entered, use a shipping discount that zeroes `costAfterDiscounts` (not a flat $0 rate). Expect the qualified message. Then remove the discount and expect suppression if no free option is left.
6. **AC-11 (i), (ii), (iii).** In the checkout editor, record the current settings first. Set auto-detect OFF with a manual threshold above the cart total, and check that the message equals the formatted (threshold − total) and that the bar label reads `round(total / threshold × 100)%`, capped at 99. Set the threshold at or below the total and expect the qualified message. Try tone `critical` (red bar), `auto` (blue), and an invalid value such as `success` (falls back to `auto`, no console error). **Restore every setting afterwards.**

The plan accepts the operator walk-through for these, with the method recorded per check (precedent: June 2026).

---

## Nits

1. **`docs/dev-fixtures.md` has a stale password.** The stored password is rejected by the store (the POST re-renders the form: "Password incorrect"). The sibling project's `theme-evolution-os2/docs/dev-fixtures.md` password worked, and is the correct one. The file is gitignored. The fixture should be updated before the next QA run.
2. **Two block placements** are visible in checkout, with different emoji. That is merchant configuration, not a defect. It is noted because the June QA saw one.
3. **Check 3 shape only.** The FREE Standard rate could not be tied to `costAfterDiscounts` versus a flat $0 rate. Item 5 above would close it.
4. **Resolved version `2026.10.0`** rather than `2026.10.2`, as the operator already accepted (Deviation 4). No action.
5. **Checkout flows are only a partial regression of the June checks.** June checks 5, 6, 7 and 13 (manual mode, reactive discount, blank threshold) were not re-run. They need the editor changes in walk-through item 6.

## Operator sign-off (2026-10-23)

The operator approved release **without** the manual walk-through listed above.

- **Why the walk-through didn't happen:** after QA, `shopify app dev` could no longer start a dev preview. All three extensions bundled at the expected sizes (app-tools ~0.9 KB, free-shipping-progress ~7.9 KB, app-home ~9.5 KB), but the CLI then failed at "Preparing dev preview" with a Shopify-side "Internal error. Looks like something went wrong on our end." (Request ID `406f4f3a-d78f-4d6f-8aa3-8fe84a438188-1792795853`).
  - No repo change happened between the working 15:42 session and the failing 15:50 one. The only commit was `e2e1dd9`, which is docs only.
  - Shopify's status page was green. The failure matches community reports of server-side dev-preview upload failures.
- **Not verified before release:** AC-12 (App Home FAQ create/edit/delete against Admin API 2026-10), AC-13 (app-tools/Sidekick), and AC-11 (i)–(iii) and (vii) (manual mode, tones, discount-driven free shipping).
- **Mitigation:**
  - O2(d), the FAQ count and questions, must be recorded before O3.
  - O7 is expanded from a load check to a full FAQ create/edit/delete check on the live store, using the AC-12 test FAQ name. Afterwards, compare against O2(d).
  - If App Home or the checkout block misbehaves after release, follow §3.5: contain first, check O2(b) before any rollback, then fix forward.
- **O4b caveat:** `shopify app dev clean` may hit the same server-side error. Per O8, a failed clean loses nothing. Retry it later, and record O6 as "identity unconfirmed" until it succeeds.
- **Password redaction:** the stale storefront password that was quoted in this report has been redacted before commit.

---

**PASS WITH NITS**

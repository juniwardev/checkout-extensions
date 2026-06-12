# Project Standards: Checkout UI Extensions

This project uses the Claude Squad workflow. Agents at `~/.claude/agents/` and slash commands at `~/.claude/commands/` (global, shared across projects). Project-scoped agent overrides live in `.claude/agents/` within this repo. This file is the per-project context every agent reads at the start of work. `CLAUDE.md` (Claude Code) and `AGENTS.md` (OpenCode) are kept byte-identical for portability.

🚨 **IF the Shopify Dev MCP is registered, call `learn_shopify_api` ONCE at the start of any work on this project**, targeting the Checkout UI Extensions surface (or the equivalent name the MCP exposes). This grounds the agent's knowledge in the actual `api_version = "2026-04"` API — Polaris web components (`s-*` elements) and the global `shopify` signals object — rather than relying on training data that leans heavily toward the older React + hooks Checkout UI Extensions API. The first feature plan in this project (`free-shipping-progress`) had to be reworked because the brief was written without this grounding step and referenced React-style components and hooks that do not exist at this `api_version`. Do not repeat that mistake.

🚨 **Coder and Plan-Reviewer:** read this entire document before executing any code modifications. The architectural directives at the bottom are project-specific and non-negotiable. Checkout UI Extensions on `api_version = "2026-04"` use **Polaris web components rendered by Preact**, NOT React with hooks. Many assumptions from older Shopify React + hooks tutorials do not apply to this codebase.

---

## Project type and stack

- **Framework:** Shopify Checkout UI Extensions, `api_version = "2026-04"`. Renders Polaris web components (`s-*` elements) via Preact. NOT React. NOT `@shopify/ui-extensions-react/checkout`.
- **Language:** TypeScript (`.tsx`). Preact's JSX runtime is in use; standard TSX syntax applies but React-specific imports (`useState`, `useEffect` from `react`) are NOT available — use Preact's equivalents from `preact/hooks` if reactive local state is needed.
- **UI components:** Polaris web components served by Shopify's checkout component set. Common elements: `s-progress`, `s-box`, `s-stack`, `s-text`, `s-heading`, `s-banner`, `s-button`, etc. (See architectural directives below for the full inventory.)
- **Data access:** Via the global `shopify` signals object available in the extension runtime. Examples: `shopify.lines`, `shopify.cost.totalAmount`, `shopify.shippingAddress`, `shopify.deliveryGroups`. Signals are reactive — components re-render when underlying values change.
- **Shopify app structure:** This is a Shopify App (extension-only template, no Remix backend, no admin UI). The app contains one or more Checkout UI Extensions in the `extensions/` directory. Each extension is independently configured via `shopify.extension.toml`.
- **Storefront target:** `theme-evolution-os2.myshopify.com` (the Liquid theme project's dev store — same store, separate app).
- **Repo location:** `~/Projects/Shopify/checkout-extensions`
- **State:** Greenfield — generated via `npm init @shopify/app@latest` with extension-only template. First extension is `free-shipping-progress` (Checkout UI type), scaffolded but not yet customized.
- **Deploy target:** Not yet configured. Extensions are tested via `shopify app dev`. Production deployment happens via `shopify app deploy` once an extension is ready.

---

## Run locally

```bash
cd ~/Projects/Shopify/checkout-extensions
shopify app dev
```

The dev server starts a Cloudflare tunnel, bundles all extensions in `extensions/`, and connects the app to the dev store. Extensions hot-reload on save. The CLI prints a preview URL for installing the app on the dev store admin.

Available commands:

- `shopify app dev` — start dev tunnel + extension bundler with hot reload
- `shopify app build` — production build of all extensions (no deploy)
- `shopify app deploy` — build extensions and upload to Shopify infrastructure as a new app version
- `shopify app generate extension` — scaffold a new extension inside this app (prompts for type and name)
- `shopify app config link` — connect this local project to an existing app on Shopify
- `shopify app config push` — push local `shopify.app.toml` config to Shopify
- `shopify app info` — show app metadata (org, client ID, scopes)

Package manager: **pnpm** at the extension level (Shopify's default for extension scaffolding) and **npm** at the app root. Mixed package managers are normal in this project. Both lock files (`package-lock.json` at root, `pnpm-lock.yaml` in extension directories) should be committed.

---

## Deploy targets

⚠️ **No production deploy target is configured for this project yet.** Extensions are tested via `shopify app dev` against `theme-evolution-os2.myshopify.com`.

When ready to deploy:

1. Document the deploy procedure here (e.g., "Run `shopify app deploy`, review the new app version in admin, publish manually OR publish via `shopify app deploy --force`").
2. Update `.claude/agents/devops.md` (project-scoped) with the specific deploy procedure.
3. The `/ship` slash command will then become operational for this project.

Until then, the squad workflow terminates at `/qa` + operator sign-off. `/ship` will refuse with a clear message (the project-scoped DevOps agent is configured to refuse by design when no target is set). The operator manually runs `shopify app deploy` when ready.

**Important about `shopify app deploy`:**

- Creates a new app version. The version exists as a draft until explicitly published.
- Each extension's bundle is uploaded and version-tagged.
- After deploy, the new version must be selected as the "active" version (either via the Shopify admin or with `--force` on the deploy command).
- Rolling back means selecting a previous app version as active, NOT redeploying old code.

---

## Verification

For local verification while developing:

1. **Dev server smoke test:** `shopify app dev` runs without errors. All extensions bundle successfully (visible in the per-extension build log).
2. **App installation check:** Open the preview URL printed by `shopify app dev`. The app installs on `theme-evolution-os2.myshopify.com` without errors. Required scopes are auto-granted.
3. **Checkout render check:** Open the dev store storefront → add a product to cart → go to checkout → confirm the extension renders at its target location with no JavaScript errors in the browser console.
4. **Build check:** `shopify app build` completes without errors. Each extension reports its bundle size (must stay under the platform performance budget — typically ~100KB compressed per extension).
5. **Sandbox compliance check:** No browser API calls (`window`, `document`, `localStorage`, `fetch` to arbitrary URLs) appear in any extension's code. All data access goes through the `shopify` global signals object.

These five checks form the baseline verification any feature or fix should pass before being marked complete.

---

## Multi-agent workflow

This project uses the squad workflow with file-based handoffs. Conventions:

```
/plan <feature>              → docs/plans/<slug>.md (Architect)
/review-plan <path>          → docs/reviews/<slug>-review.md (Plan-Reviewer)
/implement <plan-path>       → code changes + docs/plans/<slug>-impl-notes.md (Coder)
/qa <slug>                   → docs/qa/<slug>-report.md (QA)
touch docs/qa/<slug>.approved → operator sign-off
/ship <slug>                 → not yet operational (no deploy procedure configured)
```

For bug fixes, see `docs/process/bug-fix-workflow.md`. Slug convention for bug fixes: prefix with `fix-` (e.g., `fix-progress-bar-overflows-on-mobile`).

Audit-trail artifacts live in `docs/bugs/`, `docs/plans/`, `docs/reviews/`, `docs/qa/`. Each agent writes to its scoped subdirectory.

---

## Per-agent guidance for this project

### Architect

- Plans must respect the Checkout UI Extension architectural directives at the bottom of this document. The sandboxed runtime + Polaris web components API is the single most important constraint.
- Specify which **extension target** (or targets) the feature uses. Targets are configured in `shopify.extension.toml` under `[[extensions.targeting]]` and determine WHERE in the checkout flow the extension renders. The available targets are listed in the architectural directives below.
- Plans MUST identify which `shopify` signals are needed (`shopify.lines`, `shopify.cost.totalAmount`, `shopify.shippingAddress`, etc.) and which Polaris web components will be used (`s-progress`, `s-box`, `s-text`, etc.).
- Plans must NOT propose using standard HTML elements (`<div>`, `<button>`, etc.) or React-style components (`<BlockStack>`, `<Text>` from `@shopify/ui-extensions-react/checkout`) — neither will render in this API version.
- When in doubt about which signal path or component name to use, consult the Shopify Dev MCP for the actual `api_version = "2026-04"` surface. Do not infer from older tutorials.
- Performance budget: any plan that significantly increases bundle size needs explicit justification. Default budget per extension is around 100KB compressed.

### Plan-Reviewer

- Apply adversarial scrutiny on sandbox compliance: are any browser APIs used? Are all data accesses going through `shopify` signals? Are all UI components Polaris web components (`s-*` elements)?
- Verify the extension target specified in the plan actually exists and is available at `api_version = "2026-04"`. Use the Shopify Dev MCP to confirm if uncertain.
- Verify specific component names (`s-progress`, `s-box`, etc.) and signal paths (`shopify.lines`, etc.) exist in this API version. Older tutorials reference React components and hooks that DO NOT EXIST here.
- Demand that plans include i18n consideration: any user-facing string must use the localization API, not hardcoded text.
- Demand that plans include `shopify app build` as a verification step (validates TypeScript + bundle size + sandbox compliance).

### Coder

- Use Polaris web components from the Shopify checkout component set for all UI. The components are rendered as `s-*` JSX elements. Common primitives:
  - **Layout:** `s-stack`, `s-box`, `s-grid`, `s-divider`
  - **Text:** `s-text`, `s-heading`, `s-link`
  - **Actions:** `s-button`, `s-pressable`
  - **Forms:** `s-text-field`, `s-checkbox`, `s-select`, `s-choice-list`
  - **Feedback:** `s-banner`, `s-spinner`, `s-skeleton`
  - **Media:** `s-image`, `s-icon`, `s-thumbnail`
  - **Progress:** `s-progress`
- DO NOT use:
  - Standard HTML elements (`<div>`, `<span>`, `<p>`, `<button>`, `<input>`, etc.) — they will not render correctly.
  - React-style components from `@shopify/ui-extensions-react/checkout` (`<BlockStack>`, `<Text>`, `<Banner>`, etc.) — those are from an older API version not used in this project.
  - Imports from the `react` package — this is Preact, not React.
- Access data via the `shopify` global signals object. Common accessors at `purchase.checkout.block.render`:
  - `shopify.lines` — current line items (reactive). **Note:** the correct name at `api_version = "2026-04"` is `lines`, not `cartLines`. The older React + hooks API used `useCartLines()`, which is the source of this common confusion — `cartLines` does not exist on the `shopify` signals object.
  - `shopify.cost.totalAmount` — cart total (reactive, respects discounts)
  - `shopify.cost.subtotalAmount` — pre-discount subtotal
  - `shopify.shippingAddress`, `shopify.billingAddress` — addresses
  - `shopify.deliveryGroups` — shipping options including pricing
  - `shopify.discountCodes` — applied discount codes
  - `shopify.customer`, `shopify.email` — customer info
- For reactive component state inside the extension, use Preact hooks from `preact/hooks` (`useState`, `useEffect`, etc.), NOT React hooks.
- Never use browser APIs (`window`, `document`, `localStorage`, direct `fetch`). The sandbox does not provide them.
- Never import packages that aren't in the extension's `package.json` (or that aren't on Shopify's runtime allow-list).
- All user-facing strings go through the localization API and the extension's `locales/` files. Hardcoded English strings are a bug.
- After meaningful changes, run in order: `shopify app build` (validates TypeScript + bundle size + sandbox). The dev server (`shopify app dev`) will also surface runtime errors during interactive testing.
- Pre-save audit: remove unused imports (sandbox runtime is strict), confirm all JSX returns valid Polaris web components (returning bare HTML or unknown elements will fail at runtime).
- Commit messages: `feat(<extension-name>): <description>` for features, `fix(<extension-name>): <description> (fixes <slug>)` for bug fixes.

### QA

- Verification requires the dev server running (`shopify app dev`) and the app installed on `theme-evolution-os2.myshopify.com`.
- Use Playwright MCP for browser tests against the actual Shopify checkout. The path to reach checkout:
  1. Navigate to `https://theme-evolution-os2.myshopify.com`
  2. Submit storefront password (from `docs/dev-fixtures.md`)
  3. Open a product page (use product URLs from `docs/dev-fixtures.md`)
  4. Click "Add to cart"
  5. Click "Check out"
  6. Extension should render at its configured target location
- Confirm extension renders at the EXPECTED target location, not just "somewhere in checkout."
- Check the DevTools console for runtime errors. Sandbox violations, missing signal paths, and unknown component names show up here.
- Verify rendering at mobile (375px) and desktop (1280px+) viewport widths.
- Verify edge cases per the plan: empty cart, single item, threshold-met state, missing shipping address, etc.
- Bundle size check: run `shopify app build` and confirm the extension's compressed bundle size hasn't ballooned. Compare against the previous QA report's recorded size if available.

### DevOps

- Currently not operational for this project — no production deploy procedure is configured (see "Deploy targets" above).
- The project-scoped DevOps agent at `.claude/agents/devops.md` refuses `/ship` invocations until a deploy procedure is documented.

### General

- For bug investigation via `/investigate`, follow the standard procedure from the global General agent prompt.
- For Checkout UI Extension-specific investigations: first check whether the issue is a sandbox violation (e.g., extension trying to use a browser API), a signal path mismatch (e.g., accessing a property that doesn't exist on `shopify` at the configured target), or an extension target mismatch (extension configured for one target but expecting data from another).
- For investigations of unfamiliar API surfaces, use the Shopify Dev MCP to verify component names, signal paths, and target availability at `api_version = "2026-04"`.

---

## What NOT to change

- **`shopify.app.toml`** at the project root — managed by Shopify CLI. Edit only when explicitly required by a plan.
- **`shopify.extension.toml` per extension** — these configure the extension target, settings schema, capabilities, and `api_version`. Edit when adding extension targets or merchant settings, but be deliberate. NEVER change `api_version` as a drive-by; the entire codebase is tuned for `2026-04`.
- **`.shopify/`** directory — Shopify CLI internal state, do not commit or edit.
- **Generated TypeScript declaration files** — regenerate via Shopify CLI rather than hand-editing.
- **`package-lock.json` and `pnpm-lock.yaml`** — let the respective package managers manage these.
- **Build artifacts** (`dist/`, `build/`, `.cache/`, `node_modules/`) — never commit, never edit.
- **`.env` files** — never commit, never edit as part of a feature plan.

---

## Required environment variables

Most environment variables for a Shopify app are managed by the Shopify CLI and stored in `.shopify/` (gitignored) or in the app's Partners account configuration. The extension runtime itself does NOT have access to environment variables — extensions are sandboxed and receive merchant configuration via the settings API instead.

If a `.env` or `.env.local` file becomes necessary (e.g., for a custom build step or local testing utility):

| Variable | Purpose |
| :--- | :--- |
| (none required at this time) | Add entries here as the project grows |

Secrets that need to be available at runtime to the extension (e.g., a third-party API key) should be stored as merchant-facing settings in `shopify.extension.toml` and read via the settings API, NOT as environment variables.

---

## Checkout UI Extension architectural directives

The remainder of this document captures the platform-specific rules for Shopify Checkout UI Extensions on `api_version = "2026-04"`. Read carefully before any code modification.

### 1. Project Directory Structure

```text
.
├── extensions/                        # All extensions in this app live here
│   ├── free-shipping-progress/        # First extension (Checkout UI type)
│   │   ├── src/                       # Preact component source (.tsx)
│   │   ├── locales/                   # i18n translation files
│   │   ├── shopify.extension.toml     # Extension config (target, settings, capabilities, api_version)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── <future-extensions>/
├── shopify.app.toml                   # App-level config (managed by Shopify CLI)
├── package.json                       # App-level scripts
├── .shopify/                          # Shopify CLI state (gitignored)
└── docs/                              # Squad workflow audit trail (this project)
```

Each extension is independently bundled. Changes to one extension do not require rebuilding others.

### 2. The Sandboxed Runtime

Checkout UI Extensions run in a sandboxed JavaScript environment, NOT in the merchant's browser context. This means:

- **No DOM access:** `document`, `window`, and direct DOM manipulation are unavailable.
- **No browser storage:** `localStorage`, `sessionStorage`, `IndexedDB`, and cookies are unavailable.
- **Limited network access:** `fetch()` to arbitrary URLs is blocked.
- **Preact, not React:** This API version uses Preact as the rendering engine. Most JSX patterns work identically, but imports from the `react` package will not work — use `preact` or `preact/hooks` instead.
- **Limited dependencies:** Only packages on Shopify's allow-list can be imported.

**Consequence:** When a developer (or AI agent) suggests using `window.location`, `fetch('...some external API...')`, `<div>`, `<BlockStack>`, or React hooks like `useState` from `react`, the suggestion is invalid for this project.

### 3. Extension Targets

The "extension target" determines WHERE in the checkout flow the extension renders. Set in `shopify.extension.toml` under `[[extensions.targeting]]`. Common targets at `api_version = "2026-04"`:

- `purchase.checkout.block.render` — generic block, merchant places it via the checkout editor
- `purchase.checkout.delivery-address.render-before` / `render-after`
- `purchase.checkout.contact.render-before` / `render-after`
- `purchase.checkout.payment.render-before` / `render-after`
- `purchase.checkout.shipping-option-list.render-after`
- `purchase.checkout.cart-line-item.render-after`
- `purchase.checkout.actions.render-before`
- `purchase.checkout.reductions.render-before` / `render-after`

Each target receives a slightly different `shopify` signals surface (e.g., `shopify.shippingAddress` may not be populated at targets that render before the address section). Plans must specify the target and confirm the data the extension needs is actually available at that target. Use the Shopify Dev MCP to verify.

### 4. UI Components — Polaris Web Components

Use ONLY Polaris web components from the Shopify checkout component set. They render as lowercase `s-*` JSX elements. The available primitives (non-exhaustive; verify against Shopify Dev MCP for the authoritative list):

- **Layout:** `s-stack`, `s-box`, `s-grid`, `s-divider`, `s-spacer`
- **Text:** `s-text`, `s-heading`, `s-link`
- **Actions:** `s-button`, `s-pressable`
- **Forms:** `s-text-field`, `s-checkbox`, `s-select`, `s-choice-list`, `s-number-field`, `s-date-field`
- **Feedback:** `s-banner`, `s-spinner`, `s-skeleton`, `s-skeleton-text`, `s-skeleton-image`
- **Media:** `s-image`, `s-icon`, `s-thumbnail`
- **Disclosure:** `s-disclosure`, `s-modal`, `s-tooltip`
- **Tags & badges:** `s-tag`, `s-badge`
- **Progress:** `s-progress`

These components are styled by Shopify and adapt to the merchant's checkout theme automatically. Customization is limited to component attributes (e.g., `tone`, `padding`, `border-radius`, `inline-alignment`). Most accept semantic tone tokens (e.g., `primary`, `success`, `warning`, `critical`, `neutral`) rather than arbitrary hex colors.

**Forbidden:**

- Standard HTML elements (`<div>`, `<span>`, `<p>`, `<button>`, `<input>`, etc.) will not render.
- React-style components (`<BlockStack>`, `<Text>`, `<Banner>` from `@shopify/ui-extensions-react/checkout`) belong to an older API version and are not available here.
- Importing component classes from `@shopify/ui-extensions-react/checkout` will fail — the package isn't installed.

### 5. Data Access — the `shopify` Signals Object

All data flows through a global `shopify` object whose properties are reactive signals. Components automatically re-render when accessed signals change. Common accessors at `purchase.checkout.block.render` (verify against Shopify Dev MCP for the specific target's surface):

- **Cart state (reactive):**
  - `shopify.lines` — current line items (`cartLines` does not exist at this api_version)
  - `shopify.cost.totalAmount` — total in display currency, post-discount
  - `shopify.cost.subtotalAmount` — pre-discount subtotal
  - `shopify.cost.totalTaxAmount`, `shopify.cost.totalShippingAmount` — component costs
- **Customer & address state:**
  - `shopify.customer` — signed-in customer info
  - `shopify.email` — checkout email
  - `shopify.shippingAddress`, `shopify.billingAddress` — addresses
- **Delivery & discounts:**
  - `shopify.deliveryGroups` — shipping options (each with cost, title, handle)
  - `shopify.discountCodes` — applied discount codes
  - `shopify.note` — order notes
- **Apply changes (mutations):**
  - `shopify.applyDiscountCodeChange(...)` — add/remove discount codes
  - `shopify.applyCartLinesChange(...)` — add/remove/update line items
  - `shopify.applyShippingAddressChange(...)` — modify shipping address
  - `shopify.applyAttributeChange(...)` — set custom attributes
- **Settings (merchant configuration):**
  - `shopify.settings` — read merchant-configured settings (defined in `shopify.extension.toml`)
- **i18n:**
  - `shopify.i18n.translate(...)` — resolve translation keys
- **Extension metadata:**
  - `shopify.extension` — info about the running extension (target, version, etc.)

All read accessors are reactive — components re-render when the underlying values change. Mutation accessors return promises (or call callbacks) when invoked.

### 6. Internationalization (i18n)

User-facing strings must use translations, NOT hardcoded text. The pattern (verify exact API against Shopify Dev MCP):

```tsx
function FreeShippingProgress() {
  const message = shopify.i18n.translate('progressMessage', {remaining: '$10'});
  return <s-text>{message}</s-text>;
}
```

Translations live in the extension's `locales/` directory. `en.default.json` is required; additional locales (e.g., `es.json`, `fr.json`) are merchant-facing and rendered based on the checkout's locale.

### 7. Merchant Settings

Settings allow merchants to configure the extension without code changes. Defined in `shopify.extension.toml`:

```toml
[[extensions.settings.fields]]
key = "free_shipping_threshold"
type = "number_decimal"
name = "Free shipping threshold"
description = "Cart total at which free shipping applies"
```

Read in the extension via `shopify.settings`:

```tsx
const threshold = shopify.settings.free_shipping_threshold;
```

Available field types (verify against Shopify Dev MCP for the complete list at `api_version = "2026-04"`):

- `single_line_text_field`, `multi_line_text_field`
- `number_integer`, `number_decimal`
- `boolean`
- `date`, `date_time`
- `color`
- `variant_reference`, `product_reference`, `collection_reference`, `customer_reference`
- `choice` (dropdown selection from a defined set of values)

If a field accepts arbitrary hex colors (`color` type) but the consuming component only supports semantic tones (e.g., `s-progress` only accepts `tone` attributes like `primary`/`success`/`warning`), use `single_line_text_field` or `choice` instead and validate in code.

### 8. Performance Budget

Each extension has a strict bundle size budget enforced at deploy time (typically ~100KB compressed). Practices:

- Avoid heavy dependencies. Prefer pure-function utilities written inline.
- Use Shopify primitives instead of custom layout libraries.
- Run `shopify app build` periodically and monitor the per-extension bundle size in the output.

### 9. Code Quality & Pre-Save Audits

Before saving any file:

- Confirm all JSX returns only Polaris web components (`s-*` elements), never HTML or React components.
- Confirm all data access goes through the `shopify` global signals object, never `fetch()` or browser globals.
- Confirm all user-facing strings use `shopify.i18n.translate(...)`, never hardcoded English.
- Confirm imports come only from `preact`, `preact/hooks`, the extension's `src/`, the extension's `locales/`, or Shopify-allow-listed npm packages. NEVER `react` or `@shopify/ui-extensions-react/checkout`.
- Confirm `shopify.extension.toml` configuration matches what the extension actually does (e.g., if the extension uses a mutation like `shopify.applyDiscountCodeChange`, the corresponding capability must be declared in the toml).

---

End of project context. Agents proceed from here.

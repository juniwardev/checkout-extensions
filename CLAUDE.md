# Project Standards: Checkout UI Extensions

This project uses the Claude Squad workflow. Agents at `~/.claude/agents/` and slash commands at `~/.claude/commands/` (global, shared across projects). Project-scoped agent overrides live in `.claude/agents/` within this repo. This file is the per-project context every agent reads at the start of work. `CLAUDE.md` (Claude Code) and `AGENTS.md` (OpenCode) are kept byte-identical for portability.

🚨 **Coder and Plan-Reviewer:** read this entire document before executing any code modifications. The architectural directives at the bottom are project-specific and non-negotiable. Checkout UI Extensions run in a sandboxed runtime — many assumptions from normal React development do NOT apply here.

---

## Project type and stack

- **Framework:** Shopify Checkout UI Extensions (sandboxed React runtime via `@shopify/ui-extensions-react/checkout`)
- **Language:** TypeScript with React (`.tsx`). NOT JSDoc + JS — this project uses native TypeScript with type definitions from `@shopify/ui-extensions/checkout`.
- **Shopify app structure:** This is a Shopify App (extension-only template, no Remix backend, no admin UI). The app contains one or more Checkout UI Extensions in the `extensions/` directory. Each extension is independently configured via `shopify.extension.toml`.
- **Storefront target:** `theme-evolution-os2.myshopify.com` (the Liquid theme project's dev store — same store, separate app)
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
5. **Sandbox compliance check:** No browser API calls (`window`, `document`, `localStorage`, `fetch` to arbitrary URLs) appear in any extension's code. All data access goes through `@shopify/ui-extensions-react/checkout` hooks.

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

- Plans must respect the Checkout UI Extension architectural directives at the bottom of this document. The sandboxed runtime is the single most important constraint.
- Specify which **extension target** (or targets) the feature uses. Targets are configured in `shopify.extension.toml` under `[[extensions.targeting]]` and determine WHERE in the checkout flow the extension renders. The available targets are listed in the architectural directives below.
- Plans MUST identify which Checkout API hooks are needed (`useCartLines`, `useTotalAmount`, `useShippingAddress`, etc.) and which Shopify UI primitive components will be used (`<BlockStack>`, `<Banner>`, `<Text>`, etc.).
- Plans must NOT propose using standard HTML elements (`<div>`, `<button>`, etc.) — those will not render in the sandbox.
- Performance budget: any plan that significantly increases bundle size needs explicit justification. Default budget per extension is around 100KB compressed.

### Plan-Reviewer

- Apply adversarial scrutiny on sandbox compliance: are any browser APIs used? Are all data accesses going through Shopify hooks? Are all UI components from `@shopify/ui-extensions-react/checkout`?
- Verify the extension target specified in the plan actually exists and renders where the plan claims. The Shopify Checkout UI Extensions docs have the authoritative list.
- Demand that plans include i18n consideration: any user-facing string must use `useTranslate()` / `i18n.text()`, not hardcoded text.
- Demand that plans include `shopify app build` as a verification step (validates TypeScript + bundle size + sandbox compliance).

### Coder

- Use components from `@shopify/ui-extensions-react/checkout` exclusively for UI. NEVER use HTML elements directly. Common primitives:
  - **Layout:** `<BlockStack>`, `<InlineStack>`, `<Grid>`, `<View>`
  - **Text:** `<Text>`, `<Heading>`, `<Link>`
  - **Actions:** `<Button>`, `<Pressable>`
  - **Forms:** `<TextField>`, `<Checkbox>`, `<Select>`, `<Choice>`
  - **Feedback:** `<Banner>`, `<Spinner>`, `<SkeletonText>`
  - **Media:** `<Image>`, `<Icon>`
- Use Checkout API hooks for all data access. Common hooks:
  - `useApi()` — full extension API surface
  - `useCartLines()` — current cart line items (reactive)
  - `useTotalAmount()` — total cart amount in display currency (reactive)
  - `useShippingAddress()` — current shipping address (reactive)
  - `useDeliveryGroups()` — shipping options
  - `useApplyDiscountCodeChange()`, `useApplyCartLinesChange()`, etc. — mutation hooks
  - `useTranslate()` — i18n text resolution
  - `useSettings()` — merchant-configured settings from `shopify.extension.toml`
- Never use browser APIs (`window`, `document`, `localStorage`, direct `fetch`). The sandbox does not provide them. Use Shopify-provided APIs only.
- Never import packages that aren't in the extension's `package.json` (or that aren't on Shopify's runtime allow-list). Adding a new dependency requires checking Shopify's compatibility docs.
- All user-facing strings go through `useTranslate()` and the extension's `locales/` files. Hardcoded strings are a bug.
- After meaningful changes, run in order: `shopify app build` (validates TypeScript + bundle size + sandbox). The dev server (`shopify app dev`) will also surface runtime errors during interactive testing.
- Pre-save audit: remove unused imports (sandbox runtime is strict), confirm all React components return valid Shopify UI elements (returning bare HTML will throw at runtime).
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
- Check the DevTools console for runtime errors. Sandbox violations and missing hook calls show up here.
- Verify rendering at mobile (375px) and desktop (1280px+) viewport widths.
- Verify edge cases per the plan: empty cart, single item, threshold-met state, missing shipping address, etc.
- Bundle size check: run `shopify app build` and confirm the extension's compressed bundle size hasn't ballooned. Compare against the previous QA report's recorded size if available.

### DevOps

- Currently not operational for this project — no production deploy procedure is configured (see "Deploy targets" above).
- The project-scoped DevOps agent at `.claude/agents/devops.md` refuses `/ship` invocations until a deploy procedure is documented.

### General

- For bug investigation via `/investigate`, follow the standard procedure from the global General agent prompt.
- For Checkout UI Extension-specific investigations: first check whether the issue is a sandbox violation (e.g., extension trying to use a browser API), a hook misuse (e.g., calling a mutation hook outside an effect), or an extension target mismatch (extension configured for one target but expecting data from another).

---

## What NOT to change

- **`shopify.app.toml`** at the project root — managed by Shopify CLI. Edit only when explicitly required by a plan.
- **`shopify.extension.toml` per extension** — these configure the extension target, settings schema, and capabilities. Edit when adding extension targets or merchant settings, but be deliberate.
- **`.shopify/`** directory — Shopify CLI internal state, do not commit or edit.
- **Generated TypeScript declaration files** — regenerate via Shopify CLI rather than hand-editing.
- **`package-lock.json` and `pnpm-lock.yaml`** — let the respective package managers manage these.
- **Build artifacts** (`dist/`, `build/`, `.cache/`, `node_modules/`) — never commit, never edit.
- **`.env` files** — never commit, never edit as part of a feature plan.

---

## Required environment variables

Most environment variables for a Shopify app are managed by the Shopify CLI and stored in `.shopify/` (gitignored) or in the app's Partners account configuration. The extension runtime itself does NOT have access to environment variables — extensions are sandboxed and receive merchant configuration via `useSettings()` instead.

If a `.env` or `.env.local` file becomes necessary (e.g., for a custom build step or local testing utility):

| Variable | Purpose |
| :--- | :--- |
| (none required at this time) | Add entries here as the project grows |

Secrets that need to be available at runtime to the extension (e.g., a third-party API key) should be stored as merchant-facing settings in `shopify.extension.toml` and read via `useSettings()`, NOT as environment variables.

---

## Checkout UI Extension architectural directives

The remainder of this document captures the platform-specific rules for Shopify Checkout UI Extensions. Read carefully before any code modification.

### 1. Project Directory Structure

```text
.
├── extensions/                        # All extensions in this app live here
│   ├── free-shipping-progress/        # First extension (Checkout UI type)
│   │   ├── src/                       # React component source (.tsx)
│   │   ├── locales/                   # i18n translation files
│   │   ├── shopify.extension.toml     # Extension config (target, settings, capabilities)
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
- **Limited network access:** `fetch()` to arbitrary URLs is blocked. Use Shopify-provided APIs (or Shopify Functions, which are a different extension type).
- **Limited React features:** Most React hooks work, but extensions that depend on `useLayoutEffect`, ref-based DOM access, or other browser-specific APIs will fail.
- **Limited dependencies:** Only packages on Shopify's allow-list can be imported. Most utility libraries (lodash, date-fns, etc.) work; framework-specific packages (Next.js, Remix, anything assuming a server) do not.

**Consequence:** When a developer (or AI agent) suggests using `window.location`, `fetch('...some external API...')`, or `<div>`, the suggestion is invalid for this project.

### 3. Extension Targets

The "extension target" determines WHERE in the checkout flow the extension renders. Set in `shopify.extension.toml` under `[[extensions.targeting]]`. Common targets:

- `purchase.checkout.block.render` — generic block, merchant places it via the checkout editor
- `purchase.checkout.delivery-address.render-before` / `render-after` — around the delivery address section
- `purchase.checkout.contact.render-before` / `render-after` — around the contact info section
- `purchase.checkout.payment.render-before` / `render-after` — around the payment section
- `purchase.checkout.shipping-option-list.render-after` — below shipping options
- `purchase.checkout.cart-line-item.render-after` — below each line item in the order summary
- `purchase.checkout.actions.render-before` — above the "Pay now" button
- `purchase.checkout.reductions.render-before` / `render-after` — around discount input

Each target receives a slightly different API surface via `useApi()`. Plans must specify the target and confirm the data the extension needs is actually available at that target.

### 4. UI Primitive Components

Use ONLY components from `@shopify/ui-extensions-react/checkout`. The available primitives (non-exhaustive):

- **Layout:** `<BlockStack>`, `<InlineStack>`, `<Grid>`, `<View>`, `<Divider>`, `<Spacer>`
- **Text:** `<Text>`, `<Heading>`, `<Link>`
- **Actions:** `<Button>`, `<Pressable>`
- **Forms:** `<TextField>`, `<Checkbox>`, `<Select>`, `<Choice>`, `<DateField>`, `<NumberField>`
- **Feedback:** `<Banner>`, `<Spinner>`, `<SkeletonText>`, `<SkeletonImage>`, `<SkeletonTextBlock>`
- **Media:** `<Image>`, `<Icon>`, `<Thumbnail>`
- **Disclosure:** `<Disclosure>`, `<Modal>`, `<Tooltip>`
- **Tags & badges:** `<Tag>`, `<Badge>`

These components are styled by Shopify and adapt to the merchant's checkout theme automatically. Custom styling is limited to component props (e.g., `border`, `padding`, `cornerRadius`, `inlineAlignment`).

**Forbidden:** Standard HTML elements (`<div>`, `<span>`, `<p>`, `<button>`, etc.) will NOT render. The bundler may not catch this — the error appears at runtime in the checkout console.

### 5. Data Access via Hooks

All data flows through Shopify-provided hooks. Common ones:

- **Read state (reactive):**
  - `useCartLines()` — current line items
  - `useTotalAmount()` — cart total
  - `useDiscountCodes()` — applied discount codes
  - `useShippingAddress()`, `useBillingAddress()` — addresses
  - `useDeliveryGroups()` — shipping methods
  - `useEmail()`, `useCustomer()` — customer info
  - `useNote()` — order notes
- **Apply changes (mutations):**
  - `useApplyDiscountCodeChange()` — add/remove discount codes
  - `useApplyCartLinesChange()` — add/remove/update line items
  - `useApplyShippingAddressChange()` — modify shipping address
  - `useApplyAttributeChange()` — set custom attributes
  - `useApplyMetafieldsChange()` — set metafields
- **Merchant configuration:**
  - `useSettings()` — read merchant-configured settings (defined in `shopify.extension.toml`)
- **Other:**
  - `useTranslate()` — resolve translation keys
  - `useExtensionApi()` / `useApi()` — full API surface
  - `useStorage()` — sandboxed storage (NOT the same as browser localStorage)

All read hooks are reactive. Component re-renders when the underlying data changes. Mutation hooks return functions that, when called, request the change from the host page.

### 6. Internationalization (i18n)

User-facing strings must use translations, NOT hardcoded text. The pattern:

```tsx
import {useTranslate} from '@shopify/ui-extensions-react/checkout';

export default function FreeShippingProgress() {
  const translate = useTranslate();
  return <Text>{translate('progressMessage', {remaining: '$10'})}</Text>;
}
```

Translations live in the extension's `locales/` directory. `en.default.json` is required; additional locales (e.g., `fr.json`, `es.json`) are merchant-facing.

### 7. Merchant Settings

Settings allow merchants to configure the extension without code changes. Defined in `shopify.extension.toml`:

```toml
[extensions.settings]
[[extensions.settings.fields]]
key = "free_shipping_threshold"
type = "number_decimal"
name = "Free shipping threshold"
description = "Cart total at which free shipping applies"

[[extensions.settings.fields]]
key = "progress_bar_color"
type = "color"
name = "Progress bar color"
```

Read in the extension:

```tsx
const {free_shipping_threshold, progress_bar_color} = useSettings();
```

Available types include: `single_line_text_field`, `multi_line_text_field`, `number_integer`, `number_decimal`, `boolean`, `date`, `date_time`, `color`, `variant_reference`, `product_reference`, `collection_reference`, `customer_reference`.

### 8. Performance Budget

Each extension has a strict bundle size budget enforced at deploy time (typically ~100KB compressed). Practices:

- Avoid heavy dependencies. Prefer pure-function utilities written inline.
- Use Shopify primitives instead of custom layout libraries.
- Lazy-load if absolutely necessary (`React.lazy` works in the sandbox), but most extensions are small enough that lazy loading adds more weight than it saves.
- Run `shopify app build` periodically and monitor the per-extension bundle size in the output.

### 9. Code Quality & Pre-Save Audits

Before saving any file:

- Confirm all React components return only Shopify UI primitives, never HTML.
- Confirm all data access goes through Shopify hooks, never `fetch()` or browser globals.
- Confirm all user-facing strings use `useTranslate()`, never hardcoded English.
- Confirm imports come only from `@shopify/ui-extensions-react/checkout`, the extension's `src/`, the extension's `locales/`, or Shopify-allow-listed npm packages.
- Confirm `shopify.extension.toml` configuration matches what the extension actually does (e.g., if the extension uses `useApplyDiscountCodeChange`, the `[[extensions.capabilities]]` block in the toml must declare that capability).

---

End of project context. Agents proceed from here.

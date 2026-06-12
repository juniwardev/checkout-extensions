import '@shopify/ui-extensions/preact';
import {render} from "preact";

// Export the extension entry point (Shopify-prescribed shape; do not alter).
export default async () => {
  render(<Extension />, document.body)
};

// ---------------------------------------------------------------------------
// Pure helpers
// All are stateless functions — no side-effects, no signal reads.
// ---------------------------------------------------------------------------

// Coerce an arbitrary settings value to a positive finite number, else null.
// Handles both number and string inputs from the settings signal.
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

// verified MCP-2: s-progress tone only accepts 'auto' | 'critical'
// (standard.d.ts + MCP docs). Any other value falls back to 'auto'.
const ALLOWED_TONES = ["auto", "critical"];

function resolveTone(raw) {
  return ALLOWED_TONES.includes(raw) ? raw : "auto";
}

// Single authoritative emoji resolver (§6 + §8 of the plan).
// Rejects empty/whitespace strings so qualifiedMessage never gets a leading space.
// Do NOT use a weaker typeof-only check anywhere — use this function exclusively.
function resolveEmoji(raw) {
  return (typeof raw === "string" && raw.trim() !== "") ? raw.trim() : "🎉";
}

// verified MCP-4: option.costAfterDiscounts is the buyer-paid price (post
// shipping discount); option.cost is the pre-discount price. Test
// costAfterDiscounts first so discount-driven free shipping (the most common
// real merchant setup) is detected. Fall back to cost so a genuinely flat-$0
// rate is also caught. PickupLocationOption has neither field; the optional
// chain handles it cleanly (returns undefined, never === 0).
// amount is a JS number (not a string) — standard.d.ts:967.
function isZeroCost(option) {
  return (option.costAfterDiscounts ?? option.cost)?.amount === 0;
}

// ---------------------------------------------------------------------------
// Currency formatter
// verified MCP-3: shopify.i18n.formatCurrency(number | bigint, Intl.NumberFormatOptions?) => string
// verified MCP-5: shopify.cost.totalAmount.value.currencyCode is a CurrencyCode string
// ---------------------------------------------------------------------------
function formatRemaining(amountNumber) {
  // currencyCode is sourced from the cart's Money signal, guaranteed present
  // when this function is called (only called in State 2 / "below", where
  // totalAmount has already been read to derive the remaining number).
  const currency = shopify.cost.totalAmount.value.currencyCode;
  return shopify.i18n.formatCurrency(amountNumber, { currency });
}

// ---------------------------------------------------------------------------
// State resolver
// Returns a tagged union: { kind: "empty" } | { kind: "qualified", emoji } |
// { kind: "below", tone, percent, remaining }
//
// All signal reads (.value) happen inside this function so that the wrapping
// Extension component re-renders reactively whenever cart, cost, delivery
// groups, or settings signals change.
// ---------------------------------------------------------------------------
function resolveState() {
  // Guard the settings read — the signal may be undefined briefly before hydration.
  const settings = shopify.settings.value ?? {};

  // --- Read all signals ---
  const lines  = shopify.cartLines.value;
  // verified MCP-5: shopify.cost is a plain CartCost object (not a signal);
  // totalAmount is the signal within it. Money.amount is a JS number.
  const moneySignal = shopify.cost.totalAmount.value;
  const total  = toPositiveNumber(moneySignal?.amount);
  const groups = shopify.deliveryGroups.value ?? [];

  // --- Derive settings values ---
  // Boolean default is true: unset (undefined) is treated as auto-detect ON.
  // Only an explicit merchant "false" switches to manual mode.
  const autoDetect = settings.use_shopify_free_shipping_rate !== false;

  const rawThreshold = toPositiveNumber(settings.manual_threshold);

  // Mode-dependent effective threshold (Finding A, Pass 3 of the review):
  // In auto-detect mode a null rawThreshold collapses to 0 so the feature is
  // not disabled — the qualified message can still render once a zero-cost
  // option appears, and only the below-state bar is hidden (no fill target).
  // In manual mode it stays null so STEP 1 can reject the misconfiguration.
  const effectiveThreshold = autoDetect ? (rawThreshold ?? 0) : rawThreshold;

  const tone  = resolveTone(settings.progress_bar_tone);
  const emoji = resolveEmoji(settings.qualified_emoji);

  // STEP 0 — empty cart: render nothing.
  if (lines.length === 0) {
    return { kind: "empty" };
  }

  // STEP 1 — misconfiguration guard (manual mode only).
  // effectiveThreshold is null only when autoDetect === false AND rawThreshold
  // is null/zero/invalid. In auto-detect mode effectiveThreshold is always a
  // number (0 when rawThreshold is null), so this guard never fires there.
  if (effectiveThreshold === null) {
    console.warn(
      "[free-shipping-progress] manual_threshold is unset, zero, or invalid in manual mode; rendering nothing."
    );
    return { kind: "empty" };
  }

  // STEP 2 — qualification detection.
  let qualified;
  if (autoDetect) {
    // Auto-detect mode: qualify from the existence of any zero-cost delivery option.
    // groups.length === 0 means the customer has not yet entered enough address
    // information to compute shipping options — treat as not yet qualified.
    if (groups.length === 0) {
      qualified = false;
    } else {
      qualified = groups.some(function(g) {
        return (g.deliveryOptions ?? []).some(isZeroCost);
      });
    }
  } else {
    // Manual mode: qualify by comparing total against the threshold.
    // A null total (signal not yet hydrated) is treated as 0 — never qualifies.
    const currentTotal = total ?? 0;
    qualified = currentTotal >= effectiveThreshold;
  }

  // STEP 3 — emit state.
  if (qualified) {
    return { kind: "qualified", emoji };
  }

  // Auto-detect dead-end suppression guard (Finding B, Pass 3 of the review):
  // Scoped to groups.length > 0 so it only fires once delivery options are
  // resolved. When the customer is already at/over the threshold but no
  // zero-cost option exists, showing "$0.00 away from free shipping" at 99%
  // would be misleading — the extension has no honest claim to make. Render
  // nothing instead (v1 decision, §6 SUPPRESS). The groups.length > 0
  // precondition ensures the pre-address progress bar (promised by the §6
  // edge table for the groups-empty case) is not swallowed.
  // In manual mode autoDetect === false makes this guard a no-op (manual mode
  // qualifies at currentTotal >= threshold via STEP 2, so this branch is
  // only reached when below the threshold).
  if (autoDetect && groups.length > 0 && (total ?? 0) >= effectiveThreshold) {
    return { kind: "empty" };
  }

  // No-fill-target guard (Finding A, Pass 3 of the review):
  // In auto-detect mode with a blank threshold (effectiveThreshold === 0) and
  // no zero-cost option yet, there is no meaningful fill target. Dividing by 0
  // would crash; showing a "$0.00 away" bar at 99% would mislead. Hide the bar.
  // STEP 1 was NOT triggered, so the qualified message can still appear later
  // once a zero-cost option surfaces.
  if (effectiveThreshold === 0) {
    return { kind: "empty" };
  }

  // effectiveThreshold is a positive number here.
  // Compute the progress bar fill (0–99 integer; cap at 99 so the bar never
  // reads "100%" while the customer is still below qualified state).
  const currentTotal = total ?? 0;
  const remainingNum = clamp(effectiveThreshold - currentTotal, 0, effectiveThreshold);
  const rawPercent   = (currentTotal / effectiveThreshold) * 100;
  const percent      = clamp(Math.round(rawPercent), 0, 99);

  return {
    kind: "below",
    tone,
    percent,
    remaining: remainingNum,
  };
}

// ---------------------------------------------------------------------------
// Extension component
// Calls resolveState() and switches on the returned tagged union.
// Because all signal reads happen inside resolveState() (which runs inside
// render), Preact's signal tracking causes automatic re-renders when cart
// lines, cost, delivery groups, or settings change.
// ---------------------------------------------------------------------------
function Extension() {
  const state = resolveState();

  if (state.kind === "empty") {
    return null;
  }

  if (state.kind === "qualified") {
    return (
      <s-text>
        {shopify.i18n.translate("qualifiedMessage", { emoji: state.emoji })}
      </s-text>
    );
  }

  // state.kind === "below"
  const remaining = formatRemaining(state.remaining);
  return (
    <s-stack gap="base">
      <s-text>
        {shopify.i18n.translate("progressMessage", { remaining })}
      </s-text>
      <s-progress
        value={state.percent}
        max={100}
        tone={state.tone}
        accessibilityLabel={shopify.i18n.translate("progressBarAriaLabel", { percent: state.percent })}
      />
    </s-stack>
  );
}
